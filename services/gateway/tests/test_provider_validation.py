import pytest

from switchroute.errors import SwitchRouteError
from switchroute.providers import adapters
from switchroute.providers.adapters import GeminiAdapter, GroqAdapter, OpenRouterAdapter
from switchroute.providers.test_adapter import TestAdapter


@pytest.mark.asyncio
async def test_groq_discovers_chat_models(monkeypatch) -> None:
    async def fake(*args, **kwargs):
        return {"data": [{"id": "llama-test"}, {"id": "whisper-large-v3"}]}
    monkeypatch.setattr(adapters, "_checked_json", fake)
    models = await GroqAdapter().validate_and_discover("key")
    assert [model.id for model in models] == ["llama-test"]


@pytest.mark.asyncio
async def test_gemini_filters_generate_content(monkeypatch) -> None:
    async def fake(*args, **kwargs):
        return {"models": [{"name": "models/gemini-test", "displayName": "Gemini Test", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/embed", "supportedGenerationMethods": ["embedContent"]}]}
    monkeypatch.setattr(adapters, "_checked_json", fake)
    models = await GeminiAdapter().validate_and_discover("key")
    assert [model.id for model in models] == ["gemini-test"]


@pytest.mark.asyncio
async def test_openrouter_marks_free_models(monkeypatch) -> None:
    async def fake(url, **kwargs):
        if url.endswith("/key"):
            return {"data": {"label": "test"}}
        return {"data": [{"id": "vendor/free:free", "name": "Free", "pricing": {"prompt": "0", "completion": "0"}}, {"id": "vendor/paid", "pricing": {"prompt": "0.1", "completion": "0.2"}}]}
    monkeypatch.setattr(adapters, "_checked_json", fake)
    models = await OpenRouterAdapter().validate_and_discover("key")
    assert [model.billing_tier for model in models] == ["free", "paid"]


@pytest.mark.asyncio
async def test_test_provider_rejects_wrong_key() -> None:
    with pytest.raises(SwitchRouteError):
        await TestAdapter().validate_and_discover("wrong")
