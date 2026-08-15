# Phase 0 — Software-First Face Recognition Build

This document covers the Phase 0 slice of the project (see `README.md`
Section 2.1): a face-recognition pipeline that runs entirely on the laptop's
built-in webcam, with the gate trigger implemented as a local stub. No
hardware beyond the webcam is required.

All code lives under [`recognition/`](../recognition).

```text
recognition/
├── app/
│   ├── camera.py        # cv2.VideoCapture wrapper, configurable source, FPS
│   ├── config.py         # env-based configuration (single source of truth)
│   ├── detector.py       # InsightFace model loading + per-frame detection
│   ├── embedding.py      # cosine similarity / normalization utilities
│   ├── enrollment.py     # turns webcam captures into stored embeddings
│   ├── gate_trigger.py   # GateTrigger interface + Phase 0 stub implementation
│   ├── matcher.py        # best-match search across enrolled embeddings
│   ├── recognizer.py     # detect -> match -> threshold decision, per frame
│   └── storage.py        # embeddings on disk (.npy) + access log (SQLite)
├── scripts/
│   ├── enroll.py               # interactive enrollment CLI
│   ├── run_webcam.py           # main recognition loop
│   └── evaluate_thresholds.py  # accuracy sanity-check across thresholds
├── data/
│   ├── embeddings/       # one folder per enrolled member (gitignored)
│   ├── logs/             # access_log.sqlite3 (gitignored)
│   └── test_set/         # known/<name>/*.jpg and unknown/*.jpg for evaluation
├── tests/                 # pytest - no camera or model download required
├── requirements.txt
└── .env.example
```

## 1. Python version

Python **3.11** (tested with 3.11.9). InsightFace and `onnxruntime` have
solid prebuilt wheels for 3.11; newer interpreters (e.g. 3.13/3.14) may not
have wheels available yet, so stick to 3.11 for this service.

Check what's installed:

```powershell
py -3.11 --version
```

## 2. Virtual environment setup

From the `recognition/` folder:

```powershell
cd recognition
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
```

(macOS/Linux: `python3.11 -m venv .venv && source .venv/bin/activate`)

## 3. Dependency installation

With the venv activated:

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

This installs OpenCV, InsightFace, onnxruntime (CPU), NumPy, python-dotenv,
and pytest. No GPU is required — `detector.py` explicitly forces CPU
execution (`ctx_id=-1`), matching the project's "no GPU needed on an old
laptop" design goal.

Copy the example environment file and adjust if needed:

```powershell
copy .env.example .env
```

## 4. InsightFace setup / model requirements

`FaceDetector` (in `app/detector.py`) loads the `buffalo_l` model pack via
`insightface.app.FaceAnalysis`. **The first time it runs, InsightFace
downloads the model weights (~300 MB) to `~/.insightface/models/`.** This
requires an internet connection once; after that it's cached locally and
works offline. If you're behind a restrictive network, run
`scripts/run_webcam.py` or `scripts/enroll.py` once somewhere with normal
internet access to warm the cache.

## 5. How to start the webcam recognition service

```powershell
python scripts\run_webcam.py
```

This opens the default webcam (`CAMERA_SOURCE=0`), shows a live preview with
bounding boxes (green = recognized, red = unknown) and an FPS counter, and
prints/logs a decision for every detected face. Press **Q** in the preview
window to quit.

Set `LOG_LEVEL=DEBUG` in `.env` to see the full per-face trace:

```text
[DETECT] Face detected det_score=0.993
[MATCH] Best match: Ali
[MATCH] Confidence: 0.870
[DECIDE] Recognized - above threshold 0.50
[GATE STUB] GATE WOULD OPEN for Ali
```

## 6. How to enroll a family member

```powershell
python scripts\enroll.py --name Ali --samples 8
```

A preview window opens. Press **SPACE** to capture a sample (vary your
angle/distance/lighting a little between captures — that's the point of
taking 5–10 samples instead of one) and **Q** to stop early. Re-running the
same command later resumes toward the target instead of starting over — it
counts what's already on disk for that name.

The script rejects a capture (without counting it) if it sees zero faces or
more than one face in the frame, so you don't accidentally enroll the wrong
person or an empty frame.

## 7. Where embeddings are stored

