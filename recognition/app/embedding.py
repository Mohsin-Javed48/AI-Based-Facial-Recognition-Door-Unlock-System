"""Pure embedding-vector utilities - no model loading here.

Kept separate from ``detector.py`` (owns the InsightFace model) and
``matcher.py`` (owns "compare against every enrolled member") so each module
has exactly one responsibility.
"""

from __future__ import annotations

import numpy as np


def normalize(embedding: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return embedding
    return embedding / norm


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    a_n, b_n = normalize(a), normalize(b)
    return float(np.dot(a_n, b_n))
