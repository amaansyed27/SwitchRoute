import pytest

from switchroute.errors import SwitchRouteError
from switchroute.providers import http as provider_http
from switchroute.providers.registry import ProviderRegistry
from switchroute.providers.test_adapter import TestAdapter


def _fixture(url: str):
    if "generativelanguage" in url:
        return {
            "models": [
                {
                    "name": "models/gemini-test",
                    "displayName": "Gemini Test",
                    "supportedGenerationMethods": ["generateContent"],
                    "inputTokenLimit": 128000,
                    "outputTokenLimit": 8192,
                }
            ]
        }
    if "api.x.ai" in url:
        return {"models": [{"id": "grok-test", "output_modalities": ["text"]}]}
    if "anthropic.com" in url:
        return {"data": [{"id": "claude-test", "display_name": "Claude Test"}]}
    if "cohere.com" in url:
        return {
            "models": [
                {
                    "name": "command-test",
                    "endpoints": ["chat"],
                    "context_length": 128000,
                    "features": ["chat-completions"],
                }
            ]
        }
    if "cerebras.ai/public" in url:
        return {
            "data": [
                {
                    "id": "cerebras-test",
                    "name": "Cerebras Test",
                    "pricing": {"prompt": "0.000001", "completion": "0.000002"},
                    "capabilities": {"streaming": True, "tools": True, "reasoning": True},
                    "limits": {
                        "max_context_length": 131072,
                        "max_completion_tokens": 40960,
                    },
                }
            ]
        }
    if "cerebras.ai/v1" in url:
        return {"data": [{"id": "cerebras-test"}]}
    if "together.ai" in url:
        return [
            {
                "id": "org/together-test",
                "type": "chat",
                "display_name": "Together Test",
                "context_length": 32768,
                "pricing": {"input": 0.3, "output": 0.6},
            }
        ]
    if "fireworks.ai" in url:
        return {
            "models": [
                {
                    "name": "accounts/fireworks/models/fireworks-test",
                    "displayName": "Fireworks Test",
                }
            ]
        }
    if "deepinfra.com/models/deployment" in url:
        return []
    if "deepinfra.com/models/list" in url:
        return [
            {
                "model_name": "org/deepinfra-test",
                "reported_type": "text-generation",
                "max_tokens": 65536,
            }
        ]
    if "openrouter.ai/api/v1/key" in url:
        return {"data": {"label": "test"}}
    if "openrouter.ai/api/v1/models" in url:
        return {
            "data": [
                {
                    "id": "vendor/free:free",
                    "name": "Free",
                    "pricing": {"prompt": "0", "completion": "0"},
                    "supported_parameters": ["tools", "response_format"],
                    "context_length": 64000,
                }
            ]
        }
    if "huggingface.co/api/whoami" in url:
        return {"name": "tester"}
    if "router.huggingface.co" in url:
        return {
            "data": [
                {
                    "id": "org/hf-test",
                    "architecture": {"input_modalities": ["text", "image"]},
                    "providers": [
                        {
                            "provider": "test",
                            "status": "live",
                            "context_length": 128000,
                            "supports_tools": True,
                            "supports_structured_output": True,
                            "is_free": True,
                        }
                    ],
                }
            ]
        }
    if "api.sambanova.ai" in url:
        return {
            "data": [
                {
                    "id": "samba-test",
                    "context_length": 131072,
                    "max_completion_tokens": 4096,
                    "pricing": {"prompt": "0.000001", "completion": "0.000002"},
                }
            ]
        }
    if "api.groq.com" in url:
        return {"data": [{"id": "llama-test"}, {"id": "whisper-large-v3"}]}
    if "integrate.api.nvidia.com" in url:
        return {"data": [{"id": "meta/nvidia-test", "max_model_len": 131072}]}
    if "api.deepseek.com" in url:
        return {"data": [{"id": "deepseek-test"}]}
    if "api.mistral.ai" in url:
        return {"data": [{"id": "mistral-test", "capabilities": {"function_calling": True}}]}
    if "api.openai.com" in url:
        return {"data": [{"id": "gpt-test"}, {"id": "text-embedding-test"}]}
    raise AssertionError(f"No fixture for {url}")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "kind",
    [
        "openai",
        "anthropic",
        "gemini",
        "xai",
        "mistral",
        "deepseek",
        "cohere",
        "groq",
        "cerebras",
        "nvidia_nim",
        "sambanova",
        "together",
        "fireworks",
        "deepinfra",
        "openrouter",
        "huggingface",
    ],
)
async def test_hosted_provider_discovers_normalized_models(monkeypatch, kind: str) -> None:
    async def fake(url, **kwargs):
        return _fixture(url)

    monkeypatch.setattr(provider_http, "checked_json", fake)
    models = await ProviderRegistry().get(kind).validate_and_discover("key")
    assert models
    assert all(model.id and model.name for model in models)
    assert all(
        model.metadata_provenance in {"provider", "litellm", "curated", "unknown"}
        for model in models
    )
    assert all("chat" in model.capabilities for model in models)


