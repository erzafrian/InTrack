from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from starlette.concurrency import run_in_threadpool
import asyncio
from fastapi.responses import JSONResponse
import numpy as np
import cv2
import os
import sys
import glob
import json

# Register NVIDIA DLL directories before importing onnxruntime
nvidia_path = os.path.join(sys.prefix, "Lib", "site-packages", "nvidia")
if os.path.isdir(nvidia_path):
    dll_dirs = glob.glob(os.path.join(nvidia_path, "*", "bin"))
    for dll_dir in dll_dirs:
        if os.path.isdir(dll_dir):
            os.environ["PATH"] = dll_dir + os.pathsep + os.environ.get("PATH", "")
            os.add_dll_directory(dll_dir)

import onnxruntime as ort
print(ort.get_available_providers())

import insightface

app = FastAPI()

# Load model once at startup
face_app = insightface.app.FaceAnalysis()
face_app.prepare(ctx_id=0)  # 0 = GPU, -1 = CPU

SIMILARITY_THRESHOLD = 0.4


def decode_image(contents: bytes):
    nparr = np.frombuffer(contents, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# One inference at a time per worker; excess requests fail fast instead of
# retaining an unbounded queue of images on a small VPS.
inference_lock = asyncio.Lock()
MAX_FILE_BYTES = 10 * 1024 * 1024
cv2.setNumThreads(1)


def extract_embedding(contents):
    img = decode_image(contents)
    if img is None:
        raise HTTPException(400, "Invalid image file")
    faces = face_app.get(img)
    if len(faces) != 1:
        raise HTTPException(400, "Use a photo with exactly one face")
    return faces[0].embedding.tolist()


async def read_embedding(file):
    if inference_lock.locked():
        raise HTTPException(429, "Face service is busy. Please try again.", headers={"Retry-After": "2"})
    async with inference_lock:
        contents = await file.read(MAX_FILE_BYTES + 1)
        if len(contents) > MAX_FILE_BYTES:
            raise HTTPException(413, "Photo exceeds the 10 MiB limit")
        # CPU work runs outside the event loop, keeping /health responsive.
        return await run_in_threadpool(extract_embedding, contents)


@app.exception_handler(HTTPException)
async def http_error_handler(request, exc):
    return JSONResponse(status_code=exc.status_code,
                        content={"success": False, "message": exc.detail},
                        headers=exc.headers)


@app.get("/health")
async def health():
    return {"status": "AI Service Running"}


@app.post("/embedding")
@app.post("/enroll")
async def enroll_face(file: UploadFile = File(...)):
    return {"success": True, "embedding": await read_embedding(file)}


@app.post("/verify")
async def verify_face(file: UploadFile = File(...), stored_embeddings: str = Form(...)):
    try:
        embeddings = np.asarray(json.loads(stored_embeddings), dtype=np.float32)
        if (embeddings.ndim != 2 or embeddings.shape[1] != 512
                or not 1 <= len(embeddings) <= 15 or not np.isfinite(embeddings).all()
                or np.any(np.linalg.norm(embeddings, axis=1) == 0)):
            raise ValueError("Invalid embeddings")
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid stored embeddings")
    current = await read_embedding(file)
    best_similarity = max(0.0, max(cosine_similarity(current, stored) for stored in embeddings))
    return {"success": True, "match": best_similarity >= SIMILARITY_THRESHOLD,
            "similarity": round(best_similarity, 4), "threshold": SIMILARITY_THRESHOLD}
