from typing import Any, Protocol

from switchroute.domain import ProviderModel


class ProviderAdapter(Protocol):
    definition: Any

    def normalize_connection_config(self, config: dict[str, Any] | None) -> dict[str, Any]: ...

    async def validate_and_discover(
        self, api_key: str, connection_config: dict[str, Any] | None = None
    ) -> list[ProviderModel]: ...

    async def litellm_kwargs(
        self, model_id: str, connection_config: dict[str, Any] | None = None
    ) -> dict[str, Any]: ...
