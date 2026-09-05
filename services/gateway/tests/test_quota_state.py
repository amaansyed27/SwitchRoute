import asyncio

import pytest

from switchroute.health.circuit_breaker import CircuitBreaker, CircuitState, HealthSnapshot, ewma
from switchroute.quota.headers import parse_rate_limit_headers
from switchroute.quota.models import QuotaObservation
from switchroute.routing.state import MemoryRoutingState


@pytest.mark.asyncio
async def test_quota_provenance_exact_observed_estimated_catalog_unknown() -> None:
    state = MemoryRoutingState()
    key = "provider:model"
    for source in ("exact", "observed", "estimated", "catalog"):
        await state.observe_quota(
            key, [QuotaObservation("rpm", limit=10, remaining=9, source=source, confidence=0.8)]
        )
        snapshot = await state.snapshot(key)
        assert snapshot.quota.rpm.source == source
        assert snapshot.quota.rpm.confidence == 0.8
    unknown = await state.snapshot("unknown:model")
    assert unknown.quota.rpm.source == "unknown"
    assert unknown.quota.rpm.remaining is None


def test_provider_header_parsers_are_whitelisted() -> None:
    observed = parse_rate_limit_headers(
        "openai",
        {
            "x-ratelimit-limit-requests": "30",
            "x-ratelimit-remaining-requests": "12",
            "x-ratelimit-reset-requests": "2s",
            "authorization": "must-not-survive",
        },
    )
    assert len(observed) == 1
    assert observed[0].metric == "rpm"
    assert observed[0].remaining == 12
    anthropic = parse_rate_limit_headers(
        "anthropic",
        {
            "anthropic-ratelimit-requests-limit": "50",
            "anthropic-ratelimit-requests-remaining": "49",
        },
    )
    assert anthropic[0].metric == "rpm"


@pytest.mark.asyncio
async def test_atomic_reservation_prevents_double_consuming_one_remaining() -> None:
    state = MemoryRoutingState()
    key = "provider:model"
    await state.observe_quota(key, [QuotaObservation("rpm", limit=10, remaining=1)])

    async def reserve():
        return await state.reserve(
            key=key,
            route_key="route",
            expected_tokens=10,
            expected_cost_microusd=None,
            paid=False,
            daily_paid_cap_microusd=None,
            durable_paid_spend_microusd=0,
        )

    first, second = await asyncio.gather(reserve(), reserve())
    assert sum(item is not None for item in (first, second)) == 1


@pytest.mark.asyncio
async def test_concurrency_is_reserved_in_flight_and_released_after_reconcile() -> None:
    state = MemoryRoutingState()
    key = "provider:model"
    await state.observe_quota(
        key,
        [QuotaObservation("concurrency", limit=1, remaining=1, source="observed")],
    )
    first = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=10,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert first is not None
    blocked = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=10,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert blocked is None

    await state.reconcile(
        first,
        attempted=True,
        actual_tokens=3,
        actual_cost_microusd=None,
    )
    snapshot = await state.snapshot(key)
    assert snapshot.quota.concurrency.remaining == 1
    again = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=10,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert again is not None


@pytest.mark.asyncio
async def test_reservation_ttl_releases_capacity() -> None:
    state = MemoryRoutingState()
    key = "provider:model"
    await state.observe_quota(key, [QuotaObservation("rpm", limit=1, remaining=1)])
    first = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=1,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
        ttl_seconds=0,
    )
    assert first is not None
    second = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=1,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert second is not None


@pytest.mark.asyncio
async def test_reconciliation_success_failure_and_unattempted_release() -> None:
    state = MemoryRoutingState()
    key = "provider:model"
    await state.observe_quota(key, [QuotaObservation("rpm", limit=5, remaining=5)])
    reservation = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=10,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert reservation
    await state.reconcile(reservation, attempted=False, actual_tokens=None, actual_cost_microusd=None)
    assert (await state.snapshot(key)).quota.rpm.remaining == 5

    reservation = await state.reserve(
        key=key,
        route_key="route",
        expected_tokens=10,
        expected_cost_microusd=None,
        paid=False,
        daily_paid_cap_microusd=None,
        durable_paid_spend_microusd=0,
    )
    assert reservation
    await state.reconcile(reservation, attempted=True, actual_tokens=3, actual_cost_microusd=None)
    assert (await state.snapshot(key)).quota.rpm.remaining == 4


@pytest.mark.asyncio
async def test_daily_paid_cap_is_reserved_atomically() -> None:
    state = MemoryRoutingState()

    async def reserve(route: str):
        return await state.reserve(
            key=f"provider:{route}",
            route_key="route",
            expected_tokens=100,
            expected_cost_microusd=1_500_000,
            paid=True,
            daily_paid_cap_microusd=2_000_000,
            durable_paid_spend_microusd=0,
        )

    one, two = await asyncio.gather(reserve("a"), reserve("b"))
    assert sum(item is not None for item in (one, two)) == 1


def test_circuit_breaker_open_half_open_recovery_and_ewma() -> None:
    breaker = CircuitBreaker(threshold=2, cooldown_seconds=0)
    snapshot = HealthSnapshot()
    breaker.after_failure(snapshot, "provider_timeout")
    assert snapshot.circuit_state is CircuitState.CLOSED
    breaker.after_failure(snapshot, "provider_unavailable")
    assert snapshot.circuit_state is CircuitState.OPEN
    breaker.before_probe(snapshot)
    assert snapshot.circuit_state is CircuitState.HALF_OPEN
    breaker.after_success(snapshot)
    assert snapshot.circuit_state is CircuitState.CLOSED
    assert snapshot.consecutive_failures == 0
    assert ewma(100, 200, 0.25) == 125


def test_auth_failure_does_not_trip_temporary_circuit() -> None:
    breaker = CircuitBreaker(threshold=1)
    snapshot = HealthSnapshot()
    breaker.after_failure(snapshot, "provider_auth_error")
    assert snapshot.circuit_state is CircuitState.CLOSED
