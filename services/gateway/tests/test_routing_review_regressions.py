from uuid import UUID

import pytest

from switchroute.domain import Candidate
from switchroute.routing.context import PlanCandidate
from switchroute.routing.state import TargetState
from switchroute.routing.strategies import balanced
from switchroute.storage import postgres_usage


def _candidate(number: int, position: int) -> Candidate:
    return Candidate(
        target_id=UUID(int=number),
        provider_connection_id=UUID(int=number + 100),
        provider_kind=f"p{number}",
        model_id=f"m{number}",
        billing_tier="paid",
        position=position,
        input_price_per_million_usd=1.0,
        output_price_per_million_usd=1.0,
    )


def test_balanced_prefers_known_equal_signal_over_unknown_signal() -> None:
    known = PlanCandidate(
        candidate=_candidate(1, 1),
        state=TargetState(),
        expected_input_tokens=10,
        expected_output_tokens=10,
        expected_cost_microusd=20,
        paid=True,
    )
    unknown = PlanCandidate(
        candidate=_candidate(2, 0),
        state=TargetState(),
        expected_input_tokens=10,
        expected_output_tokens=10,
        expected_cost_microusd=None,
        paid=True,
    )
    known.state.health.latency_ewma_ms = 100.0
    ordered = balanced.order([unknown, known])
    assert ordered[0].candidate.model_id == "m1"


class _Pool:
    def __init__(self) -> None:
        self.query = ""

    async def fetchval(self, query, *args):
        self.query = query
        return 450


@pytest.mark.asyncio
async def test_durable_paid_spend_counts_billable_error_rows() -> None:
    pool = _Pool()
    value = await postgres_usage.paid_spend_today(
        pool,  # type: ignore[arg-type]
        UUID(int=1),
        UUID(int=2),
    )
    assert value == 450
    normalized = " ".join(pool.query.split()).lower()
    assert "paid_routing" in normalized
    assert "estimated_cost_microusd is not null" in normalized
    assert "status='success'" not in normalized
