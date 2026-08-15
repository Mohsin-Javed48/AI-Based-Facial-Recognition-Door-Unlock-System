"""InsightFace-based face detector.

Wraps ``insightface.app.FaceAnalysis``. InsightFace's model pack produces a
detection bounding box and a recognition embedding in the same forward pass
(that's how the underlying ONNX models are built), so this module owns model
loading and the raw per-face output. ``embedding.py`` and ``matcher.py``
treat that output as plain data and know nothing about the model itself,
which keeps "detection" and "recognition/matching" as separate concerns even
though one InsightFace call produces both.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from insightface.app import FaceAnalysis


@dataclass
class DetectedFace:
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 in pixel coordinates
    det_score: float
    embedding: np.ndarray  # raw, un-normalized embedding from the model


class FaceDetector:
    """Loads the InsightFace model pack once and detects faces per frame."""

    def __init__(self, model_pack: str, det_size: int) -> None:
        self._app = FaceAnalysis(name=model_pack, allowed_modules=["detection", "recognition"])
        # ctx_id=-1 forces CPU execution - this project is designed to run
        # without a GPU (see README Tech Stack, Section 4).
        self._app.prepare(ctx_id=-1, det_size=(det_size, det_size))

    def detect(self, frame: np.ndarray) -> list[DetectedFace]:
        faces = self._app.get(frame)
        results: list[DetectedFace] = []
        for face in faces:
            x1, y1, x2, y2 = (int(round(v)) for v in face.bbox)
            results.append(
                DetectedFace(
                    bbox=(x1, y1, x2, y2),
                    det_score=float(face.det_score),
                    embedding=face.embedding,
                )
            )
        return results
