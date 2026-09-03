from typing import Any

from switchroute.domain import ProviderModel
from switchroute.errors import INVALID_REQUEST, SwitchRouteError
from switchroute.providers import http as provider_http
from switchroute.providers.adapters import BaseAdapter
from switchroute.providers.model_metadata import (
    common_model as _common_model,
    integer as _integer,
    looks_chat_capable as _looks_chat_capable,
)


class OpenRouterAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        headers = {"Authorization": f"Bearer {api_key}"}
        await provider_http.checked_json("https://openrouter.ai/api/v1/key", headers=headers)
        data = await provider_http.checked_json(self.definition.models_url, headers=headers)
        models = []
        for item in data.get("data", []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            model_id = str(item["id"])
            model = _common_model(
                self.definition, item, model_id, str(item.get("name") or model_id)
            )
            pricing = item.get("pricing") or {}
            if model_id.endswith(":free") or (
                str(pricing.get("prompt")) == "0"
                and str(pricing.get("completion")) == "0"
            ):
                model.billing_tier = "free"
            top = item.get("top_provider") or {}
            model.max_output_tokens = _integer(top.get("max_completion_tokens"))
            models.append(model)
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No OpenRouter chat models were available.", 400
            )
        return models


class HuggingFaceAdapter(BaseAdapter):
    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        self.normalize_connection_config(connection_config)
        headers = {"Authorization": f"Bearer {api_key}"}
        await provider_http.checked_json("https://huggingface.co/api/whoami-v2", headers=headers)
        data = await provider_http.checked_json(self.definition.models_url, headers=headers)
        models = []
        for item in data.get("data", []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            model_id = str(item["id"])
            providers = [
                value
                for value in item.get("providers", [])
                if isinstance(value, dict) and value.get("status") == "live"
            ]
            context_values = [_integer(value.get("context_length")) for value in providers]
            context_values = [value for value in context_values if value is not None]
            capabilities = {"chat"}
            if any(value.get("supports_tools") is True for value in providers):
                capabilities.add("tools")
            if any(value.get("supports_structured_output") is True for value in providers):
                capabilities.add("structured_output")
            architecture = item.get("architecture") or {}
            if "image" in architecture.get("input_modalities", []):
                capabilities.add("vision")
            is_free = any(value.get("is_free") is True for value in providers)
            models.append(
                ProviderModel(
                    id=model_id,
                    name=str(item.get("name") or model_id),
                    billing_tier="free_capable" if is_free else "unknown",
                    context_window=max(context_values) if context_values else None,
                    capabilities=sorted(capabilities),
                    metadata_provenance="provider",
                )
            )
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST, "No Hugging Face chat models were available.", 400
            )
        return models


class CustomOpenAIAdapter(BaseAdapter):
    def normalize_connection_config(self, config: dict[str, Any] | None) -> dict[str, Any]:
        value = dict(config or {})
        base_url = str(value.get("base_url") or "").strip().rstrip("/")
        if not base_url:
            raise SwitchRouteError(
                INVALID_REQUEST, "A base URL is required for a custom endpoint.", 400
            )
        manual_model_id = str(value.get("manual_model_id") or "").strip() or None
        discover_models = bool(value.get("discover_models", True))
        if not discover_models and not manual_model_id:
            raise SwitchRouteError(
                INVALID_REQUEST,
                "Provide a manual model ID when model discovery is disabled.",
                400,
            )
        return {
            "base_url": base_url,
            "discover_models": discover_models,
            "manual_model_id": manual_model_id,
        }

    async def validate_and_discover(
        self, api_key: str, connection_config=None
    ) -> list[ProviderModel]:
        config = self.normalize_connection_config(connection_config)
        base_url = await provider_http.validate_public_https_url(config["base_url"])
        headers = {"Authorization": f"Bearer {api_key}"}
        models: list[ProviderModel] = []
        if config["discover_models"]:
            status, data = await provider_http.safe_cloud_json(
                "GET",
                f"{base_url}/models",
                headers=headers,
                allowed_statuses={404, 405},
            )
            if status == 200 and isinstance(data, dict):
                for item in data.get("data", []):
                    if not isinstance(item, dict) or not item.get("id"):
                        continue
                    model_id = str(item["id"])
                    if _looks_chat_capable(item, model_id):
                        models.append(
                            _common_model(self.definition, item, model_id, model_id)
                        )
        manual = config.get("manual_model_id")
        if not models and manual:
            models = [
                ProviderModel(id=manual, name=manual, metadata_provenance="unknown")
            ]
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST,
                "Model discovery was unavailable. Provide a manual model ID for this endpoint.",
                400,
            )
        probe_model = str(manual or models[0].id)
        await provider_http.safe_cloud_json(
            "POST",
            f"{base_url}/chat/completions",
            headers={**headers, "Content-Type": "application/json"},
            json={
                "model": probe_model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
                "stream": False,
            },
        )
        return models

    async def litellm_kwargs(
        self, model_id: str, connection_config=None
    ) -> dict[str, Any]:
        config = self.normalize_connection_config(connection_config)
        base_url = await provider_http.validate_public_https_url(config["base_url"])
        return {"model": f"openai/{model_id}", "api_base": base_url}
