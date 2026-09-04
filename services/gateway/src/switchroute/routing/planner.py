from collections.abc import Callable
from typing import Protocol
from uuid import UUID

from switchroute.budget.cost import cost_microusd, estimate_request_tokens
from switchroute.budget.policy import BudgetPolicy, is_free_candidate, paid_policy_reason
from switchroute.domain import VirtualKeyContext
from switchroute.errors import ROUTE_UNAVAILABLE, UNSUPPORTED_CAPABILITY, SwitchRouteError
from switchroute.health.circuit_breaker import CircuitState
from switchroute.routing.context import ExcludedCandidate, PlanCandidate, RoutingPlan
from switchroute.routing.requirements import capability_reason, infer_requirements
from switchroute.routing.state import RoutingState, TargetState, target_key
from switchroute.routing.strategies import balanced, cheapest, fastest, free_first, priority, quota_aware

StrategyFn = Callable[[list[PlanCandidate]], list[PlanCandidate]]
STRATEGIES: dict[str, StrategyFn] = {
    "priority": priority.order,
    "free_first": free_first.order,
    "quota_aware": quota_aware.order,
    "fastest": fastest.order,
    "cheapest": cheapest.order,
    "balanced": balanced.order,
}


class PaidSpendRepository(Protocol):
    async def paid_spend_today(self, workspace_id: UUID, route_id: UUID) -> int: ...


class RoutingPlanner:
    def __init__(self, state: RoutingState, repository: PaidSpendRepository) -> None:
        self.state = state
        self.repository = repository

    async def plan(self, context: VirtualKeyContext, payload: dict) -> RoutingPlan:
        requirements = infer_requirements(payload)
        input_tokens, output_tokens = estimate_request_tokens(payload)
        policy = BudgetPolicy(context.paid_fallback, context.daily_paid_cap_microusd)  # type: ignore[arg-type]
        effective = context.strategy if context.strategy in STRATEGIES else "priority"
        degraded_reason: str | None = None
        if not self.state.available and effective != "priority":
            effective = "priority"
            degraded_reason = "redis_unavailable_priority_safe"

        durable_spend = 0
        if context.daily_paid_cap_microusd is not None:
            durable_spend = int(
                await self.repository.paid_spend_today(
                    context.workspace_id, context.route_id
                )
            )

        eligible: list[PlanCandidate] = []
        excluded: list[ExcludedCandidate] = []
        capability_exclusions = 0
        for candidate in context.candidates:
            reason = capability_reason(
                candidate.capabilities,
                candidate.metadata_provenance,
                requirements.capabilities,
            )
            if reason:
                capability_exclusions += 1
                excluded.append(
                    ExcludedCandidate(candidate.provider_kind, candidate.model_id, reason)
                )
                continue
            reason = paid_policy_reason(candidate, policy)
            if reason:
                excluded.append(
                    ExcludedCandidate(candidate.provider_kind, candidate.model_id, reason)
                )
                continue
            try:
                state = await self.state.snapshot(target_key(candidate))
            except RuntimeError:
                state = TargetState()
                if effective != "priority":
                    effective = "priority"
                degraded_reason = "redis_unavailable_priority_safe"
            if (
                state.health.circuit_state is CircuitState.OPEN
                and not state.health.routable()
            ):
                excluded.append(
                    ExcludedCandidate(
                        candidate.provider_kind, candidate.model_id, "circuit_open"
                    )
                )
                continue
            if state.quota.exhausted:
                excluded.append(
                    ExcludedCandidate(
                        candidate.provider_kind, candidate.model_id, "quota_exhausted"
                    )
                )
                continue
            expected_cost = cost_microusd(candidate, input_tokens, output_tokens)
            paid = not is_free_candidate(candidate)
            if (
                paid
                and context.daily_paid_cap_microusd is not None
                and expected_cost is None
            ):
                excluded.append(
                    ExcludedCandidate(
                        candidate.provider_kind, candidate.model_id, "budget_unknown_cost"
                    )
                )
                continue
            eligible.append(
                PlanCandidate(
                    candidate=candidate,
                    state=state,
                    expected_input_tokens=input_tokens,
                    expected_output_tokens=output_tokens,
                    expected_cost_microusd=expected_cost,
                    paid=paid,
                )
            )

        if not eligible:
            if capability_exclusions and capability_exclusions == len(context.candidates):
                raise SwitchRouteError(
                    UNSUPPORTED_CAPABILITY,
                    "No Route target has confirmed support for the request capabilities.",
                    400,
                )
            raise SwitchRouteError(
                ROUTE_UNAVAILABLE,
                "No eligible Route target is currently available.",
                503,
            )

        order = STRATEGIES[effective]
        if context.paid_fallback == "after_free":
            free = order([item for item in eligible if not item.paid])
            paid_items = order([item for item in eligible if item.paid])
            ordered = free + paid_items
        else:
            ordered = order(eligible)
        return RoutingPlan(
            requested_strategy=context.strategy,
            effective_strategy=effective,
            candidates=ordered,
            excluded=excluded[:12],
            degraded_reason=degraded_reason,
            durable_paid_spend_microusd=durable_spend,
        )

    async def reserve(
        self, context: VirtualKeyContext, plan: RoutingPlan, item: PlanCandidate
    ):
        if (
            not self.state.available
            and item.paid
            and context.daily_paid_cap_microusd is not None
        ):
            return None
        return await self.state.reserve(
            key=target_key(item.candidate),
            route_key=str(context.route_id),
            expected_tokens=item.expected_tokens,
            expected_cost_microusd=item.expected_cost_microusd,
            paid=item.paid,
            daily_paid_cap_microusd=context.daily_paid_cap_microusd,
            durable_paid_spend_microusd=plan.durable_paid_spend_microusd,
        )
