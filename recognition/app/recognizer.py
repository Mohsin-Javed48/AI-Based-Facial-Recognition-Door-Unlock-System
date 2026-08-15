"""Wires detection + matching + the threshold decision into one call per frame.

Mirrors the project's pipeline diagram: detect face -> generate embedding ->
compare against enrolled embeddings -> best match + confidence -> threshold
-> recognized / unknown.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.detector import FaceDetector
from app.matcher import best_match


@dataclass
class RecognitionResult:
    bbox: tuple[int, int, int, int]
    det_score: float
    member_name: str  # enrolled name, or "Unknown"
    confidence: float
    recognized: bool


class Recognizer:
    def __init__(self, detector: FaceDetector, threshold: float) -> None:
        self._detector = detector
        self.threshold = threshold

    def recognize(
        self, frame: np.ndarray, enrolled: dict[str, list[np.ndarray]]
    ) -> list[RecognitionResult]:
        results: list[RecognitionResult] = []
        for face in self._detector.detect(frame):
            match = best_match(face.embedding, enrolled)
            recognized = match.member_name is not None and match.confidence >= self.threshold
            results.append(
                RecognitionResult(
                    bbox=face.bbox,
                    det_score=face.det_score,
                    member_name=match.member_name if recognized else "Unknown",
                    confidence=match.confidence,
                    recognized=recognized,
                )
            )
        return results
