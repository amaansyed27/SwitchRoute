from typing import Any
from uuid import UUID

from switchroute.budget.cost import cost_microusd
from switchroute.domain import UsageRecord, VirtualKeyContext
from switchroute.routing.context import PlanCandidate, RoutingPlan
from switchroute.storage.contracts import Repository


class RoutingActivity:
    def __init__(self, repository: Repository) -> None:
        self.repository = repository

    def decision(
        self,
        plan: RoutingPlan,
        selected: PlanCandidate,
        path: list[dict[str, str]],
        fallback_count: int,
    ) -> dict[str, Any]:
        quota = selected.state.quota
        health = selected.state.health
        reason = selected.reason if selected.reason != "eligible" else plan.effective_strategy
        return {
            "strategy": plan.requested_strategy,
            "effective_strategy": plan.effective_strategy,
            "degraded_reason": plan.degraded_reason,
            "selected": {
                "provider": selected.candidate.provider_kind,
                "model": selected.candidate.model_id,
                "reason": reason,
            },
            "fallback_count": fallback_count,
            "path": path[-8:],
            "excluded": [
                {"provider": item.provider_kind, "model": item.model_id, "reason": item.reason}
                for item in plan.excluded[:12]
            ],
            "quota": {
                "source": quota.strongest_source(),
                "confidence": quota.confidence(),
            },
            "circuit_state": health.circuit_state.value,
            "latency_confidence": health.latency_confidence,
        }

    async def record(
        self,
        *,
        request_id: UUID,
        context: VirtualKeyContext,
        item: PlanCandidate,
        latency_ms: int,
        status: str,
        fallback_count: int,
        input_tokens: int | None,
        output_tokens: int | None,
        error_category: str | None,
        ttft_ms: int | None,
        decision: dict[str, Any],
    ) -> None:
        estimated_cost = None
        if input_tokens is not None and output_tokens is not None:
            estimated_cost = cost_microusd(item.candidate, input_tokens, output_tokens)
        await self.repository.record_usage(
            UsageRecord(
                request_id=request_id,
                workspace_id=context.workspace_id,
                route_id=context.route_id,
                virtual_key_id=context.key_id,
                provider_connection_id=item.candidate.provider_connection_id,
                provider_kind=item.candidate.provider_kind,
                model_id=item.candidate.model_id,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                latency_ms=max(0, latency_ms),
                status=status,
                fallback_count=fallback_count,
                error_category=error_category,
                estimated_cost_microusd=estimated_cost,
                ttft_ms=ttft_ms,
                routing_decision=decision,
            )
        )
