from typing import Any

from switchroute.domain import ProviderModel
from switchroute.errors import SwitchRouteError


class TestAdapter:
    """Deterministic local/CI provider. Never enabled by default."""

    kind = "test"

    def normalize_connection_config(self, config: dict[str, Any] | None) -> dict[str, Any]:
        return {}

    async def validate_and_discover(
        self, api_key: str, connection_config: dict[str, Any] | None = None
    ) -> list[ProviderModel]:
        if api_key != "switchroute-test-key":
            raise SwitchRouteError(
                "provider_auth_error", "Test provider rejected this credential.", 400
            )
        return [
            ProviderModel(
                id="test/chat",
                name="Deterministic Chat",
                billing_tier="free",
                metadata_provenance="curated",
            )
        ]

    async def litellm_kwargs(
        self, model_id: str, connection_config: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        return {"model": model_id}
