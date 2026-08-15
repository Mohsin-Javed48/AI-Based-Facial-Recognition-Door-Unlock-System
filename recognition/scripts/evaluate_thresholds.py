"""Evaluate recognition accuracy across candidate thresholds.

Usage:
    python scripts/evaluate_thresholds.py [--thresholds 0.3 0.4 0.5 ...]

Reads test images from:
    data/test_set/known/<member_name>/*.jpg   (labeled - name must match an
                                                enrolled member)
    data/test_set/unknown/*.jpg                (anyone NOT enrolled)

and compares each face's embedding against the already-enrolled set
(data/embeddings/) at several thresholds, reporting false accepts and false
rejects. This is a sanity check on a small hand-picked set, not a production
accuracy benchmark - see the disclaimer printed at the end.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cv2

from app.config import CONFIG
from app.detector import FaceDetector
from app.matcher import best_match
from app.storage import EmbeddingStore

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp"}


@dataclass
class Sample:
    true_name: str | None  # None for "unknown" samples
    image_path: Path
    match_name: str | None
    confidence: float


def _iter_images(directory: Path):
    if not directory.exists():
        return
    for path in sorted(directory.iterdir()):
        if path.suffix.lower() in IMAGE_SUFFIXES:
            yield path


def _score_image(
    image_path: Path, detector: FaceDetector, enrolled: dict, true_name: str | None
) -> Sample:
    frame = cv2.imread(str(image_path))
    if frame is None:
        return Sample(true_name, image_path, match_name=None, confidence=0.0)
    faces = detector.detect(frame)
    if not faces:
        return Sample(true_name, image_path, match_name=None, confidence=0.0)
    face = max(faces, key=lambda f: f.det_score)  # most confident detection in the image
    match = best_match(face.embedding, enrolled)
    return Sample(true_name, image_path, match.member_name, match.confidence)


def load_samples(test_set_dir: Path, detector: FaceDetector, enrolled: dict) -> list[Sample]:
    samples: list[Sample] = []

    known_dir = test_set_dir / "known"
    if known_dir.exists():
        for member_dir in sorted(p for p in known_dir.iterdir() if p.is_dir()):
            for image_path in _iter_images(member_dir):
                samples.append(
                    _score_image(image_path, detector, enrolled, true_name=member_dir.name)
                )

    for image_path in _iter_images(test_set_dir / "unknown"):
        samples.append(_score_image(image_path, detector, enrolled, true_name=None))

    return samples


def report_for_threshold(samples: list[Sample], threshold: float) -> dict:
    known = [s for s in samples if s.true_name is not None]
    unknown = [s for s in samples if s.true_name is None]

    correctly_recognized = sum(
        1 for s in known if s.confidence >= threshold and s.match_name == s.true_name
    )
    false_rejects = len(known) - correctly_recognized

    false_accepts = sum(1 for s in unknown if s.confidence >= threshold)
    correctly_rejected = len(unknown) - false_accepts

    return {
        "threshold": threshold,
        "known_total": len(known),
        "known_recognized": correctly_recognized,
        "false_rejects": false_rejects,
        "unknown_total": len(unknown),
        "unknown_rejected": correctly_rejected,
        "false_accepts": false_accepts,
    }


def recommend_threshold(reports: list[dict]) -> float | None:
    """Prefer the lowest threshold with zero false accepts, falling back to
    the fewest total mistakes. A false accept (stranger let in) is a worse
    outcome than a false reject (family member falls back to the manual
    override), so avoiding false accepts is weighted first."""
    zero_false_accept = [r for r in reports if r["false_accepts"] == 0]
    candidates = zero_false_accept or reports
    if not candidates:
        return None
    best = min(candidates, key=lambda r: (r["false_accepts"], r["false_rejects"]))
    return best["threshold"]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate recognition thresholds against a test set."
    )
    parser.add_argument(
        "--thresholds",
        type=float,
        nargs="+",
        default=[0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70],
        help="Threshold values to test.",
    )
    args = parser.parse_args()

    test_set_dir = CONFIG.data_dir / "test_set"
    enrolled = EmbeddingStore(CONFIG.embeddings_dir).load_all()
    if not enrolled:
        print(f"No enrolled members found in {CONFIG.embeddings_dir}. Run scripts/enroll.py first.")
        return 1

    print("Loading InsightFace model...")
    detector = FaceDetector(CONFIG.insightface_model_pack, CONFIG.insightface_det_size)

    samples = load_samples(test_set_dir, detector, enrolled)
    if not samples:
        print(
            f"No test images found under {test_set_dir}. Add images to "
            f"{test_set_dir / 'known' / '<name>'} and {test_set_dir / 'unknown'} first."
        )
        return 1

    known_count = sum(1 for s in samples if s.true_name is not None)
    unknown_count = len(samples) - known_count
    print(f"Loaded {known_count} known-face image(s) and {unknown_count} unknown-face image(s).\n")

    reports = [report_for_threshold(samples, t) for t in args.thresholds]
    for r in reports:
        print(f"Threshold: {r['threshold']:.2f}")
        print(f"  Known faces recognized:  {r['known_recognized']}/{r['known_total']}")
        print(f"  Unknown faces rejected:  {r['unknown_rejected']}/{r['unknown_total']}")
        print(f"  False accepts: {r['false_accepts']}")
        print(f"  False rejects: {r['false_rejects']}")
        print()

    recommended = recommend_threshold(reports)
    if recommended is not None:
        print(f"Recommended starting threshold: {recommended:.2f}")

    print(
        f"\nNOTE: this evaluated {len(samples)} image(s) total - far too small a sample to "
        "call the system production-ready. Treat this as a sanity check, not a benchmark. "
        "Real-world validation happens in Phase 5 (shadow mode field trial)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
