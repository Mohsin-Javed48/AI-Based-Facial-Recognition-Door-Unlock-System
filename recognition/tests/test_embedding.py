import numpy as np
import pytest

from app.embedding import cosine_similarity, normalize


def test_cosine_similarity_identical_vectors_is_one():
    v = np.array([1.0, 2.0, 3.0])
    assert cosine_similarity(v, v) == pytest.approx(1.0, abs=1e-6)


def test_cosine_similarity_orthogonal_vectors_is_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert cosine_similarity(a, b) == pytest.approx(0.0, abs=1e-6)


def test_cosine_similarity_opposite_vectors_is_negative_one():
    a = np.array([1.0, 0.0])
    b = np.array([-1.0, 0.0])
    assert cosine_similarity(a, b) == pytest.approx(-1.0, abs=1e-6)


def test_normalize_zero_vector_does_not_raise():
    zero = np.zeros(3)
    assert np.array_equal(normalize(zero), zero)
