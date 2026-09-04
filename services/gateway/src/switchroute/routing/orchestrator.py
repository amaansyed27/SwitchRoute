import asyncio
import time
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID, uuid4

from switchroute.budget.cost import cost_microusd
from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.errors import (
    PROVIDER_AUTH_ERROR,
    PROVIDER_UNAVAILABLE,
    ROUTE_UNAVAILABLE,
    SwitchRouteError,
    classify_provider_error,
)
from switchroute.quota.headers import parse_rate_limit_headers, safe_headers
from switchroute.routing.context import PlanCandidate, RoutingPlan
from switchroute.routing.planner import RoutingPlanner
from switchroute.routing.state import MemoryRoutingState, RoutingState, target_key
from switchroute.routing.streaming import (
    chunk_has_content,
    normalized_chunk,
    object_dict,
    sse_data,
    sse_done,
    sse_error,
    usage_from,
)


class RouteOrchestrator:
    def __init__(self, services) -> None:
        self.services = services
        self.state: RoutingState = getattr(services, "routing_state", None) or MemoryRoutingState()
        self.planner = RoutingPlanner(self.state, services.repository)

    async def _credential(self, context: VirtualKeyContext, candidate: Candidate) -> tuple[str, dict | None]:
        kind, encrypted, key_id, metadata = await self.services.repository.provider_secret(
            context.workspace_id, candidate.provider_connection_id
        )
        secret = self.services.secrets.decrypt(encrypted, key_id)
        connection = metadata.get("connection") if isinstance(metadata, dict) else None
        return secret, connection

    async def _mark_auth_invalid(self, context: VirtualKeyContext, candidate: Candidate) -> None:
        method = getattr(self.services.repository, "mark_provider_attention", None)
        if callable(method):
            await method(context.workspace_id, candidate.provider_connection_id)

    async def _observe_headers(self, candidate: Candidate, value: object) -> None:
        observations = parse_rate_limit_headers(candidate.provider_kind, safe_headers(value))
        if observations:
            await self.state.observe_quota(target_key(candidate), observations)

    def _decision(
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

    async def _record(
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
        await self.services.repository.record_usage(
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

    async def _failed_attempt(
        self,
        *,
        request_id: UUID,
        context: VirtualKeyContext,
        plan: RoutingPlan,
        item: PlanCandidate,
        reservation,
        started: float,
        attempted: bool,
        exc: Exception,
        fallback_count: int,
        path: list[dict[str, str]],
    ) -> SwitchRouteError:
        error = classify_provider_error(exc)
        latency_ms = int((time.perf_counter() - started) * 1000)
        await self.state.reconcile(
            reservation,
            attempted=attempted,
            actual_tokens=None,
            actual_cost_microusd=None,
        )
        await self._observe_headers(item.candidate, exc)
        await self.state.observe_failure(target_key(item.candidate), error.code)
        if error.code == PROVIDER_AUTH_ERROR:
            await self._mark_auth_invalid(context, item.candidate)
        path.append(
            {
                "provider": item.candidate.provider_kind,
                "model": item.candidate.model_id,
                "outcome": error.code,
            }
        )
        decision = self._decision(plan, item, path, fallback_count)
        await self._record(
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
        return error

    async def complete(self, context: VirtualKeyContext, payload: dict[str, Any]) -> dict[str, Any]:
        request_id = uuid4()
        await self.services.repository.mark_key_used(context.key_id)
        plan = await self.planner.plan(context, payload)
        path: list[dict[str, str]] = []
        last_error: SwitchRouteError | None = None
        fallback_count = 0
        for item in plan.candidates:
            reservation = await self.planner.reserve(context, plan, item)
            if reservation is None:
                path.append({"provider": item.candidate.provider_kind, "model": item.candidate.model_id, "outcome": "capacity_race"})
                fallback_count += 1
                continue
            started = time.perf_counter()
            attempted = False
            try:
                secret, connection = await self._credential(context, item.candidate)
                attempted = True
                response = await self.services.invoker.complete(
                    item.candidate.provider_kind,
                    item.candidate.model_id,
                    secret,
                    payload,
                    connection,
                )
                latency_ms = int((time.perf_counter() - started) * 1000)
                input_tokens, output_tokens = usage_from(response)
                actual_tokens = None if input_tokens is None or output_tokens is None else input_tokens + output_tokens
                actual_cost = None
                if input_tokens is not None and output_tokens is not None:
                    actual_cost = cost_microusd(item.candidate, input_tokens, output_tokens)
                await self.state.reconcile(
                    reservation,
                    attempted=True,
                    actual_tokens=actual_tokens,
                    actual_cost_microusd=actual_cost,
                )
                await self._observe_headers(item.candidate, response)
                await self.state.observe_success(target_key(item.candidate), latency_ms)
                path.append({"provider": item.candidate.provider_kind, "model": item.candidate.model_id, "outcome": "selected"})
                decision = self._decision(plan, item, path, fallback_count)
                await self._record(
                    request_id=request_id,
                    context=context,
                    item=item,
                    latency_ms=latency_ms,
                    status="success",
                    fallback_count=fallback_count,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    error_category=None,
                    ttft_ms=None,
                    decision=decision,
                )
                data = object_dict(response)
                data["model"] = "auto"
                return data
            except asyncio.CancelledError:
                await self.state.reconcile(
                    reservation,
                    attempted=attempted,
                    actual_tokens=None,
                    actual_cost_microusd=None,
                )
                raise
            except Exception as exc:
                last_error = await self._failed_attempt(
                    request_id=request_id,
                    context=context,
                    plan=plan,
                    item=item,
                    reservation=reservation,
                    started=started,
                    attempted=attempted,
                    exc=exc,
                    fallback_count=fallback_count,
                    path=path,
                )
                fallback_count += 1
        if last_error:
            raise last_error
        raise SwitchRouteError(ROUTE_UNAVAILABLE, "No Route target had reservable capacity.", 503)

    async def stream(self, context: VirtualKeyContext, payload: dict[str, Any]) -> AsyncIterator[bytes]:
        request_id = uuid4()
        await self.services.repository.mark_key_used(context.key_id)
        plan = await self.planner.plan(context, payload)
        path: list[dict[str, str]] = []
        fallback_count = 0
        last_error: SwitchRouteError | None = None
        for item in plan.candidates:
            reservation = await self.planner.reserve(context, plan, item)
            if reservation is None:
                path.append({"provider": item.candidate.provider_kind, "model": item.candidate.model_id, "outcome": "capacity_race"})
                fallback_count += 1
                continue
            started = time.perf_counter()
            attempted = False
            buffered: list[Any] = []
            try:
                secret, connection = await self._credential(context, item.candidate)
                attempted = True
                iterator = self.services.invoker.stream(
                    item.candidate.provider_kind,
                    item.candidate.model_id,
                    secret,
                    payload,
                    connection,
                )
                async for chunk in iterator:
                    buffered.append(chunk)
                    await self._observe_headers(item.candidate, chunk)
                    if chunk_has_content(chunk):
                        ttft_ms = int((time.perf_counter() - started) * 1000)
                        async for part in self._selected_stream(
                            request_id=request_id,
                            context=context,
                            plan=plan,
                            item=item,
                            reservation=reservation,
                            iterator=iterator,
                            buffered=buffered,
                            started=started,
                            ttft_ms=ttft_ms,
                            fallback_count=fallback_count,
                            path=path,
                        ):
                            yield part
                        return
                raise RuntimeError("provider stream ended before first content")
            except asyncio.CancelledError:
                await self.state.reconcile(
                    reservation,
                    attempted=attempted,
                    actual_tokens=None,
                    actual_cost_microusd=None,
                )
                raise
            except Exception as exc:
                last_error = await self._failed_attempt(
                    request_id=request_id,
                    context=context,
                    plan=plan,
                    item=item,
                    reservation=reservation,
                    started=started,
                    attempted=attempted,
                    exc=exc,
                    fallback_count=fallback_count,
                    path=path,
                )
                fallback_count += 1
        error = last_error or SwitchRouteError(ROUTE_UNAVAILABLE, "No Route target had reservable capacity.", 503)
        yield sse_error(error.code, error.message)
        yield sse_done()

    async def _selected_stream(
        self,
        *,
        request_id: UUID,
        context: VirtualKeyContext,
        plan: RoutingPlan,
        item: PlanCandidate,
        reservation,
        iterator,
        buffered: list[Any],
        started: float,
        ttft_ms: int,
        fallback_count: int,
        path: list[dict[str, str]],
    ) -> AsyncIterator[bytes]:
        input_tokens: int | None = None
        output_tokens: int | None = None
        error_category: str | None = None
        status = "success"
        try:
            for chunk in buffered:
                seen_input, seen_output = usage_from(chunk)
                input_tokens = seen_input if seen_input is not None else input_tokens
                output_tokens = seen_output if seen_output is not None else output_tokens
                yield sse_data(normalized_chunk(chunk))
            async for chunk in iterator:
                await self._observe_headers(item.candidate, chunk)
                seen_input, seen_output = usage_from(chunk)
                input_tokens = seen_input if seen_input is not None else input_tokens
                output_tokens = seen_output if seen_output is not None else output_tokens
                yield sse_data(normalized_chunk(chunk))
        except asyncio.CancelledError:
            status = "error"
            error_category = "cancelled"
            raise
        except Exception as exc:
            error = classify_provider_error(exc)
            status = "error"
            error_category = error.code
            await self._observe_headers(item.candidate, exc)
            yield sse_error(error.code, error.message)
        finally:
            latency_ms = int((time.perf_counter() - started) * 1000)
            actual_tokens = None if input_tokens is None or output_tokens is None else input_tokens + output_tokens
            actual_cost = None
            if input_tokens is not None and output_tokens is not None:
                actual_cost = cost_microusd(item.candidate, input_tokens, output_tokens)
            await self.state.reconcile(
                reservation,
                attempted=True,
                actual_tokens=actual_tokens,
                actual_cost_microusd=actual_cost,
            )
            if status == "success":
                await self.state.observe_success(target_key(item.candidate), latency_ms, ttft_ms)
                path.append({"provider": item.candidate.provider_kind, "model": item.candidate.model_id, "outcome": "selected"})
            else:
                await self.state.observe_failure(target_key(item.candidate), error_category or PROVIDER_UNAVAILABLE)
                path.append({"provider": item.candidate.provider_kind, "model": item.candidate.model_id, "outcome": error_category or PROVIDER_UNAVAILABLE})
            decision = self._decision(plan, item, path, fallback_count)
            await self._record(
                request_id=request_id,
                context=context,
                item=item,
                latency_ms=latency_ms,
                status=status,
                fallback_count=fallback_count,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                error_category=error_category,
                ttft_ms=ttft_ms,
                decision=decision,
            )
        yield sse_done()
