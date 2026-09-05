import asyncio
import os

import pytest

from switchroute.quota.models import QuotaObservation
from switchroute.routing.redis_state import RedisRoutingState, create_routing_state


@pytest.mark.asyncio
async def test_real_redis_reservation_race_when_ci_service_available() -> None:
    url = os.getenv("REDIS_TEST_URL")
    if not url:
        pytest.skip("REDIS_TEST_URL is not configured")
    state = await create_routing_state(url)
    assert isinstance(state, RedisRoutingState)
    key = "integration:provider:model"
    await state.observe_quota(key, [QuotaObservation("rpm", limit=10, remaining=1)])

    async def reserve():
        return await state.reserve(
            key=key,
            route_key="integration-route",
            expected_tokens=5,
            expected_cost_microusd=None,
            paid=False,
            daily_paid_cap_microusd=None,
            durable_paid_spend_microusd=0,
            ttl_seconds=5,
        )

    try:
        one, two = await asyncio.gather(reserve(), reserve())
        assert sum(item is not None for item in (one, two)) == 1
        for reservation in (one, two):
            if reservation:
                await state.reconcile(
                    reservation,
                    attempted=False,
                    actual_tokens=None,
                    actual_cost_microusd=None,
                )
    finally:
        await state.close()


@pytest.mark.asyncio
async def test_real_redis_concurrency_releases_after_reconcile() -> None:
    url = os.getenv("REDIS_TEST_URL")
    if not url:
        pytest.skip("REDIS_TEST_URL is not configured")
    state = await create_routing_state(url)
    assert isinstance(state, RedisRoutingState)
    key = "integration:concurrency:model"
    await state.observe_quota(
        key,
        [QuotaObservation("concurrency", limit=1, remaining=1, source="observed")],
    )

    try:
        first = await state.reserve(
            key=key,
            route_key="integration-concurrency-route",
            expected_tokens=5,
            expected_cost_microusd=None,
            paid=False,
            daily_paid_cap_microusd=None,
            durable_paid_spend_microusd=0,
            ttl_seconds=5,
        )
        assert first is not None
        blocked = await state.reserve(
            key=key,
            route_key="integration-concurrency-route",
            expected_tokens=5,
            expected_cost_microusd=None,
            paid=False,
            daily_paid_cap_microusd=None,
            durable_paid_spend_microusd=0,
            ttl_seconds=5,
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
            route_key="integration-concurrency-route",
            expected_tokens=5,
            expected_cost_microusd=None,
            paid=False,
            daily_paid_cap_microusd=None,
            durable_paid_spend_microusd=0,
            ttl_seconds=5,
        )
        assert again is not None
        await state.reconcile(
            again,
            attempted=False,
            actual_tokens=None,
            actual_cost_microusd=None,
        )
    finally:
        await state.close()
