from typing import Protocol

from switchroute.domain import ProviderModel


class ProviderAdapter(Protocol):
    kind: str

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]: ...

    def litellm_model(self, model_id: str) -> str: ...