@pytest.mark.asyncio
async def test_openrouter_normalizes_free_pricing_and_capabilities(monkeypatch) -> None:
    async def fake(url, **kwargs):
        return _fixture(url)

    monkeypatch.setattr(provider_http, "checked_json", fake)
    model = (await ProviderRegistry().get("openrouter").validate_and_discover("key"))[0]
    assert model.billing_tier == "free"
    assert model.input_price_per_million_usd == 0
    assert {"chat", "tools", "structured_output"} <= set(model.capabilities)


@pytest.mark.asyncio
async def test_sambanova_normalizes_per_token_pricing(monkeypatch) -> None:
    async def fake(url, **kwargs):
        return _fixture(url)

    monkeypatch.setattr(provider_http, "checked_json", fake)
    model = (await ProviderRegistry().get("sambanova").validate_and_discover("key"))[0]
    assert model.input_price_per_million_usd == 1.0
    assert model.output_price_per_million_usd == 2.0
    assert model.context_window == 131072
    assert model.max_output_tokens == 4096


@pytest.mark.asyncio
async def test_custom_openai_discovery_and_probe(monkeypatch) -> None:
    calls = []

    async def validate(url: str) -> str:
        return url.rstrip("/")

    async def safe(method, url, **kwargs):
        calls.append((method, url))
        if method == "GET":
            return 200, {"data": [{"id": "custom-chat"}]}
        return 200, {"choices": [{"message": {"content": "ok"}}]}

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    monkeypatch.setattr(provider_http, "safe_cloud_json", safe)
    models = await ProviderRegistry().get("custom_openai").validate_and_discover(
        "key", {"base_url": "https://models.example/v1", "discover_models": True}
    )
    assert [model.id for model in models] == ["custom-chat"]
    assert calls == [
        ("GET", "https://models.example/v1/models"),
        ("POST", "https://models.example/v1/chat/completions"),
    ]


@pytest.mark.asyncio
async def test_custom_openai_manual_model_fallback(monkeypatch) -> None:
    async def validate(url: str) -> str:
        return url.rstrip("/")

    async def safe(method, url, **kwargs):
        return (405, None) if method == "GET" else (200, {"choices": []})

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    monkeypatch.setattr(provider_http, "safe_cloud_json", safe)
    models = await ProviderRegistry().get("custom_openai").validate_and_discover(
        "key",
        {
            "base_url": "https://models.example/v1",
            "discover_models": True,
            "manual_model_id": "manual-chat",
        },
    )
    assert [model.id for model in models] == ["manual-chat"]
    assert models[0].metadata_provenance == "unknown"


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ProviderRegistry().production_kinds)
async def test_every_provider_propagates_auth_failure(monkeypatch, kind: str) -> None:
    error = SwitchRouteError(
        "provider_auth_error", "Provider rejected this credential.", 400
    )

    async def fail(*args, **kwargs):
        raise error

    monkeypatch.setattr(provider_http, "checked_json", fail)
    monkeypatch.setattr(provider_http, "safe_cloud_json", fail)

    async def validate(url: str) -> str:
        return url.rstrip("/")

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    config = None
    if kind == "custom_openai":
        config = {
            "base_url": "https://models.example/v1",
            "discover_models": False,
            "manual_model_id": "chat",
        }
    with pytest.raises(SwitchRouteError, match="Provider rejected"):
        await ProviderRegistry().get(kind).validate_and_discover("bad-key", config)


@pytest.mark.asyncio
async def test_test_provider_rejects_wrong_key() -> None:
    with pytest.raises(SwitchRouteError):
        await TestAdapter().validate_and_discover("wrong")


def _config_for(kind: str):
    if kind == "custom_openai":
        return {"base_url": "https://models.example/v1", "discover_models": True}
    return None


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ProviderRegistry().production_kinds)
async def test_every_provider_rejects_invalid_or_empty_discovery(
    monkeypatch, kind: str
) -> None:
    async def empty(*args, **kwargs):
        return {}

    async def safe_empty(method, url, **kwargs):
        return 200, {}

    async def validate(url: str) -> str:
        return url.rstrip("/")

    monkeypatch.setattr(provider_http, "checked_json", empty)
    monkeypatch.setattr(provider_http, "safe_cloud_json", safe_empty)
    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    with pytest.raises(SwitchRouteError):
        await ProviderRegistry().get(kind).validate_and_discover("key", _config_for(kind))


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ProviderRegistry().production_kinds)
async def test_every_provider_propagates_rate_limit_failure(monkeypatch, kind: str) -> None:
    error = SwitchRouteError("provider_rate_limited", "Provider is rate limited.", 429)

    async def fail(*args, **kwargs):
        raise error

    async def validate(url: str) -> str:
        return url.rstrip("/")

    monkeypatch.setattr(provider_http, "checked_json", fail)
    monkeypatch.setattr(provider_http, "safe_cloud_json", fail)
    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    with pytest.raises(SwitchRouteError) as raised:
        await ProviderRegistry().get(kind).validate_and_discover("key", _config_for(kind))
    assert raised.value.code == "provider_rate_limited"
