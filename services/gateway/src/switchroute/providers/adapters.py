from typing import Any

from switchroute.domain import ProviderModel
from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.providers import http as provider_http
from switchroute.providers.model_metadata import (
    common_model as _common_model,
    integer as _integer,
    looks_chat_capable as _looks_chat_capable,
)


class BaseAdapter:
    def __init__(self, definition: Any) -> None:
        self.definition = definition

    def normalize_connection_config(self, config: dict[str, Any] | None) -> dict[str, Any]:
        if config and any(value not in (None, False, "") for value in config.values()):
            raise SwitchRouteError(
                INVALID_REQUEST,
                f"{self.definition.display_name} does not accept a custom endpoint configuration.",
                400,
            )
        return {}

    async def litellm_kwargs(
        self, model_id: str, connection_config: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        result: dict[str, Any] = {"model": f"{self.definition.litellm_mapping}/{model_id}"}
        if self.definition.litellm_api_base:
            result["api_base"] = self.definition.litellm_api_base
        return result


class BearerModelsAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config: dict[str, Any] | None = None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        data = await provider_http.checked_json(
            self.definition.models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            params=dict(self.definition.models_params),
        )
        raw_items = self._items(data)
        models: list[ProviderModel] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("id") or item.get("name") or "").removeprefix("models/")
            if not model_id or not _looks_chat_capable(item, model_id):
                continue
            name = str(
                item.get("display_name")
                or item.get("displayName")
                or item.get("name")
                or model_id
            )
            models.append(_common_model(self.definition, item, model_id, name))
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST,
                f"No chat models were available for this {self.definition.display_name} credential.",
                400,
            )
        return models

    def _items(self, data: Any) -> list[Any]:
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            raw = data.get(self.definition.models_list_key, [])
            return raw if isinstance(raw, list) else []
        return []


class AnthropicAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        data = await provider_http.checked_json(
            self.definition.models_url,
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
        )
        models = []
        for item in data.get("data", []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            models.append(
                _common_model(
                    self.definition,
                    item,
                    str(item["id"]),
                    str(item.get("display_name") or item["id"]),
                )
            )
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Claude chat models were available for this key.", 400
            )
        return models


class GeminiAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        data = await provider_http.checked_json(
            self.definition.models_url, params={"key": api_key, "pageSize": "1000"}
        )
        models: list[ProviderModel] = []
        for item in data.get("models", []):
            if not isinstance(item, dict) or "generateContent" not in item.get(
                "supportedGenerationMethods", []
            ):
                continue
            model_id = str(item.get("name") or "").removeprefix("models/")
            if not model_id:
                continue
            model = _common_model(
                self.definition, item, model_id, str(item.get("displayName") or model_id)
            )
            model.context_window = _integer(item.get("inputTokenLimit"))
            model.max_output_tokens = _integer(item.get("outputTokenLimit"))
            models.append(model)
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Gemini chat models were available for this key.", 400
            )
        return models


class CohereAdapter(BearerModelsAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        data = await provider_http.checked_json(
            self.definition.models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            params={"endpoint": "chat", "page_size": "1000"},
        )
        models = []
        for item in data.get("models", []):
            if not isinstance(item, dict) or item.get("is_deprecated") is True:
                continue
            model_id = str(item.get("name") or "")
            if not model_id:
                continue
            models.append(_common_model(self.definition, item, model_id, model_id))
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Cohere chat models were available for this key.", 400
            )
        return models


class CerebrasAdapter(BearerModelsAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        available = await provider_http.checked_json(
            self.definition.models_url, headers={"Authorization": f"Bearer {api_key}"}
        )
        try:
            public = await provider_http.checked_json("https://api.cerebras.ai/public/v1/models")
        except SwitchRouteError:
            public = {"data": []}
        details = {
            str(item.get("id")): item
            for item in public.get("data", [])
            if isinstance(item, dict) and item.get("id")
        }
        models = []
        for item in available.get("data", []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            model_id = str(item["id"])
            rich = details.get(model_id, item)
            models.append(
                _common_model(
                    self.definition,
                    rich,
                    model_id,
                    str(rich.get("name") or model_id),
                )
            )
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Cerebras chat models were available for this key.", 400
            )
        return models


class TogetherAdapter(BearerModelsAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        return await super().validate_and_discover(api_key, connection_config)


class FireworksAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        data = await provider_http.checked_json(
            self.definition.models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            params={"filter": "supports_serverless=true", "pageSize": "200"},
        )
        raw = data.get("models", data.get("data", [])) if isinstance(data, dict) else []
        models = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("name") or item.get("id") or "")
            if not model_id or not _looks_chat_capable(item, model_id):
                continue
            models.append(
                _common_model(
                    self.definition,
                    item,
                    model_id,
                    str(item.get("displayName") or item.get("display_name") or model_id),
                )
            )
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Fireworks serverless chat models were available.", 400
            )
        return models


class DeepInfraAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        await provider_http.checked_json(
            "https://api.deepinfra.com/models/deployment/list",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        data = await provider_http.checked_json(self.definition.models_url)
        models = []
        for item in data if isinstance(data, list) else []:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("model_name") or "")
            if not model_id or not _looks_chat_capable(item, model_id):
                continue
            model = _common_model(self.definition, item, model_id, model_id)
            model.context_window = _integer(item.get("max_tokens"))
            models.append(model)
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No DeepInfra text-generation models were available.", 400
            )
        return models
