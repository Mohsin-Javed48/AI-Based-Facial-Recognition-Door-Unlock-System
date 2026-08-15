import time

from app.gate_trigger import StubGateTrigger
from app.storage import AccessLogStore


def make_gate(tmp_path, cooldown_seconds):
    log_store = AccessLogStore(tmp_path / "logs" / "access_log.sqlite3")
    return StubGateTrigger(log_store, cooldown_seconds=cooldown_seconds), log_store


def test_trigger_fires_and_logs_on_first_call(tmp_path):
    gate, log_store = make_gate(tmp_path, cooldown_seconds=10)

    fired = gate.trigger("ali", 0.9)

    assert fired is True
    entries = log_store.recent()
    assert len(entries) == 1
    assert entries[0].member_name == "ali"
    assert entries[0].event_type == "access_granted"
    assert entries[0].action == "gate_stub"


def test_repeated_trigger_within_cooldown_is_suppressed(tmp_path):
    gate, log_store = make_gate(tmp_path, cooldown_seconds=10)

    gate.trigger("ali", 0.9)
    fired_again = gate.trigger("ali", 0.9)

    assert fired_again is False
    assert len(log_store.recent()) == 1  # no second log entry


def test_trigger_fires_again_after_cooldown_expires(tmp_path):
    gate, log_store = make_gate(tmp_path, cooldown_seconds=0.05)

    gate.trigger("ali", 0.9)
    time.sleep(0.06)
    fired_again = gate.trigger("ali", 0.9)

    assert fired_again is True
    assert len(log_store.recent()) == 2


def test_cooldown_is_tracked_independently_per_member(tmp_path):
    gate, log_store = make_gate(tmp_path, cooldown_seconds=10)

    fired_ali = gate.trigger("ali", 0.9)
    fired_sara = gate.trigger("sara", 0.8)

    assert fired_ali is True
    assert fired_sara is True
    assert len(log_store.recent()) == 2
