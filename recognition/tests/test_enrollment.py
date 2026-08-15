import numpy as np

from app.detector import DetectedFace
from app.enrollment import EnrollmentSession
from app.storage import EmbeddingStore


class FakeDetector:
    def __init__(self, faces):
        self.faces = faces

    def detect(self, frame):
        return self.faces


def make_face(x=0.0):
    return DetectedFace(bbox=(0, 0, 10, 10), det_score=0.9, embedding=np.array([x, 1.0 - x]))


def test_capture_sample_rejects_when_no_face_detected(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    session = EnrollmentSession("ali", FakeDetector([]), store, target_samples=3)

    outcome = session.capture_sample(frame=None)

    assert outcome.accepted is False
    assert session.captured == 0


def test_capture_sample_rejects_when_multiple_faces_detected(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    session = EnrollmentSession(
        "ali", FakeDetector([make_face(), make_face()]), store, target_samples=3
    )

    outcome = session.capture_sample(frame=None)

    assert outcome.accepted is False
    assert session.captured == 0


def test_capture_sample_accepts_single_face_and_persists_it(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    session = EnrollmentSession("ali", FakeDetector([make_face()]), store, target_samples=3)

    outcome = session.capture_sample(frame=None)

    assert outcome.accepted is True
    assert session.captured == 1
    assert store.load_all()["ali"][0].shape == (2,)


def test_session_is_complete_once_target_reached(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    session = EnrollmentSession("ali", FakeDetector([make_face()]), store, target_samples=2)

    assert session.is_complete is False
    session.capture_sample(frame=None)
    assert session.is_complete is False
    session.capture_sample(frame=None)
    assert session.is_complete is True
