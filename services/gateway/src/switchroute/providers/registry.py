from typing import Any

from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.providers.catalog import (
    PROVIDER_CATALOG,
    PROVIDER_DEFINITIONS,
    ProviderDefinition,
)
from switchroute.providers.test_adapter import TestAdapter


class ProviderRegistry:
    def __init__(self, enable_test_provider: bool = False) -> None:
        self._definitions = dict(PROVIDER_CATALOG)
        self._adapters = {
            definition.id: definition.adapter_factory(definition)
            for definition in PROVIDER_DEFINITIONS
        }
        if enable_test_provider:
            self._adapters["test"] = TestAdapter()

    def get(self, kind: str) -> Any:
        adapter = self._adapters.get(kind)
        if not adapter:
            raise SwitchRouteError(INVALID_REQUEST, f"Unsupported provider: {kind}", 400)
        return adapter

    def definition(self, kind: str) -> ProviderDefinition:
        definition = self._definitions.get(kind)
        if not definition:
            raise SwitchRouteError(INVALID_REQUEST, f"Unsupported provider: {kind}", 400)
        return definition

    @property
    def kinds(self) -> list[str]:
        return sorted(self._adapters)

    @property
    def production_kinds(self) -> list[str]:
        return sorted(self._definitions)

    def public_catalog(self) -> list[dict[str, Any]]:
        return [definition.public_dict() for definition in PROVIDER_DEFINITIONS]
