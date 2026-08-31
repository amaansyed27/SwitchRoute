import time
from collections.abc import AsyncIterator
from typing import Any
from uuid import UUID, uuid4

from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.errors import ROUTE_UNAVAILABLE, SwitchRouteError, classify_provider_error
from switchroute.routing.strategy import order_candidates
from switchroute.routing.streaming import (
    chunk_has_content,
    normalized_chunk,
    object_dict,
    sse_data,
    sse_done,
    sse_error,
    usage_from,
)
from switchroute.services import Services


class RouteOrchestrator:
    def __init__(self, services: Services) -> None:
        self.services = services

    async def _credential(self, context: VirtualKeyContext, candidate: Candidate) -> str:
        _, ciphertext, key_id = await self.services.repository.provider_secret(
            context.workspace_id, candidate.provider_connection_id
        )
        return self.services.secrets.decrypt(ciphertext, key_id)

    async def _record(
        self,
        context: VirtualKeyContext,
        request_id: UUID,
        candidate: Candidate | None,
        started: float,
        status: str,
        fallback_count: int,
        usage: tuple[int | None, int | None] = (None, None),
        error_category: str | None = None,
    ) -> None:
        await self.services.repository.record_usage(
            UsageRecord(
                request_id=request_id,
                workspace_id=context.workspace_id,
                route_id=context.route_id,
                virtual_key_id=context.key_id,
                provider_connection_id=candidate.provider_connection_id if candidate else None,
                provider_kind=candidate.provider_kind if candidate else None,
                model_id=candidate.model_id if candidate else None,
                input_tokens=usage[0],
                output_tokens=usage[1],
                latency_ms=max(0, round((time.perf_counter() - started) * 1000)),
                status=status,
                fallback_count=fallback_count,
                error_category=error_category,
            )
        )

    async def complete(self, context: VirtualKeyContext, payload: dict[str, Any]) -> dict:
        started = time.perf_counter()
        request_id = uuid4()
        fallback_count = 0
        last_error: SwitchRouteError | None = None
        candidates = order_candidates(context.candidates, context.strategy)
        await self.services.repository.mark_key_used(context.key_id)

        for candidate in candidates:
            try:
                credential = await self._credential(context, candidate)
                response = await self.services.invoker.complete(
                    candidate.provider_kind, candidate.model_id, credential, payload
                )
                data = object_dict(response)
                data["model"] = "auto"
                await self._record(
                    context, request_id, candidate, started, "success", fallback_count, usage_from(data)
                )
                return data
            except SwitchRouteError as exc:
                last_error = exc
            except Exception as exc:  # upstream SDK exceptions are normalized here
                last_error = classify_provider_error(exc)
            fallback_count += 1

        error = last_error or SwitchRouteError(ROUTE_UNAVAILABLE, "No Route target is available.", 503)
        await self._record(
            context,
            request_id,
            candidates[-1] if candidates else None,
            started,
            "error",
            max(0, fallback_count - 1),
            error_category=error.code,
        )
        raise SwitchRouteError(ROUTE_UNAVAILABLE, "No Route target could start the request.", 503)

    async def stream(self, context: VirtualKeyContext, payload: dict[str, Any]) -> AsyncIterator[bytes]:
        started = time.perf_counter()
        request_id = uuid4()
        candidates = order_candidates(context.candidates, context.strategy)
        await self.services.repository.mark_key_used(context.key_id)
        fallback_count = 0
        last_error: SwitchRouteError | None = None

        for candidate in candidates:
            buffered: list[Any] = []
            input_tokens: int | None = None
            output_tokens: int | None = None
            try:
                credential = await self._credential(context, candidate)
                iterator = self.services.invoker.stream(
                    candidate.provider_kind, candidate.model_id, credential, payload
                ).__aiter__()
                while True:
                    try:
                        chunk = await anext(iterator)
                    except StopAsyncIteration:
                        break
                    buffered.append(chunk)
                    chunk_usage = usage_from(chunk)
                    input_tokens = chunk_usage[0] or input_tokens
                    output_tokens = chunk_usage[1] or output_tokens
                    if chunk_has_content(chunk):
                        break
            except SwitchRouteError as exc:
                last_error = exc
                fallback_count += 1
                continue
            except Exception as exc:
                last_error = classify_provider_error(exc)
                fallback_count += 1
                continue

            async def selected_stream() -> AsyncIterator[bytes]:
                nonlocal input_tokens, output_tokens
                status = "success"
                error_category: str | None = None
                try:
                    for item in buffered:
                        yield sse_data(normalized_chunk(item))
                    async for item in iterator:
                        chunk_usage = usage_from(item)
                        input_tokens = chunk_usage[0] or input_tokens
                        output_tokens = chunk_usage[1] or output_tokens
                        yield sse_data(normalized_chunk(item))
                    yield sse_done()
                except Exception as exc:
                    error = classify_provider_error(exc)
                    status = "error"
                    error_category = error.code
                    yield sse_error(error.code, error.message)
                    yield sse_done()
                finally:
                    await self._record(
                        context,
                        request_id,
                        candidate,
                        started,
                        status,
                        fallback_count,
                        (input_tokens, output_tokens),
                        error_category,
                    )

            async for event in selected_stream():
                yield event
            return

        error = last_error or SwitchRouteError(ROUTE_UNAVAILABLE, "No Route target is available.", 503)
        await self._record(
            context,
            request_id,
            candidates[-1] if candidates else None,
            started,
            "error",
            max(0, fallback_count - 1),
            error_category=error.code,
        )
        yield sse_error(ROUTE_UNAVAILABLE, "No Route target could start the request.")
        yield sse_done()
