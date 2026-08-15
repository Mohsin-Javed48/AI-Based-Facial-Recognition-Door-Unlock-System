"""Publishes recognition events to Redis for the Phase 1 NestJS backend.

Phase 0 keeps working standalone even if Redis or the backend aren't
running - connection/publish failures are logged and swallowed here, never
raised into the recognition loop (README Section 20 Rule 2: this service
stays responsible for capture/detection/embedding/matching/confidence only;
it must not become dependent on Phase 1 infrastructure to function).
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

import redis

logger = logging.getLogger("event_publisher")


class RecognitionEventPublisher:
    def __init__(self, redis_url: str, channel: str) -> None:
        self._channel = channel
        try:
            self._client: redis.Redis | None = redis.Redis.from_url(
                redis_url, socket_connect_timeout=2
            )
        except Exception as exc:  # noqa: BLE001 - see module docstring
            logger.warning("Could not create Redis client for %s: %s", redis_url, exc)
            self._client = None

    def publish_recognized(self, name: str, confidence: float, snapshot_path: str) -> None:
        self._publish("FACE_RECOGNIZED", name, confidence, snapshot_path)

    def publish_unknown(self, confidence: float, snapshot_path: str) -> None:
        self._publish("FACE_UNKNOWN", None, confidence, snapshot_path)

    def _publish(
        self, event_type: str, name: str | None, confidence: float, snapshot_path: str
    ) -> None:
        if self._client is None:
            return
        payload = {
            "eventType": event_type,
            "name": name,
            "confidence": confidence,
            "snapshotPath": snapshot_path,
            "timestamp": datetime.now(UTC).isoformat(),
        }
        try:
            self._client.publish(self._channel, json.dumps(payload))
        except Exception as exc:  # noqa: BLE001 - see module docstring
            logger.warning("Failed to publish recognition event to Redis: %s", exc)
