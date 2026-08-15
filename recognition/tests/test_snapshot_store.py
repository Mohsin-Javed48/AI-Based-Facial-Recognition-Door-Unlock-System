import numpy as np

from app.storage import SnapshotStore


def test_save_creates_a_jpeg_file(tmp_path):
    store = SnapshotStore(tmp_path / "snapshots")
    frame = np.zeros((10, 10, 3), dtype=np.uint8)

    filename = store.save(frame, "Ali")

    saved_path = tmp_path / "snapshots" / filename
    assert saved_path.exists()
    assert filename.endswith("_Ali.jpg")


def test_save_sanitizes_unsafe_characters_in_label(tmp_path):
    store = SnapshotStore(tmp_path / "snapshots")
    frame = np.zeros((10, 10, 3), dtype=np.uint8)

    filename = store.save(frame, "../../etc/passwd")

    assert "/" not in filename
    assert ".." not in filename
    saved_path = tmp_path / "snapshots" / filename
    assert saved_path.exists()


def test_save_returns_a_different_filename_each_call(tmp_path):
    store = SnapshotStore(tmp_path / "snapshots")
    frame = np.zeros((10, 10, 3), dtype=np.uint8)

    first = store.save(frame, "Ali")
    second = store.save(frame, "Ali")

    assert first != second
