import numpy as np

from app.detector import DetectedFace
from app.recognizer import Recognizer


class FakeDetector:
    """Duck-types FaceDetector without loading InsightFace - Recognizer only
    calls .detect(frame), so any object with that method works."""

    def __init__(self, faces):
        self._faces = faces

    def detect(self, frame):
        return self._faces


def test_recognize_marks_high_confidence_face_as_recognized():
    face = DetectedFace(bbox=(0, 0, 10, 10), det_score=0.99, embedding=np.array([1.0, 0.0]))
    recognizer = Recognizer(FakeDetector([face]), threshold=0.5)

    results = recognizer.recognize(frame=None, enrolled={"ali": [np.array([1.0, 0.0])]})

    assert len(results) == 1
    assert results[0].recognized is True
    assert results[0].member_name == "ali"
    assert results[0].confidence == 1.0


def test_recognize_marks_low_confidence_face_as_unknown():
    face = DetectedFace(bbox=(0, 0, 10, 10), det_score=0.99, embedding=np.array([0.0, 1.0]))
    recognizer = Recognizer(FakeDetector([face]), threshold=0.5)

    results = recognizer.recognize(frame=None, enrolled={"ali": [np.array([1.0, 0.0])]})

    assert results[0].recognized is False
    assert results[0].member_name == "Unknown"


def test_recognize_with_nothing_enrolled_is_always_unknown():
    face = DetectedFace(bbox=(0, 0, 10, 10), det_score=0.99, embedding=np.array([1.0, 0.0]))
    recognizer = Recognizer(FakeDetector([face]), threshold=0.5)

    results = recognizer.recognize(frame=None, enrolled={})

    assert results[0].recognized is False
    assert results[0].member_name == "Unknown"


def test_recognize_with_no_faces_returns_empty_list():
    recognizer = Recognizer(FakeDetector([]), threshold=0.5)
    assert recognizer.recognize(frame=None, enrolled={}) == []
