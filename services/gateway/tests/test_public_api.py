from types import SimpleNamespace
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from switchroute.api.public import router as public_router
from switchroute.auth.virtual_keys import create_virtual_key
from switchroute.domain import Candidate, VirtualKeyContext
from switchroute.providers.registry import ProviderRegistry
from switchroute.routing.invoker import LiteLLMInvoker


class Repository:
    def __init__(self, expected_hash: str, context: VirtualKeyContext) -> None:
        self.expected_hash = expected_hash
        self.context = context
        self.records = []
        self.used = False

    async def resolve_virtual_key(self, key_hash: str):
        return self.context if key_hash == self.expected_hash else None

    async def provider_secret(self, workspace_id, provider_id):
        return "test", "encrypted", "test-v1", {}

    async def mark_key_used(self, key_id):
        self.used = True

    async def record_usage(self, record):
        self.records.append(record)


class Secrets:
    def decrypt(self, ciphertext: str, key_id: str) -> str:
        return "switchroute-test-key"


def build_client() -> tuple[TestClient, str, Repository]:
    raw_key, _, key_hash = create_virtual_key("live", "test-pepper")
    context = VirtualKeyContext(
        key_id=UUID(int=1),
        workspace_id=UUID(int=2),
        route_id=UUID(int=3),
        route_name="Coding",
        route_slug="coding",
        strategy="priority",
        route_enabled=True,
        candidates=[Candidate(UUID(int=4), UUID(int=5), "test", "test/chat", "free", 0)],
    )
    repository = Repository(key_hash, context)
    providers = ProviderRegistry(enable_test_provider=True)
    services = SimpleNamespace(
        settings=SimpleNamespace(switchroute_key_pepper="test-pepper"),
        repository=repository,
        secrets=Secrets(),
        invoker=LiteLLMInvoker(providers, enable_test_provider=True),
    )
    app = FastAPI()
    app.state.services = services
    app.include_router(public_router)
    return TestClient(app), raw_key, repository


def test_route_bound_key_exposes_auto_model_and_completes() -> None:
    client, raw_key, repository = build_client()
    headers = {"Authorization": f"Bearer {raw_key}"}

    models = client.get("/v1/models", headers=headers)
    assert models.status_code == 200
    assert [item["id"] for item in models.json()["data"]] == ["auto", "coding"]
    assert models.headers["x-switchroute-route"] == "coding"

    response = client.post(
        "/v1/chat/completions",
        headers=headers,
        json={"model": "auto", "messages": [{"role": "user", "content": "Hello"}]},
    )
    assert response.status_code == 200
    assert response.json()["model"] == "auto"
    assert response.json()["choices"][0]["message"]["content"] == "SwitchRoute test OK"
    assert response.headers["x-switchroute-route"] == "coding"
    assert repository.used is True
    assert repository.records[-1].status == "success"


def test_stream_uses_openai_sse_and_finishes_once() -> None:
    client, raw_key, repository = build_client()
    response = client.post(
        "/v1/chat/completions",
        headers={"Authorization": f"Bearer {raw_key}"},
        json={
            "model": "auto",
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": True,
        },
    )
    assert response.status_code == 200
    assert "SwitchRoute test OK" in response.text
    assert response.text.count("data: [DONE]") == 1
    assert '"model":"auto"' in response.text
    assert response.headers["x-switchroute-route"] == "coding"
    assert repository.records[-1].status == "success"
