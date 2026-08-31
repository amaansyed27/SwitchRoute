from uuid import uuid4

from switchroute.domain import Candidate
from switchroute.routing.strategy import order_candidates


def candidate(position: int, tier: str) -> Candidate:
    return Candidate(uuid4(), uuid4(), "groq", f"model-{position}", tier, position)


def test_priority_preserves_user_order() -> None:
    result = order_candidates([candidate(2, "free"), candidate(0, "paid"), candidate(1, "unknown")], "priority")
    assert [item.position for item in result] == [0, 1, 2]


def test_free_first_prefers_free_without_losing_tier_order() -> None:
    result = order_candidates([candidate(0, "paid"), candidate(2, "free"), candidate(1, "free_capable")], "free_first")
    assert [item.billing_tier for item in result] == ["free", "free_capable", "paid"]
