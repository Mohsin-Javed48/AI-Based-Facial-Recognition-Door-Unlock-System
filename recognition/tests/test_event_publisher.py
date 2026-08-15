import json
from unittest.mock import MagicMock, patch

from app.event_publisher import RecognitionEventPublisher


def test_publish_recognized_sends_expected_payload():
    with patch("app.event_publisher.redis.Redis.from_url") as from_url:
        client = MagicMock()
        from_url.return_value = client
        publisher = RecognitionEventPublisher("redis://localhost:6380", "gate:recognition-events")

        publisher.publish_recognized("Ali", 0.9, "snap.jpg")

        assert client.publish.called
        channel, payload = client.publish.call_args[0]
        assert channel == "gate:recognition-events"
        data = json.loads(payload)
        assert data == {
            "eventType": "FACE_RECOGNIZED",
            "name": "Ali",
            "confidence": 0.9,
            "snapshotPath": "snap.jpg",
            "timestamp": data["timestamp"],
        }
        assert data["timestamp"]


def test_publish_unknown_sends_a_null_name():
    with patch("app.event_publisher.redis.Redis.from_url") as from_url:
        client = MagicMock()
        from_url.return_value = client
        publisher = RecognitionEventPublisher("redis://localhost:6380", "gate:recognition-events")

        publisher.publish_unknown(0.3, "snap.jpg")

        _, payload = client.publish.call_args[0]
        data = json.loads(payload)
        assert data["eventType"] == "FACE_UNKNOWN"
        assert data["name"] is None
        assert data["confidence"] == 0.3


def test_does_not_raise_when_redis_client_creation_fails():
    with patch("app.event_publisher.redis.Redis.from_url", side_effect=RuntimeError("boom")):
        publisher = RecognitionEventPublisher("redis://bad-host", "chan")

        publisher.publish_recognized("Ali", 0.9, "snap.jpg")  # must not raise


def test_does_not_raise_when_the_publish_call_itself_fails():
    with patch("app.event_publisher.redis.Redis.from_url") as from_url:
        client = MagicMock()
        client.publish.side_effect = RuntimeError("connection refused")
        from_url.return_value = client
        publisher = RecognitionEventPublisher("redis://localhost:6380", "chan")

        publisher.publish_recognized("Ali", 0.9, "snap.jpg")  # must not raise
