from uuid import UUID

import pytest

from switchroute.domain import Candidate, VirtualKeyContext
from switchroute.errors import SwitchRouteError
from switchroute.quota.models import QuotaObservation
from switchroute.routing.planner import RoutingPlanner
from switchroute.routing.state import MemoryRoutingState, UnavailableRoutingState, target_key


class Repo:
    async def paid_spend_today(self, workspace_id, route_id):
        return 0


def candidate(
    number: int,
    tier: str,
    position: int,
    *,
    price: float | None = None,
    capabilities: tuple[str, ...] = ("chat", "streaming", "tools", "vision", "structured_output"),
) -> Candidate:
    return Candidate(
        target_id=UUID(int=number),
        provider_connection_id=UUID(int=number + 100),
        provider_kind=f"p{number}",
        model_id=f"m{number}",
        billing_tier=tier,
        position=position,
        capabilities=capabilities,
        metadata_provenance="provider",
        input_price_per_million_usd=price,
        output_price_per_million_usd=price,
    )


def context(strategy: str, candidates: list[Candidate], *, paid_fallback="allowed", cap=None):
    return VirtualKeyContext(
        key_id=UUID(int=1),
        workspace_id=UUID(int=2),
        route_id=UUID(int=3),
        route_name="R",
        route_slug="r",
        strategy=strategy,
        route_enabled=True,
        candidates=candidates,
        paid_fallback=paid_fallback,
        daily_paid_cap_microusd=cap,
    )


@pytest.mark.asyncio
async def test_priority_preserves_order() -> None:
    items = [candidate(1, "paid", 1, price=2), candidate(2, "free", 0, price=0)]
    plan = await RoutingPlanner(MemoryRoutingState(), Repo()).plan(context("priority", items), {"messages": []})
    assert [item.candidate.model_id for item in plan.candidates] == ["m2", "m1"]


@pytest.mark.asyncio
async def test_free_first_uses_live_free_capable_quota() -> None:
    state = MemoryRoutingState()
    free_capable = candidate(1, "free_capable", 1, price=0)
    free = candidate(2, "free", 2, price=0)
    paid = candidate(3, "paid", 0, price=1)
    await state.observe_quota(
        target_key(free_capable),
        [QuotaObservation("rpm", limit=30, remaining=20, source="observed")],
    )
    plan = await RoutingPlanner(state, Repo()).plan(
        context("free_first", [paid, free_capable, free]), {"messages": []}
    )
    assert [item.candidate.billing_tier for item in plan.candidates] == ["free", "free_capable", "paid"]


@pytest.mark.asyncio
async def test_quota_aware_prefers_more_usable_known_capacity() -> None:
    state = MemoryRoutingState()
    low = candidate(1, "paid", 0, price=1)
    high = candidate(2, "paid", 1, price=1)
    await state.observe_quota(target_key(low), [QuotaObservation("rpm", limit=100, remaining=10)])
    await state.observe_quota(target_key(high), [QuotaObservation("rpm", limit=100, remaining=80)])
    plan = await RoutingPlanner(state, Repo()).plan(context("quota_aware", [low, high]), {"messages": []})
    assert plan.candidates[0].candidate.model_id == "m2"


@pytest.mark.asyncio
async def test_fastest_uses_ewma_and_unknown_is_not_fastest() -> None:
    state = MemoryRoutingState()
    slow = candidate(1, "paid", 0, price=1)
    fast = candidate(2, "paid", 1, price=1)
    cold = candidate(3, "paid", 2, price=1)
    for latency in (220, 200, 210):
        await state.observe_success(target_key(slow), latency)
    for latency in (80, 90, 70):
        await state.observe_success(target_key(fast), latency)
    plan = await RoutingPlanner(state, Repo()).plan(context("fastest", [slow, cold, fast]), {"messages": []})
    assert [item.candidate.model_id for item in plan.candidates] == ["m2", "m1", "m3"]
    assert plan.candidates[0].state.health.latency_confidence == "medium"


@pytest.mark.asyncio
async def test_cheapest_uses_known_price_and_unknown_cost_loses() -> None:
    known = candidate(1, "paid", 1, price=0.5)
    unknown = candidate(2, "unknown", 0, price=None)
    expensive = candidate(3, "paid", 2, price=4)
    plan = await RoutingPlanner(MemoryRoutingState(), Repo()).plan(
        context("cheapest", [unknown, expensive, known]), {"messages": [{"role": "user", "content": "hello"}]}
    )
    assert [item.candidate.model_id for item in plan.candidates] == ["m1", "m3", "m2"]


@pytest.mark.asyncio
async def test_balanced_prefers_operationally_better_candidate() -> None:
    state = MemoryRoutingState()
    weak = candidate(1, "paid", 0, price=5)
    strong = candidate(2, "paid", 1, price=1)
    await state.observe_quota(target_key(weak), [QuotaObservation("rpm", limit=100, remaining=20)])
    await state.observe_quota(target_key(strong), [QuotaObservation("rpm", limit=100, remaining=90)])
    await state.observe_success(target_key(weak), 300)
    await state.observe_success(target_key(strong), 80)
    plan = await RoutingPlanner(state, Repo()).plan(context("balanced", [weak, strong]), {"messages": []})
    assert plan.candidates[0].candidate.model_id == "m2"


@pytest.mark.asyncio
async def test_capability_filtering_is_conservative() -> None:
    plain = candidate(1, "free", 0, price=0, capabilities=("chat", "streaming"))
    with pytest.raises(SwitchRouteError) as raised:
        await RoutingPlanner(MemoryRoutingState(), Repo()).plan(
            context("priority", [plain]),
            {"messages": [], "tools": [{"type": "function"}]},
        )
    assert raised.value.code == "unsupported_capability"


@pytest.mark.asyncio
async def test_paid_fallback_never_and_after_free() -> None:
    free = candidate(1, "free", 1, price=0)
    paid = candidate(2, "paid", 0, price=1)
    never = await RoutingPlanner(MemoryRoutingState(), Repo()).plan(
        context("priority", [paid, free], paid_fallback="never"), {"messages": []}
    )
    assert [item.candidate.model_id for item in never.candidates] == ["m1"]
    after = await RoutingPlanner(MemoryRoutingState(), Repo()).plan(
        context("priority", [paid, free], paid_fallback="after_free"), {"messages": []}
    )
    assert [item.candidate.model_id for item in after.candidates] == ["m1", "m2"]


@pytest.mark.asyncio
async def test_paid_cap_rejects_unknown_cost() -> None:
    unknown = candidate(1, "unknown", 0, price=None)
    with pytest.raises(SwitchRouteError):
        await RoutingPlanner(MemoryRoutingState(), Repo()).plan(
            context("priority", [unknown], cap=2_000_000), {"messages": []}
        )


@pytest.mark.asyncio
async def test_redis_unavailable_degrades_advanced_strategy_to_priority() -> None:
    first = candidate(1, "free", 0, price=0)
    second = candidate(2, "free", 1, price=0)
    plan = await RoutingPlanner(UnavailableRoutingState(), Repo()).plan(
        context("fastest", [first, second], paid_fallback="never"), {"messages": []}
    )
    assert plan.effective_strategy == "priority"
    assert plan.degraded_reason == "redis_unavailable_priority_safe"
    assert [item.candidate.model_id for item in plan.candidates] == ["m1", "m2"]
