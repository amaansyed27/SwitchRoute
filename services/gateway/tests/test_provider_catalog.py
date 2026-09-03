import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from switchroute.api.schemas import PROVIDER_KIND_PATTERN, ProviderCredential
from switchroute.errors import SwitchRouteError
from switchroute.providers import http as provider_http
from switchroute.providers.catalog import PROVIDER_DEFINITIONS
from switchroute.providers.registry import ProviderRegistry

EXPECTED_PRODUCTION_KINDS = {
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
    "custom_openai",
}


def test_catalog_registry_and_api_schema_stay_consistent() -> None:
    registry = ProviderRegistry()
    catalog_kinds = {definition.id for definition in PROVIDER_DEFINITIONS}
    assert catalog_kinds == EXPECTED_PRODUCTION_KINDS
    assert set(registry.production_kinds) == catalog_kinds
    assert len(catalog_kinds) == len(PROVIDER_DEFINITIONS)
    for kind in catalog_kinds:
        assert re.fullmatch(PROVIDER_KIND_PATTERN, kind)
        assert ProviderCredential(provider_kind=kind, api_key="key").provider_kind == kind
        assert registry.get(kind) is not None


def test_api_format_is_flexible_but_registry_is_authoritative() -> None:
    assert (
        ProviderCredential(provider_kind="future_provider", api_key="key").provider_kind
        == "future_provider"
    )
    with pytest.raises(SwitchRouteError):
        ProviderRegistry().get("future_provider")
    with pytest.raises(ValidationError):
        ProviderCredential(provider_kind="bad.provider", api_key="key")


def test_database_constraint_uses_same_safe_format_not_provider_enum() -> None:
    migrations = Path(__file__).resolve().parents[3] / "supabase" / "migrations"
    migration = migrations / "20260903120000_provider_kind_catalog.sql"
    sql = migration.read_text(encoding="utf-8")
    assert "provider_connections_provider_kind_check" in sql
    assert "provider_connections_provider_kind_format_check" in sql
    assert "^[a-z0-9][a-z0-9_-]{0,63}$" in sql
    for kind in EXPECTED_PRODUCTION_KINDS:
        assert f"'{kind}'" not in sql


@pytest.mark.asyncio
async def test_litellm_mapping_exists_for_every_provider(monkeypatch) -> None:
    async def validate(url: str) -> str:
        return url.rstrip("/")

    monkeypatch.setattr(provider_http, "validate_public_https_url", validate)
    registry = ProviderRegistry()
    for definition in PROVIDER_DEFINITIONS:
        config = None
        if definition.id == "custom_openai":
            config = {
                "base_url": "https://models.example/v1",
                "discover_models": False,
                "manual_model_id": "model",
            }
        kwargs = await registry.get(definition.id).litellm_kwargs("model", config)
        assert kwargs["model"].startswith(f"{definition.litellm_mapping}/")
