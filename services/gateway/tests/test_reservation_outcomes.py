import pytest

from switchroute.quota.models import QuotaObservation
from switchroute.routing.state import MemoryRoutingState


@pytest.mark.asyncio
async def test_cancellation_before_upstream_releases_reserved_capacity() -> None:
    state = MemoryRoutingState()
    key = "connection:model"
    await state.observe_quota(
        key,
        [QuotaObservation("concurrency", limit=1, remaining=1, source="exact")],
    )
    reservation = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=50,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert reservation is not None
    await state.reconcile(
        reservation,
        attempted=False,
        actual_tokens=None,
        actual_cost_microusd=None,
    )
    retry = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=50,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert retry is not None


@pytest.mark.asyncio
async def test_cancellation_after_upstream_attempt_reconciles_known_capacity() -> None:
    state = MemoryRoutingState()
    key = "connection:model"
    await state.observe_quota(
        key,
        [QuotaObservation("rpm", limit=1, remaining=1, source="observed")],
    )
    reservation = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=50,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert reservation is not None
    await state.reconcile(
        reservation,
        attempted=True,
        actual_tokens=None,
        actual_cost_microusd=None,
    )
    assert (await state.snapshot(key)).quota.rpm.remaining == 0


@pytest.mark.asyncio
async def test_free_capacity_scope_survives_hot_state_observation() -> None:
    state = MemoryRoutingState()
    key = "connection:model"
    await state.observe_quota(
        key,
        [
            QuotaObservation(
                "rpd",
                limit=100,
                remaining=50,
                source="exact",
                capacity="free",
            )
        ],
    )
    snapshot = await state.snapshot(key)
    assert snapshot.quota.rpd.capacity == "free"
    assert snapshot.quota.has_confirmed_free_capacity is True
