import json

import httpx
import pytest

from switchroute import AsyncSwitchRoute, AuthenticationError, SwitchRoute


def test_chat_completion_and_models_use_public_contract() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path.endswith("/models"):
            return httpx.Response(200, json={"object": "list", "data": []})
        return httpx.Response(200, json={"id": "c1", "object": "chat.completion", "created": 1, "model": "auto", "choices": []})

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as raw:
        client = SwitchRoute(api_key="sr_test_example", base_url="https://example.test/v1", http_client=raw)
        response = client.chat.completions.create(messages=[{"role": "user", "content": "hello"}])
        assert response["id"] == "c1"
        assert client.models.list()["object"] == "list"
    assert seen[0].headers["authorization"] == "Bearer sr_test_example"
    assert json.loads(seen[0].content)["model"] == "auto"


def test_streaming_decodes_sse() -> None:
    payload = b'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"auto","choices":[]}\n\ndata: [DONE]\n\n'
    transport = httpx.MockTransport(lambda _: httpx.Response(200, content=payload, headers={"content-type": "text/event-stream"}))
    with httpx.Client(transport=transport) as raw:
        client = SwitchRoute(api_key="sr_test_example", http_client=raw)
        stream = client.chat.completions.create(messages=[], stream=True)
        assert list(stream)[0]["id"] == "c1"


def test_normalized_auth_error_is_typed() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(401, json={"error": {"code": "authentication_error", "message": "Invalid SwitchRoute key."}}))
    with httpx.Client(transport=transport) as raw:
        client = SwitchRoute(api_key="bad", http_client=raw)
        with pytest.raises(AuthenticationError):
            client.models.list()


@pytest.mark.asyncio
async def test_async_client() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"object": "list", "data": []}))
    async with httpx.AsyncClient(transport=transport) as raw:
        client = AsyncSwitchRoute(api_key="sr_test_example", http_client=raw)
        result = await client.models.list()
        assert result["data"] == []
