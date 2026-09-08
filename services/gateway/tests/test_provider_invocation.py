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
async def test_every_provider_has_a_real_invocation_path(monkeypatch, definition) -> None:
    calls: list[dict[str, Any]] = []

    async def fake_completion(**kwargs):
        calls.append(kwargs)
        return {"choices": [{"message": {"content": "ok"}}]}

    async def fake_custom(method, url, **kwargs):
        calls.append({"custom_url": url, **kwargs})
        return 200, {"choices": [{"message": {"content": "ok"}}]}

    monkeypatch.setattr(litellm, "acompletion", fake_completion)
    monkeypatch.setattr(provider_http, "safe_cloud_json", fake_custom)
    result = await LiteLLMInvoker(ProviderRegistry()).complete(
        definition.id,
        "model",
        "secret",
        {"model": "auto", "messages": [{"role": "user", "content": "hello"}]},
        _connection(definition.id),
    )
    assert result["choices"][0]["message"]["content"] == "ok"
    if definition.id == "custom_openai":
        assert calls[0]["custom_url"] == "https://models.example/v1/chat/completions"
        assert calls[0]["headers"]["Authorization"] == "Bearer secret"
        assert calls[0]["json"]["model"] == "model"
    else:
        assert calls[0]["model"].startswith(f"{definition.litellm_mapping}/")
        assert calls[0]["api_key"] == "secret"
        assert calls[0]["stream"] is False
        if definition.litellm_api_base:
            assert calls[0]["api_base"] == definition.litellm_api_base


@pytest.mark.asyncio
@pytest.mark.parametrize("definition", PROVIDER_DEFINITIONS, ids=lambda item: item.id)
async def test_every_provider_streams_through_same_mapping(monkeypatch, definition) -> None:
    calls: list[dict[str, Any]] = []

    async def chunks():
        yield {"choices": [{"delta": {"content": "ok"}}]}

    async def fake_completion(**kwargs):
        calls.append(kwargs)
        return chunks()

    async def fake_custom(url, **kwargs):
        calls.append({"custom_url": url, **kwargs})
        async for item in chunks():
            yield item

    monkeypatch.setattr(litellm, "acompletion", fake_completion)
    monkeypatch.setattr(provider_http, "safe_cloud_stream", fake_custom)
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
    if definition.id == "custom_openai":
        assert calls[0]["custom_url"] == "https://models.example/v1/chat/completions"
        assert calls[0]["json"]["stream"] is True
    else:
        assert calls[0]["model"].startswith(f"{definition.litellm_mapping}/")
        assert calls[0]["stream"] is True
