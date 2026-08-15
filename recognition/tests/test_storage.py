import numpy as np

from app.storage import AccessLogStore, EmbeddingStore


def test_embedding_store_round_trip(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    store.save("ali", np.array([1.0, 2.0, 3.0]))
    store.save("ali", np.array([4.0, 5.0, 6.0]))
    store.save("sara", np.array([7.0, 8.0, 9.0]))

    enrolled = store.load_all()

    assert set(enrolled.keys()) == {"ali", "sara"}
    assert len(enrolled["ali"]) == 2
    assert np.array_equal(enrolled["ali"][0], np.array([1.0, 2.0, 3.0]))
    assert store.sample_count("ali") == 2
    assert store.sample_count("nobody") == 0


def test_embedding_store_load_all_on_empty_dir_returns_empty(tmp_path):
    store = EmbeddingStore(tmp_path / "embeddings")
    assert store.load_all() == {}


def test_access_log_store_log_and_recent(tmp_path):
    db_path = tmp_path / "logs" / "access_log.sqlite3"
    store = AccessLogStore(db_path)

    store.log("ali", 0.87, "access_granted", "gate_stub")
    store.log("Unknown", 0.42, "access_denied", "none")

    entries = store.recent(limit=10)

    assert len(entries) == 2
    assert entries[0].member_name == "Unknown"  # most recent first
    assert entries[1].member_name == "ali"
    assert entries[1].confidence == 0.87
