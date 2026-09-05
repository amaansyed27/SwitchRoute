from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from switchroute.domain import Candidate
from switchroute.quota.models import QuotaObservation
from switchroute.routing.context import PlanCandidate
from switchroute.routing.state import MemoryRoutingState, TargetState
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


@pytest.mark.asyncio
async def test_expired_quota_remaining_becomes_unknown_and_can_probe_again() -> None:
    state = MemoryRoutingState()
    key = "provider:expired-window"
    reset_at = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
    await state.observe_quota(
        key,
        [QuotaObservation("rpm", limit=10, remaining=0, reset_at=reset_at)],
    )
    snapshot = await state.snapshot(key)
    assert snapshot.quota.rpm.remaining is None
    assert snapshot.quota.exhausted is False
    reservation = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=1,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert reservation is not None


def test_free_capacity_requires_positive_remaining_not_only_a_limit() -> None:
    state = TargetState()
    state.quota.rpm.limit = 100
    state.quota.rpm.capacity = "free"
    assert state.quota.has_confirmed_free_capacity is False
    state.quota.rpm.remaining = 1
    assert state.quota.has_confirmed_free_capacity is True


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
