from typing import Any

import litellm
import pytest

from switchroute.providers import http as provider_http
from switchroute.providers.catalog import PROVIDER_DEFINITIONS
from switchroute.providers.registry import ProviderRegistry
from switchroute.routing.invoker import LiteLLMInvoker


def _connection(kind: str) -> dict[str, Any] | None:
    if kind == "custom_openai":
        return {
            "base_url": "https://models.example/v1",
            "discover_models": False,
            "manual_model_id": "model",
        }
    return None


@pytest.mark.asyncio
@pytest.mark.parametrize("definition", PROVIDER_DEFINITIONS, ids=lambda item: item.id)
async def test_every_provider_invokes_through_litellm(monkeypatch, definition) -> None:
    calls: list[dict[str, Any]] = []

    async def validate(url: str) -> str:
        return url.rstrip("/")

    async def fake_completion(**kwargs):
        calls.append(kwargs)
        return {"choices": [{"message": {"content": "ok"}}]}

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    monkeypatch.setattr(litellm, "acompletion", fake_completion)
    result = await LiteLLMInvoker(ProviderRegistry()).complete(
        definition.id,
        "model",
        "secret",
        {"model": "auto", "messages": [{"role": "user", "content": "hello"}]},
        _connection(definition.id),
    )
    assert result["choices"][0]["message"]["content"] == "ok"
    assert calls[0]["model"].startswith(f"{definition.litellm_mapping}/")
    assert calls[0]["api_key"] == "secret"
    assert calls[0]["stream"] is False
    if definition.litellm_api_base:
        assert calls[0]["api_base"] == definition.litellm_api_base
    if definition.id == "custom_openai":
        assert calls[0]["api_base"] == "https://models.example/v1"


@pytest.mark.asyncio
@pytest.mark.parametrize("definition", PROVIDER_DEFINITIONS, ids=lambda item: item.id)
async def test_every_provider_streams_through_same_litellm_mapping(
    monkeypatch, definition
) -> None:
    calls: list[dict[str, Any]] = []

    async def validate(url: str) -> str:
        return url.rstrip("/")

    async def chunks():
        yield {"choices": [{"delta": {"content": "ok"}}]}

    async def fake_completion(**kwargs):
        calls.append(kwargs)
        return chunks()

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    monkeypatch.setattr(litellm, "acompletion", fake_completion)
    items = [
        item
        async for item in LiteLLMInvoker(ProviderRegistry()).stream(
            definition.id,
            "model",
            "secret",
            {"model": "auto", "messages": [{"role": "user", "content": "hello"}]},
            _connection(definition.id),
        )
    ]
    assert items == [{"choices": [{"delta": {"content": "ok"}}]}]
    assert calls[0]["model"].startswith(f"{definition.litellm_mapping}/")
    assert calls[0]["stream"] is True
