"""Enrollment: turn N webcam captures of one person into stored embeddings."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.detector import FaceDetector
from app.storage import EmbeddingStore


@dataclass
class CaptureOutcome:
    accepted: bool
    reason: str
    sample_count: int


class EnrollmentSession:
    """Captures embeddings for a single member across multiple frames.

    The caller (an interactive script) supplies frames one at a time; this
    class only decides whether a given frame is a good sample and persists
    it. It has no dependency on cv2 windows/keyboard handling, so it can be
    unit tested with synthetic frames and a fake detector.
    """

    def __init__(
        self,
        member_name: str,
        detector: FaceDetector,
        store: EmbeddingStore,
        target_samples: int,
    ) -> None:
        self.member_name = member_name
        self._detector = detector
        self._store = store
        self.target_samples = target_samples

    @property
    def captured(self) -> int:
        return self._store.sample_count(self.member_name)

    @property
    def is_complete(self) -> bool:
        return self.captured >= self.target_samples

    def capture_sample(self, frame: np.ndarray) -> CaptureOutcome:
        faces = self._detector.detect(frame)
        if len(faces) == 0:
            return CaptureOutcome(False, "No face detected - face the camera.", self.captured)
        if len(faces) > 1:
            return CaptureOutcome(
                False, "More than one face detected - only one person at a time.", self.captured
            )
        self._store.save(self.member_name, faces[0].embedding)
        return CaptureOutcome(True, "Sample captured.", self.captured)
