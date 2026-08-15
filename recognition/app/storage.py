"""Local persistence for Phase 0: embeddings on disk, access log in SQLite.

PostgreSQL takes over the access log in Phase 1; this module is deliberately
simple so that migration is a swap, not a rewrite of calling code.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np


class EmbeddingStore:
    """One folder per enrolled member, one .npy file per captured sample."""

    def __init__(self, embeddings_dir: Path) -> None:
        self._dir = embeddings_dir
        self._dir.mkdir(parents=True, exist_ok=True)

    def save(self, member_name: str, embedding: np.ndarray) -> Path:
        member_dir = self._dir / member_name
        member_dir.mkdir(parents=True, exist_ok=True)
        existing = sorted(member_dir.glob("embedding_*.npy"))
        next_index = len(existing) + 1
        path = member_dir / f"embedding_{next_index:03d}.npy"
        np.save(path, embedding)
        return path

    def load_all(self) -> dict[str, list[np.ndarray]]:
        enrolled: dict[str, list[np.ndarray]] = {}
        if not self._dir.exists():
            return enrolled
        for member_dir in sorted(p for p in self._dir.iterdir() if p.is_dir()):
            samples = [np.load(f) for f in sorted(member_dir.glob("embedding_*.npy"))]
            if samples:
                enrolled[member_dir.name] = samples
        return enrolled

    def sample_count(self, member_name: str) -> int:
        member_dir = self._dir / member_name
        if not member_dir.exists():
            return 0
        return len(list(member_dir.glob("embedding_*.npy")))


@dataclass
class AccessLogEntry:
    timestamp: str
    member_name: str
    confidence: float
    event_type: str  # "access_granted" | "access_denied"
    action: str  # "gate_stub" | "none"


class AccessLogStore:
    """Minimal SQLite-backed access log (see README Sections 3 and 2.1)."""

    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS access_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    member_name TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    event_type TEXT NOT NULL,
                    action TEXT NOT NULL
                )
                """
            )

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self._db_path)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def log(self, member_name: str, confidence: float, event_type: str, action: str) -> AccessLogEntry:
        entry = AccessLogEntry(
            timestamp=datetime.now(UTC).isoformat(),
            member_name=member_name,
            confidence=confidence,
            event_type=event_type,
            action=action,
        )
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO access_logs (timestamp, member_name, confidence, event_type, action) "
                "VALUES (?, ?, ?, ?, ?)",
                (entry.timestamp, entry.member_name, entry.confidence, entry.event_type, entry.action),
            )
        return entry

    def recent(self, limit: int = 50) -> list[AccessLogEntry]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT timestamp, member_name, confidence, event_type, action "
                "FROM access_logs ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [AccessLogEntry(*row) for row in rows]
