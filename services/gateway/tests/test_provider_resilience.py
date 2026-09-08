import pytest

from switchroute.errors import SwitchRouteError
from switchroute.providers import http as provider_http
from switchroute.providers.registry import ProviderRegistry


@pytest.mark.asyncio
async def test_cerebras_public_enrichment_outage_keeps_authenticated_models(monkeypatch) -> None:
    async def fake(url: str, **kwargs):
        if "/public/" in url:
            raise SwitchRouteError("provider_unavailable", "Public metadata unavailable.", 502)
        return {"data": [{"id": "cerebras-test"}]}

    monkeypatch.setattr(provider_http, "checked_json", fake)
    models = await ProviderRegistry().get("cerebras").validate_and_discover("key")
    assert [model.id for model in models] == ["cerebras-test"]
    assert models[0].metadata_provenance == "provider"
