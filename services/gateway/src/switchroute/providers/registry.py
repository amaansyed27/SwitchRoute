from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.providers.adapters import GeminiAdapter, GroqAdapter, OpenRouterAdapter
from switchroute.providers.base import ProviderAdapter
from switchroute.providers.test_adapter import TestAdapter


class ProviderRegistry:
    def __init__(self, enable_test_provider: bool = False) -> None:
        adapters: list[ProviderAdapter] = [GroqAdapter(), GeminiAdapter(), OpenRouterAdapter()]
        if enable_test_provider:
            adapters.append(TestAdapter())
        self._adapters = {adapter.kind: adapter for adapter in adapters}

    def get(self, kind: str) -> ProviderAdapter:
        adapter = self._adapters.get(kind)
        if not adapter:
            raise SwitchRouteError(INVALID_REQUEST, f"Unsupported provider: {kind}", 400)
        return adapter

    @property
    def kinds(self) -> list[str]:
        return sorted(self._adapters)
