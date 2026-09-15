from fastapi import FastAPI, UploadFile, File, Form
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


@app.get("/health")
def health():
    return {"status": "AI Service Running"}


@app.post("/embedding")
async def generate_embedding(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = decode_image(contents)

        if img is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid image file"}
            )

        faces = face_app.get(img)

        if len(faces) == 0:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face detected"}
            )

        if len(faces) > 1:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Multiple faces detected"}
            )

        embedding = faces[0].embedding.tolist()

        return {
            "success": True,
            "embedding": embedding
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )


@app.post("/enroll")
async def enroll_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = decode_image(contents)

        if img is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid image file"}
            )

        faces = face_app.get(img)

        if len(faces) == 0:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face detected in photo"}
            )

        if len(faces) > 1:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Multiple faces detected. Please use a photo with only one face."}
            )

        embedding = faces[0].embedding.tolist()

        return {
            "success": True,
            "embedding": embedding
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )


@app.post("/verify")
async def verify_face(
    file: UploadFile = File(...),
    stored_embeddings: str = Form(...)
):
    try:
        contents = await file.read()
        img = decode_image(contents)

        if img is None:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid image file"}
            )

        faces = face_app.get(img)

        if len(faces) == 0:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "No face detected"}
            )

        if len(faces) > 1:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Multiple faces detected"}
            )

        current_embedding = faces[0].embedding.tolist()
        embeddings_list = json.loads(stored_embeddings)

        best_similarity = 0.0
        for stored in embeddings_list:
            sim = cosine_similarity(current_embedding, stored)
            best_similarity = max(best_similarity, sim)

        match = best_similarity >= SIMILARITY_THRESHOLD

        return {
            "success": True,
            "match": match,
            "similarity": round(best_similarity, 4),
            "threshold": SIMILARITY_THRESHOLD
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": str(e)}
        )