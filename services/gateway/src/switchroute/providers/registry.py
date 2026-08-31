from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.providers.adapters import GeminiAdapter, GroqAdapter, OpenRouterAdapter
from switchroute.providers.base import ProviderAdapter


class ProviderRegistry:
    def __init__(self) -> None:
        adapters = [GroqAdapter(), GeminiAdapter(), OpenRouterAdapter()]
        self._adapters: dict[str, ProviderAdapter] = {adapter.kind: adapter for adapter in adapters}

    def get(self, kind: str) -> ProviderAdapter:
        adapter = self._adapters.get(kind)
        if not adapter:
            raise SwitchRouteError(INVALID_REQUEST, f"Unsupported provider: {kind}", 400)
        return adapter

    @property
    def kinds(self) -> list[str]:
        return sorted(self._adapters)
