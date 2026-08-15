"""Webcam capture wrapper.

Phase 0 only needs ``cv2.VideoCapture(0)`` (the laptop's built-in webcam),
but the source is kept configurable (see ``app.config``) so Phase 3 can swap
in a capture-card index or an RTSP URL without touching this class.
"""

from __future__ import annotations

import time

import cv2
import numpy as np


class CameraError(RuntimeError):
    """Raised when the camera can't be opened or read from."""


class FpsCounter:
    """Rolling average FPS over a short window."""

    def __init__(self, window: int = 30) -> None:
        self._window = window
        self._timestamps: list[float] = []

    def tick(self) -> float:
        now = time.monotonic()
        self._timestamps.append(now)
        if len(self._timestamps) > self._window:
            self._timestamps.pop(0)
        if len(self._timestamps) < 2:
            return 0.0
        elapsed = self._timestamps[-1] - self._timestamps[0]
        if elapsed <= 0:
            return 0.0
        return (len(self._timestamps) - 1) / elapsed


class Camera:
    """Thin, swappable wrapper around ``cv2.VideoCapture``.

    Usage::

        with Camera(source=0) as cam:
            for frame in cam.frames():
                ...
    """

    def __init__(self, source: int | str) -> None:
        self._source = source
        self._cap: cv2.VideoCapture | None = None
        self.fps = FpsCounter()
        self.last_fps: float = 0.0

    def open(self) -> None:
        self._cap = cv2.VideoCapture(self._source)
        if not self._cap.isOpened():
            self._cap.release()
            self._cap = None
            raise CameraError(
                f"Could not open camera source {self._source!r}. "
                "Check that no other application is using the webcam and "
                "that CAMERA_SOURCE is correct."
            )

    def read(self) -> np.ndarray:
        if self._cap is None:
            raise CameraError("Camera is not open. Call open() first.")
        ok, frame = self._cap.read()
        if not ok or frame is None:
            raise CameraError("Failed to read a frame from the camera.")
        self.last_fps = self.fps.tick()
        return frame

    def frames(self):
        """Yield frames until the camera stops producing them or the caller breaks."""
        while True:
            yield self.read()

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def __enter__(self) -> Camera:
        self.open()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.release()
