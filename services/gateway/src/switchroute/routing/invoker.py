import time
from collections.abc import AsyncIterator
from typing import Any

import litellm

from switchroute.providers.registry import ProviderRegistry

litellm.suppress_debug_info = True
litellm.success_callback = []
litellm.failure_callback = []


class LiteLLMInvoker:
    def __init__(self, providers: ProviderRegistry, enable_test_provider: bool = False) -> None:
        self._providers = providers
        self._enable_test_provider = enable_test_provider

    async def complete(
        self, provider_kind: str, model_id: str, api_key: str, payload: dict[str, Any]
    ) -> Any:
        if provider_kind == "test" and self._enable_test_provider:
            return self._test_response()
        model = self._providers.get(provider_kind).litellm_model(model_id)
        args = {key: value for key, value in payload.items() if key not in {"model", "stream"}}
        return await litellm.acompletion(model=model, api_key=api_key, stream=False, **args)

    async def stream(
        self, provider_kind: str, model_id: str, api_key: str, payload: dict[str, Any]
    ) -> AsyncIterator[Any]:
        if provider_kind == "test" and self._enable_test_provider:
            for chunk in self._test_chunks():
                yield chunk
            return
        model = self._providers.get(provider_kind).litellm_model(model_id)
        args = {key: value for key, value in payload.items() if key not in {"model", "stream"}}
        stream_response: Any = await litellm.acompletion(
            model=model, api_key=api_key, stream=True, **args
        )
        async for chunk in stream_response:
            yield chunk

    @staticmethod
    def _test_response() -> dict[str, Any]:
        return {
            "id": "chatcmpl_switchroute_test",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "test/chat",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "SwitchRoute test OK"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 4, "completion_tokens": 4, "total_tokens": 8},
        }

    @staticmethod
    def _test_chunks() -> list[dict[str, Any]]:
        created = int(time.time())
        base = {
            "id": "chatcmpl_switchroute_test",
            "object": "chat.completion.chunk",
            "created": created,
            "model": "test/chat",
        }
        return [
            {
                **base,
                "choices": [
                    {"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}
                ],
            },
            {
                **base,
                "choices": [
                    {
                        "index": 0,
                        "delta": {"content": "SwitchRoute test OK"},
                        "finish_reason": None,
                    }
                ],
            },
            {
                **base,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 4, "completion_tokens": 4, "total_tokens": 8},
            },
        ]
