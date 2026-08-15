"""Compare a query embedding against every enrolled member's embeddings."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.embedding import cosine_similarity


@dataclass
class MatchResult:
    member_name: str | None  # None only when nothing is enrolled yet
    confidence: float


def best_match(query_embedding: np.ndarray, enrolled: dict[str, list[np.ndarray]]) -> MatchResult:
    """Find the enrolled member whose embedding is most similar to the query.

    Compares against every sample of every member and keeps the single best
    score - a member enrolled with 10 photos is represented by 10 vectors,
    not one averaged vector, so different angles/lighting each get a fair
    shot at matching.
    """
    best_name: str | None = None
    best_score = -1.0
    for name, embeddings in enrolled.items():
        for candidate in embeddings:
            score = cosine_similarity(query_embedding, candidate)
            if score > best_score:
                best_score = score
                best_name = name
    if best_name is None:
        return MatchResult(member_name=None, confidence=0.0)
    return MatchResult(member_name=best_name, confidence=best_score)
