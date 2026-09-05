from __future__ import annotations

from collections.abc import AsyncIterator, Iterator, Sequence
from typing import Any

import httpx

from ._errors import RequestTimeoutError, SwitchRouteError, error_from_response
from ._sse import aiter_sse, iter_sse
from ._types import ChatCompletion, ChatCompletionChunk, ChatMessage, ModelList

DEFAULT_BASE_URL = "https://api.switchroute.dawnlightlabs.com/v1"


class _SyncChatCompletions:
    def __init__(self, owner: SwitchRoute) -> None:
        self._owner = owner

    def create(self, *, messages: Sequence[ChatMessage | dict[str, Any]], model: str = "auto", stream: bool = False, **kwargs: Any) -> ChatCompletion | Iterator[ChatCompletionChunk]:
        payload = {"model": model, "messages": list(messages), "stream": stream, **kwargs}
        if stream:
            return self._owner._stream("/chat/completions", payload)
        return self._owner._json("POST", "/chat/completions", json=payload)


class _SyncChat:
    def __init__(self, owner: SwitchRoute) -> None:
        self.completions = _SyncChatCompletions(owner)


class _SyncModels:
    def __init__(self, owner: SwitchRoute) -> None:
        self._owner = owner

    def list(self) -> ModelList:
        return self._owner._json("GET", "/models")


class SwitchRoute:
    def __init__(self, *, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: float = 60.0, http_client: httpx.Client | None = None) -> None:
        if not api_key:
            raise SwitchRouteError("api_key is required.", code="configuration_error")
        self._owns_client = http_client is None
        self._client = http_client or httpx.Client(timeout=timeout)
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.chat = _SyncChat(self)
        self.models = _SyncModels(self)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "User-Agent": "switchroute-python/0.4.0"}

    def _json(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = self._client.request(method, f"{self._base_url}{path}", headers=self._headers(), **kwargs)
        except httpx.TimeoutException as exc:
            raise RequestTimeoutError("SwitchRoute request timed out.", code="timeout") from exc
        if response.is_error:
            raise error_from_response(response)
        return response.json()

    def _stream(self, path: str, payload: dict[str, Any]) -> Iterator[ChatCompletionChunk]:
        try:
            with self._client.stream("POST", f"{self._base_url}{path}", headers={**self._headers(), "Accept": "text/event-stream"}, json=payload) as response:
                if response.is_error:
                    response.read()
                    raise error_from_response(response)
                yield from iter_sse(response.iter_lines())
        except httpx.TimeoutException as exc:
            raise RequestTimeoutError("SwitchRoute stream timed out.", code="timeout") from exc

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> SwitchRoute:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


class _AsyncChatCompletions:
    def __init__(self, owner: AsyncSwitchRoute) -> None:
        self._owner = owner

    async def create(self, *, messages: Sequence[ChatMessage | dict[str, Any]], model: str = "auto", stream: bool = False, **kwargs: Any) -> ChatCompletion | AsyncIterator[ChatCompletionChunk]:
        payload = {"model": model, "messages": list(messages), "stream": stream, **kwargs}
        if stream:
            return self._owner._stream("/chat/completions", payload)
        return await self._owner._json("POST", "/chat/completions", json=payload)


class _AsyncChat:
    def __init__(self, owner: AsyncSwitchRoute) -> None:
        self.completions = _AsyncChatCompletions(owner)


class _AsyncModels:
    def __init__(self, owner: AsyncSwitchRoute) -> None:
        self._owner = owner

    async def list(self) -> ModelList:
        return await self._owner._json("GET", "/models")


class AsyncSwitchRoute:
    def __init__(self, *, api_key: str, base_url: str = DEFAULT_BASE_URL, timeout: float = 60.0, http_client: httpx.AsyncClient | None = None) -> None:
        if not api_key:
            raise SwitchRouteError("api_key is required.", code="configuration_error")
        self._owns_client = http_client is None
        self._client = http_client or httpx.AsyncClient(timeout=timeout)
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.chat = _AsyncChat(self)
        self.models = _AsyncModels(self)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "User-Agent": "switchroute-python/0.4.0"}

    async def _json(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(method, f"{self._base_url}{path}", headers=self._headers(), **kwargs)
        except httpx.TimeoutException as exc:
            raise RequestTimeoutError("SwitchRoute request timed out.", code="timeout") from exc
        if response.is_error:
            raise error_from_response(response)
        return response.json()

    async def _stream(self, path: str, payload: dict[str, Any]) -> AsyncIterator[ChatCompletionChunk]:
        try:
            async with self._client.stream("POST", f"{self._base_url}{path}", headers={**self._headers(), "Accept": "text/event-stream"}, json=payload) as response:
                if response.is_error:
                    await response.aread()
                    raise error_from_response(response)
                async for item in aiter_sse(response.aiter_lines()):
                    yield item
        except httpx.TimeoutException as exc:
            raise RequestTimeoutError("SwitchRoute stream timed out.", code="timeout") from exc

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> AsyncSwitchRoute:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()
