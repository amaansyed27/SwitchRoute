from collections.abc import AsyncIterator
from typing import Any

import litellm

from switchroute.providers.registry import ProviderRegistry


class LiteLLMInvoker:
    def __init__(self, providers: ProviderRegistry, enable_test_provider: bool = False) -> None:
        self._providers = providers
        self._enable_test_provider = enable_test_provider

    async def complete(self, provider_kind: str, model_id: str, api_key: str, payload: dict[str, Any]) -> Any:
        model = self._providers.get(provider_kind).litellm_model(model_id)
        args = {k: v for k, v in payload.items() if k not in {"model", "stream"}}
        return await litellm.acompletion(model=model, api_key=api_key, stream=False, **args)

    async def stream(self, provider_kind: str, model_id: str, api_key: str, payload: dict[str, Any]) -> AsyncIterator[Any]:
        model = self._providers.get(provider_kind).litellm_model(model_id)
        args = {k: v for k, v in payload.items() if k not in {"model", "stream"}}
        stream = await litellm.acompletion(model=model, api_key=api_key, stream=True, **args)
        async for chunk in stream:
            yield chunk
