import json

import httpx
from openai import OpenAI


def handler(request: httpx.Request) -> httpx.Response:
    assert request.method == "POST"
    assert request.url.path == "/v1/chat/completions"
    assert request.headers["authorization"] == "Bearer sr_live_compat"
    payload = json.loads(request.content)
    assert payload["model"] == "auto"
    assert payload["messages"] == [{"role": "user", "content": "Hello"}]
    return httpx.Response(
        200,
        headers={"X-SwitchRoute-Request-ID": "00000000-0000-0000-0000-000000000001"},
        json={
            "id": "chatcmpl_compat",
            "object": "chat.completion",
            "created": 1,
            "model": "auto",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "ok"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        },
    )


client = OpenAI(
    api_key="sr_live_compat",
    base_url="https://api.switchroute.dawnlightlabs.com/v1",
    http_client=httpx.Client(transport=httpx.MockTransport(handler)),
)
response = client.chat.completions.create(
    model="auto", messages=[{"role": "user", "content": "Hello"}]
)
assert response.choices[0].message.content == "ok"
print("OpenAI Python SDK compatibility: ok")
