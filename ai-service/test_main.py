"""Isolated service tests: no camera, model download or external API."""
import asyncio
import io
import sys
import threading
import types
import unittest
from unittest.mock import patch

import numpy as np
from starlette.datastructures import UploadFile
from fastapi import HTTPException


class FakeModel:
    def prepare(self, **kwargs):
        pass


with patch.dict(sys.modules, {
    "insightface": types.SimpleNamespace(app=types.SimpleNamespace(FaceAnalysis=FakeModel)),
    "onnxruntime": types.SimpleNamespace(get_available_providers=lambda: ["CPUExecutionProvider"]),
}):
    import main


class FaceServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        main.inference_lock = asyncio.Lock()

    async def test_health_remains_responsive_and_excess_inference_is_rejected(self):
        started, release = threading.Event(), threading.Event()

        def slow_embedding(contents):
            started.set()
            release.wait(2)
            return [1.0] + [0.0] * 511

        with patch.object(main, "extract_embedding", slow_embedding):
            pending = asyncio.create_task(main.read_embedding(UploadFile(io.BytesIO(b"fixture"))))
            try:
                for _ in range(100):
                    if started.is_set():
                        break
                    await asyncio.sleep(0.01)
                self.assertTrue(started.is_set())
                self.assertEqual((await asyncio.wait_for(main.health(), 0.2))["status"], "AI Service Running")
                with self.assertRaises(HTTPException) as caught:
                    await main.read_embedding(UploadFile(io.BytesIO(b"other")))
                self.assertEqual(caught.exception.status_code, 429)
            finally:
                release.set()
                self.assertEqual(len(await pending), 512)
        self.assertFalse(main.inference_lock.locked())

    async def test_size_and_embedding_validation(self):
        with self.assertRaises(HTTPException) as caught:
            await main.read_embedding(UploadFile(io.BytesIO(b"x" * (main.MAX_FILE_BYTES + 1))))
        self.assertEqual(caught.exception.status_code, 413)
        self.assertFalse(main.inference_lock.locked())
        for value in ['[]', '[[1, 2]]', 'null', 'not-json']:
            with self.assertRaises(HTTPException) as caught:
                await main.verify_face(UploadFile(io.BytesIO(b"fixture")), value)
            self.assertEqual(caught.exception.status_code, 400)

    async def test_verification_returns_match_for_valid_embedding(self):
        import json
        vector = np.zeros(512).tolist()
        vector[0] = 1.0
        with patch.object(main, 'extract_embedding', return_value=vector):
            result = await main.verify_face(UploadFile(io.BytesIO(b'fixture')), json.dumps([vector] * 15))
        self.assertTrue(result['match'])
        self.assertEqual(result['similarity'], 1.0)


if __name__ == '__main__':
    unittest.main()
