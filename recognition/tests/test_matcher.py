import numpy as np

from app.matcher import best_match


def test_best_match_with_no_enrolled_members_returns_none():
    result = best_match(np.array([1.0, 0.0]), enrolled={})
    assert result.member_name is None
    assert result.confidence == 0.0


def test_best_match_picks_the_closest_enrolled_member():
    query = np.array([1.0, 0.0])
    enrolled = {
        "ali": [np.array([0.9, 0.1]), np.array([0.0, 1.0])],
        "sara": [np.array([-1.0, 0.0])],
    }
    result = best_match(query, enrolled)
    assert result.member_name == "ali"
    assert result.confidence > 0.9


def test_best_match_uses_every_sample_not_an_average():
    # If samples were averaged, ali's average vector would point away from
    # the query; comparing every sample individually should still find the
    # one good match.
    query = np.array([1.0, 0.0])
    enrolled = {"ali": [np.array([1.0, 0.0]), np.array([0.0, -1.0])]}
    result = best_match(query, enrolled)
    assert result.member_name == "ali"
    assert result.confidence == 1.0
