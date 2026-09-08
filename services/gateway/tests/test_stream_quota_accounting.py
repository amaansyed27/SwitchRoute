from types import SimpleNamespace
from typing import cast
from uuid import UUID

import pytest

from switchroute.domain import Candidate, VirtualKeyContext
from switchroute.routing.orchestrator import RouteOrchestrator
from switchroute.routing.state import MemoryRoutingState, target_key
from switchroute.services import Services


class Repo:
    def __init__(self) -> None:
        self.records = []

    async def provider_secret(self, workspace_id, provider_id):
        return "groq", "cipher", "kid", {}

    async def mark_key_used(self, key_id):
        return None

    async def record_usage(self, record):
        self.records.append(record)


class Secrets:
    def decrypt(self, ciphertext, key_id):
        return "secret"


class HeaderInvoker:
    async def stream(
        self, provider_kind, model_id, api_key, payload, connection_config=None
    ):
        yield {
            "choices": [{"delta": {"content": "hello"}, "finish_reason": None}],
            "_hidden_params": {
                "additional_headers": {
                    "x-ratelimit-limit-requests": "10",
                    "x-ratelimit-remaining-requests": "7",
                    "x-ratelimit-reset-requests": "30s",
                }
            },
        }
        yield {
            "choices": [{"delta": {}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 2, "completion_tokens": 1},
        }


def context() -> VirtualKeyContext:
    candidate = Candidate(
        target_id=UUID(int=4),
        provider_connection_id=UUID(int=5),
        provider_kind="groq",
        model_id="a",
        billing_tier="free",
        position=0,
    )
    return VirtualKeyContext(
        key_id=UUID(int=1),
        workspace_id=UUID(int=2),
        route_id=UUID(int=3),
        route_name="R",
        route_slug="r",
        strategy="priority",
        route_enabled=True,
        candidates=[candidate],
    )


@pytest.mark.asyncio
async def test_stream_observed_remaining_wins_after_local_reconciliation() -> None:
    state = MemoryRoutingState()
    namespace = SimpleNamespace(
        repository=Repo(),
        secrets=Secrets(),
        invoker=HeaderInvoker(),
        routing_state=state,
    )
    orchestrator = RouteOrchestrator(cast(Services, namespace))
    ctx = context()

    data = b"".join(
        [part async for part in orchestrator.stream(ctx, {"messages": [], "stream": True})]
    )

    assert b"hello" in data
    snapshot = await state.snapshot(target_key(ctx.candidates[0]))
    assert snapshot.quota.rpm.limit == 10
    assert snapshot.quota.rpm.remaining == 7
