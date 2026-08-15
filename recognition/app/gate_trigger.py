"""Gate-trigger interface + Phase 0 stub implementation.

Phase 3 replaces ``StubGateTrigger`` with a real relay/ESP32 implementation
behind the same ``GateTrigger`` interface - the recognition loop that calls
``trigger()`` does not need to change.
"""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime

from app.storage import AccessLogStore

logger = logging.getLogger("gate_trigger")


class GateTrigger(ABC):
    @abstractmethod
    def trigger(self, member_name: str, confidence: float) -> bool:
        """Attempt to open the gate for a recognized member.

        Returns True if the trigger actually fired, False if it was
        suppressed (e.g. by the cooldown).
        """


class StubGateTrigger(GateTrigger):
    """Phase 0: never touches hardware.

    Logs and records the event, and debounces repeated triggers for the same
    person within ``cooldown_seconds`` so one visit doesn't fire on every
    frame.
    """

    def __init__(self, log_store: AccessLogStore, cooldown_seconds: float) -> None:
        self._log_store = log_store
        self._cooldown_seconds = cooldown_seconds
        self._last_trigger_at: dict[str, float] = {}

    def _in_cooldown(self, member_name: str) -> bool:
        last = self._last_trigger_at.get(member_name)
        return last is not None and (time.monotonic() - last) < self._cooldown_seconds

    def trigger(self, member_name: str, confidence: float) -> bool:
        if self._in_cooldown(member_name):
            logger.debug(
                "[GATE STUB] Suppressed repeat trigger for %s (cooldown active)", member_name
            )
            return False

        self._last_trigger_at[member_name] = time.monotonic()
        timestamp = datetime.now(UTC).isoformat()
        logger.info("[GATE STUB] GATE WOULD OPEN for %s", member_name)
        logger.info("[GATE STUB] confidence=%.4f", confidence)
        logger.info("[GATE STUB] timestamp=%s", timestamp)
        self._log_store.log(
            member_name=member_name,
            confidence=confidence,
            event_type="access_granted",
            action="gate_stub",
        )
        return True
