"""Environment-based configuration for the Phase 0 recognition service.

Every tunable lives here and is read from the environment (populated from
``.env`` via python-dotenv). Nothing below should be hardcoded elsewhere.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_APP_DIR = Path(__file__).resolve().parent
_RECOGNITION_ROOT = _APP_DIR.parent

# Loads recognition/.env if present; safe no-op otherwise. Real environment
# variables (e.g. set by a systemd unit in later phases) always win.
load_dotenv(_RECOGNITION_ROOT / ".env")


def _camera_source(raw: str) -> int | str:
    """Camera source may be a webcam index, a device path, or (later) an RTSP URL."""
    try:
        return int(raw)
    except ValueError:
        return raw


@dataclass(frozen=True)
class Config:
    camera_source: int | str
    insightface_model_pack: str
    insightface_det_size: int
    recognition_threshold: float
    gate_cooldown_seconds: float
    data_dir: Path
    log_level: str

    @property
    def embeddings_dir(self) -> Path:
        return self.data_dir / "embeddings"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def access_log_db_path(self) -> Path:
        return self.logs_dir / "access_log.sqlite3"


def load_config() -> Config:
    data_dir = Path(os.getenv("DATA_DIR", str(_RECOGNITION_ROOT / "data"))).resolve()
    return Config(
        camera_source=_camera_source(os.getenv("CAMERA_SOURCE", "0")),
        insightface_model_pack=os.getenv("INSIGHTFACE_MODEL_PACK", "buffalo_l"),
        insightface_det_size=int(os.getenv("INSIGHTFACE_DET_SIZE", "640")),
        recognition_threshold=float(os.getenv("RECOGNITION_THRESHOLD", "0.50")),
        gate_cooldown_seconds=float(os.getenv("GATE_COOLDOWN_SECONDS", "12")),
        data_dir=data_dir,
        log_level=os.getenv("LOG_LEVEL", "INFO"),
    )


# Process-wide config instance. Scripts import this rather than re-parsing
# the environment themselves.
CONFIG = load_config()
