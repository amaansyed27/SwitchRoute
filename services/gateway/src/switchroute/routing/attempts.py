import time
from typing import Any
from uuid import UUID

from switchroute.domain import VirtualKeyContext
from switchroute.errors import PROVIDER_AUTH_ERROR, SwitchRouteError, classify_provider_error
from switchroute.observability import emit_request_event
from switchroute.routing.activity import RoutingActivity
from switchroute.routing.context import PlanCandidate, RoutingPlan
from switchroute.routing.state import RoutingState, target_key


async def record_failed_attempt(
    *,
    request_id: UUID,
    context: VirtualKeyContext,
    plan: RoutingPlan,
    item: PlanCandidate,
    reservation: Any,
    started: float,
    attempted: bool,
    exc: Exception,
    fallback_count: int,
    path: list[dict[str, str]],
    state: RoutingState,
    activity: RoutingActivity,
    observe_headers,
    mark_auth_invalid,
) -> SwitchRouteError:
    error = classify_provider_error(exc)
    latency_ms = int((time.perf_counter() - started) * 1000)
    await state.reconcile(
        reservation,
        attempted=attempted,
        actual_tokens=None,
        actual_cost_microusd=None,
    )
    await observe_headers(item.candidate, exc)
    await state.observe_failure(target_key(item.candidate), error.code)
    if error.code == PROVIDER_AUTH_ERROR:
        await mark_auth_invalid(context, item.candidate)
    path.append(
        {
            "provider": item.candidate.provider_kind,
            "model": item.candidate.model_id,
            "outcome": error.code,
        }
    )
    decision = activity.decision(plan, item, path, fallback_count)
    await activity.record(
        request_id=request_id,
        context=context,
        item=item,
        latency_ms=latency_ms,
        status="error",
        fallback_count=fallback_count,
        input_tokens=None,
        output_tokens=None,
        error_category=error.code,
        ttft_ms=None,
        decision=decision,
    )
    emit_request_event(
        event="route_attempt",
        request_id=str(request_id),
        route=context.route_slug,
        provider=item.candidate.provider_kind,
        model=item.candidate.model_id,
        latency_ms=latency_ms,
        fallback_count=fallback_count,
        status="error",
        error_category=error.code,
    )
    return error
