"""Enroll a family member.

Usage:
    python scripts/enroll.py --name Ali [--samples 8]

Opens the webcam with a live preview and captures one embedding sample each
time you press SPACE, so you can vary angle/lighting between shots. Press
'Q' to stop early - anything already captured is kept, and re-running with
the same --name resumes toward the target instead of starting over.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# allow `python scripts/enroll.py` to import the `app` package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2

from app.camera import Camera, CameraError
from app.config import CONFIG
from app.detector import FaceDetector
from app.enrollment import EnrollmentSession
from app.storage import EmbeddingStore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enroll a family member's face.")
    parser.add_argument("--name", required=True, help="Member name/identifier (used as folder name).")
    parser.add_argument(
        "--samples",
        type=int,
        default=8,
        help="Total samples to have on disk for this member once done (default: 8).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    print("Loading InsightFace model (first run downloads model weights, needs internet)...")
    detector = FaceDetector(CONFIG.insightface_model_pack, CONFIG.insightface_det_size)
    store = EmbeddingStore(CONFIG.embeddings_dir)
    session = EnrollmentSession(args.name, detector, store, target_samples=args.samples)

    if session.is_complete:
        print(f"'{args.name}' already has {session.captured} samples (target {args.samples}). Nothing to do.")
        return 0

    print(f"Enrolling '{args.name}'. Target: {args.samples} samples.")
    print("SPACE = capture sample, Q = quit early.")

    try:
        with Camera(CONFIG.camera_source) as cam:
            while not session.is_complete:
                frame = cam.read()
                display = frame.copy()
                status = f"{args.name}: {session.captured}/{args.samples}  (SPACE=capture, Q=quit)"
                cv2.putText(display, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.imshow("Enroll - Phase 0", display)

                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if key == ord(" "):
                    outcome = session.capture_sample(frame)
                    print(f"[{outcome.sample_count}/{args.samples}] {outcome.reason}")
    except CameraError as exc:
        print(f"Camera error: {exc}", file=sys.stderr)
        return 1
    finally:
        cv2.destroyAllWindows()

    print(f"Done. '{args.name}' now has {session.captured} stored samples.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