`data/embeddings/<member_name>/embedding_001.npy`, `embedding_002.npy`, …

Each enrolled sample is stored as its own file rather than being averaged
into one vector, so matching (`app/matcher.py`) can compare a live face
against every captured angle/lighting condition and keep the best score.
This directory is gitignored — it contains biometric data and should never
be committed.

## 8. How to configure the recognition threshold

Set `RECOGNITION_THRESHOLD` in `recognition/.env` (default: `0.50`, a
starting value only — see `app/config.py`). The decision rule
(`app/recognizer.py`):

```text
confidence >= threshold  -> recognized (shows the member's name, gate trigger runs)
confidence <  threshold  -> Unknown    (gate trigger is skipped)
```

Don't guess a final value — run `scripts/evaluate_thresholds.py` (Section 10
below) against a real test set before treating any threshold as settled.

## 9. How the gate stub works

`app/gate_trigger.py` defines a `GateTrigger` abstract interface and a
Phase 0 `StubGateTrigger` implementation. It **never touches hardware.** On
a recognized match it:

1. Logs `[GATE STUB] GATE WOULD OPEN for <name>`, the confidence, and a
   timestamp.
2. Writes an `access_granted` / `gate_stub` row to the local SQLite access
   log (`data/logs/access_log.sqlite3`).
3. Suppresses repeat triggers for the same person within
   `GATE_COOLDOWN_SECONDS` (default 12s) so a face lingering in frame
   doesn't fire on every frame.

Unknown faces and cooldown-suppressed recognitions are also logged (throttled
the same way) as `access_denied` / `none`, so the log reflects what the
camera saw even when no gate action happened.

Phase 3 will add a `RelayGateTrigger`/`Esp32GateTrigger` implementing the
same `GateTrigger` interface and swap it in — `run_webcam.py` and
`recognizer.py` don't need to change.

## 10. How to run the recognition tests

Unit tests (`recognition/tests/`) use fake detectors and temp directories —
**no camera and no InsightFace model download required.** Run:

```powershell
pip install -r requirements.txt   # includes pytest
pytest
```

For an actual accuracy sanity check (does require the InsightFace model and
some real photos), first enroll at least one member, then add test images:

```text
recognition/data/test_set/known/Ali/*.jpg      # a few different photos of Ali
recognition/data/test_set/unknown/*.jpg        # photos of people NOT enrolled
```

and run:

```powershell
python scripts\evaluate_thresholds.py
```

This prints known-faces-recognized / unknown-faces-rejected / false-accepts /
false-rejects for a range of thresholds and recommends a starting value,
favoring zero false accepts (letting in a stranger is worse than asking a
family member to use the manual override once).

**Test images need real scene context, not tight face-only crops.** The
detector was verified during development to reliably find a face in a normal
photo (face + some surrounding background/shoulders), but to reliably fail
on a millimeter-tight crop of just the face — RetinaFace relies on scale/
context cues from the surrounding scene. This isn't a bug to fix; it just
means your `known/<name>/*.jpg` and `unknown/*.jpg` files should look like
ordinary photos, the same way a webcam frame would, not pre-cropped
headshots.

## 11. Known limitations

- **No face tracking across frames.** Each frame's detections are
  independent; there is no identity-tracking between frames. A person
  standing at the gate is simply re-recognized every frame (subject to the
  gate/log cooldown), which is sufficient for Phase 0 but not a general
  multi-camera tracking solution.
- **Threshold is a starting point, not validated.** `evaluate_thresholds.py`
  works on a small, self-selected test set. Real accuracy — different
  lighting, distances, masks/sunglasses, motion blur — is only validated in
  Phase 5's shadow-mode field trial (README Section 2.6).
- **Requires internet on first run** to download InsightFace model weights.
- **No liveness/anti-spoofing.** A printed photo held up to the camera can
  currently be matched like a real face; this is listed as a future feature
  in README Section 8, not a Phase 0 goal.
- **Single-process, no auto-restart.** systemd hardening is Phase 4
  (README Section 2.5) — closing the preview window or a crash simply stops
  recognition until it's started again.
- **Local storage only.** Embeddings are `.npy` files and the access log is
  SQLite; both are replaced/migrated in Phase 1 once PostgreSQL is
  introduced.
