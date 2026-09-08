from types import SimpleNamespace
from typing import cast
from uuid import UUID

import pytest

from switchroute.domain import Candidate, VirtualKeyContext
from switchroute.routing.orchestrator import RouteOrchestrator
from switchroute.services import Services


class Repo:
    def __init__(self):
        self.records = []

    async def provider_secret(self, workspace_id, provider_id):
        kinds = {UUID(int=5): "groq", UUID(int=7): "gemini"}
        return kinds[provider_id], "cipher", "kid", {}

    async def mark_key_used(self, key_id):
        pass

    async def record_usage(self, record):
        self.records.append(record)


class Secrets:
    def decrypt(self, ciphertext, key_id):
        return "secret"


class Invoker:
    def __init__(self, fail_midstream: bool):
        self.fail_midstream = fail_midstream
        self.calls = []

    async def stream(
        self, provider_kind, model_id, api_key, payload, connection_config=None
    ):
        self.calls.append(provider_kind)
        if provider_kind == "groq" and not self.fail_midstream:
            raise RuntimeError("failed before content")
        yield {"choices": [{"delta": {"content": "hello"}, "finish_reason": None}]}
        if provider_kind == "groq" and self.fail_midstream:
            raise RuntimeError("failed after content")
        yield {
            "choices": [{"delta": {}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 2, "completion_tokens": 1},
        }


def context() -> VirtualKeyContext:
    return VirtualKeyContext(
        key_id=UUID(int=1),
        workspace_id=UUID(int=2),
        route_id=UUID(int=3),
        route_name="R",
        route_slug="r",
        strategy="priority",
        route_enabled=True,
        candidates=[
            Candidate(UUID(int=4), UUID(int=5), "groq", "a", "free", 0),
            Candidate(UUID(int=6), UUID(int=7), "gemini", "b", "free", 1),
        ],
    )


def services_for(invoker: Invoker) -> Services:
    namespace = SimpleNamespace(repository=Repo(), secrets=Secrets(), invoker=invoker)
    return cast(Services, namespace)


@pytest.mark.asyncio
async def test_stream_falls_back_before_content() -> None:
    invoker = Invoker(False)
    data = b"".join(
        [
            part
            async for part in RouteOrchestrator(services_for(invoker)).stream(
                context(), {"messages": []}
            )
        ]
    )
    assert invoker.calls == ["groq", "gemini"]
    assert b"hello" in data and b"[DONE]" in data


@pytest.mark.asyncio
async def test_stream_never_blends_provider_after_content() -> None:
    invoker = Invoker(True)
    data = b"".join(
        [
            part
            async for part in RouteOrchestrator(services_for(invoker)).stream(
                context(), {"messages": []}
            )
        ]
    )
    assert invoker.calls == ["groq"]
    assert b"hello" in data and b"provider_unavailable" in data and b"[DONE]" in data
