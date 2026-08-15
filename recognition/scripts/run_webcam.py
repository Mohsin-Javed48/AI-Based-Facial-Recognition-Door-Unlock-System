"""Phase 0 main loop: webcam -> detect -> recognize -> decide -> act -> log.

Usage:
    python scripts/run_webcam.py

Press 'Q' in the preview window to exit. Set LOG_LEVEL=DEBUG in .env to see
a per-face [DETECT]/[MATCH]/[DECIDE]/[ACT] trace in the console.
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2

from app.camera import Camera, CameraError
from app.config import CONFIG
from app.detector import FaceDetector
from app.gate_trigger import StubGateTrigger
from app.recognizer import RecognitionResult, Recognizer
from app.storage import AccessLogStore, EmbeddingStore

logging.basicConfig(level=CONFIG.log_level, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_webcam")

BOX_COLOR_RECOGNIZED = (0, 200, 0)
BOX_COLOR_UNKNOWN = (0, 0, 220)


def draw_result(frame, result: RecognitionResult) -> None:
    x1, y1, x2, y2 = result.bbox
    color = BOX_COLOR_RECOGNIZED if result.recognized else BOX_COLOR_UNKNOWN
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    label = f"{result.member_name} ({result.confidence:.2f})"
    cv2.putText(frame, label, (x1, max(0, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)


def main() -> int:
    print("Loading InsightFace model (first run downloads model weights, needs internet)...")
    detector = FaceDetector(CONFIG.insightface_model_pack, CONFIG.insightface_det_size)
    recognizer = Recognizer(detector, threshold=CONFIG.recognition_threshold)

    embedding_store = EmbeddingStore(CONFIG.embeddings_dir)
    enrolled = embedding_store.load_all()
    if not enrolled:
        logger.warning(
            "No enrolled members found in %s - every face will show as Unknown. "
            "Run scripts/enroll.py first.",
            CONFIG.embeddings_dir,
        )

    log_store = AccessLogStore(CONFIG.access_log_db_path)
    gate = StubGateTrigger(log_store, cooldown_seconds=CONFIG.gate_cooldown_seconds)

    # Throttle non-gate log writes (unknown faces, cooldown-suppressed
    # recognitions) using the same window as the gate cooldown, so a
    # lingering face logs roughly once per window instead of once per frame.
    last_logged_at: dict[str, float] = {}

    def log_throttled(member_name: str, confidence: float, event_type: str) -> None:
        now = time.monotonic()
        last = last_logged_at.get(member_name)
        if last is not None and (now - last) < CONFIG.gate_cooldown_seconds:
            return
        last_logged_at[member_name] = now
        log_store.log(member_name=member_name, confidence=confidence, event_type=event_type, action="none")

    print(f"Recognition threshold: {CONFIG.recognition_threshold}")
    print("Press 'Q' to quit.")

    try:
        with Camera(CONFIG.camera_source) as cam:
            while True:
                try:
                    frame = cam.read()
                except CameraError as exc:
                    logger.error("Camera read failed: %s", exc)
                    break

                for result in recognizer.recognize(frame, enrolled):
                    logger.debug("[DETECT] Face detected det_score=%.3f", result.det_score)
                    logger.debug("[MATCH] Best match: %s", result.member_name)
                    logger.debug("[MATCH] Confidence: %.3f", result.confidence)

                    if result.recognized:
                        logger.debug("[DECIDE] Recognized - above threshold %.2f", recognizer.threshold)
                        fired = gate.trigger(result.member_name, result.confidence)
                        if not fired:
                            log_throttled(result.member_name, result.confidence, "access_granted")
                    else:
                        logger.debug("[DECIDE] Unknown - below threshold %.2f", recognizer.threshold)
                        logger.debug("[ACT] Gate trigger skipped")
                        log_throttled("Unknown", result.confidence, "access_denied")

                    draw_result(frame, result)

                cv2.putText(
                    frame,
                    f"FPS: {cam.last_fps:.1f}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (255, 255, 0),
                    2,
                )
                cv2.imshow("Phase 0 - Face Recognition", frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    except CameraError as exc:
        logger.error("Could not start camera: %s", exc)
        return 1
    finally:
        cv2.destroyAllWindows()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
