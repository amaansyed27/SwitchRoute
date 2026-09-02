from typing import Any

import httpx

from switchroute.domain import ProviderModel
from switchroute.errors import INVALID_REQUEST, SwitchRouteError, classify_provider_error


class ProviderResponseError(RuntimeError):
    def __init__(self, status_code: int) -> None:
        super().__init__("provider validation failed")
        self.status_code = status_code


async def _checked_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
) -> Any:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers=headers, params=params)
        if response.status_code in (401, 403):
            raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
        if response.status_code >= 400:
            raise classify_provider_error(ProviderResponseError(response.status_code))
        return response.json()
    except SwitchRouteError:
        raise
    except Exception as exc:
        raise classify_provider_error(exc) from None


NON_CHAT_HINTS = (
    "embedding",
    "embed-",
    "whisper",
    "transcribe",
    "tts",
    "speech",
    "moderation",
    "dall-e",
    "image",
    "rerank",
)


def _looks_chat_capable(item: dict[str, Any], model_id: str) -> bool:
    capabilities = item.get("capabilities")
    if isinstance(capabilities, dict) and capabilities.get("completion_chat") is False:
        return False
    output_modalities = item.get("output_modalities")
    if isinstance(output_modalities, list) and output_modalities and "text" not in output_modalities:
        return False
    lowered = model_id.lower()
    return not any(hint in lowered for hint in NON_CHAT_HINTS)


class BearerModelsAdapter:
    kind = ""
    models_url = ""
    litellm_prefix = ""
    list_key = "data"

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]:
        data = await _checked_json(
            self.models_url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        if isinstance(data, dict):
            raw_items = data.get(self.list_key, [])
        elif isinstance(data, list):
            raw_items = data
        else:
            raw_items = []
        models: list[ProviderModel] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            model_id = str(item.get("id") or item.get("name") or "").removeprefix("models/")
            if not model_id or not _looks_chat_capable(item, model_id):
                continue
            models.append(
                ProviderModel(
                    id=model_id,
                    name=str(item.get("display_name") or item.get("name") or model_id),
                    billing_tier="paid",
                )
            )
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST,
                f"No chat models were available for this {self.kind} credential.",
                400,
            )
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"{self.litellm_prefix}/{model_id}"


class OpenAIAdapter(BearerModelsAdapter):
    kind = "openai"
    models_url = "https://api.openai.com/v1/models"
    litellm_prefix = "openai"


class XAIAdapter(BearerModelsAdapter):
    kind = "xai"
    models_url = "https://api.x.ai/v1/language-models"
    litellm_prefix = "xai"
    list_key = "models"


class MistralAdapter(BearerModelsAdapter):
    kind = "mistral"
    models_url = "https://api.mistral.ai/v1/models"
    litellm_prefix = "mistral"


class AnthropicAdapter:
    kind = "anthropic"

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]:
        data = await _checked_json(
            "https://api.anthropic.com/v1/models",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
        )
        models = [
            ProviderModel(
                id=item["id"],
                name=item.get("display_name", item["id"]),
                billing_tier="paid",
            )
            for item in data.get("data", [])
            if isinstance(item, dict) and item.get("id")
        ]
        if not models:
            raise SwitchRouteError(
                INVALID_REQUEST,
                "No Claude models were available for this Anthropic credential.",
                400,
            )
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"anthropic/{model_id}"


class GroqAdapter:
    kind = "groq"

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]:
        data = await _checked_json(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        models = [
            ProviderModel(id=item["id"], name=item["id"], billing_tier="free_capable")
            for item in data.get("data", [])
            if item.get("active", True) and "whisper" not in item.get("id", "").lower()
        ]
        if not models:
            raise SwitchRouteError(INVALID_REQUEST, "No chat models were available for this Groq key.", 400)
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"groq/{model_id}"


class GeminiAdapter:
    kind = "gemini"

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]:
        data = await _checked_json(
            "https://generativelanguage.googleapis.com/v1beta/models",
            params={"key": api_key},
        )
        models: list[ProviderModel] = []
        for item in data.get("models", []):
            methods = item.get("supportedGenerationMethods", [])
            if "generateContent" not in methods:
                continue
            model_id = item.get("name", "").removeprefix("models/")
            if model_id:
                models.append(
                    ProviderModel(
                        id=model_id,
                        name=item.get("displayName", model_id),
                        billing_tier="free_capable",
                    )
                )
        if not models:
            raise SwitchRouteError(INVALID_REQUEST, "No Gemini chat models were available for this key.", 400)
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"gemini/{model_id.removeprefix('models/')}"


class OpenRouterAdapter:
    kind = "openrouter"

    async def validate_and_discover(self, api_key: str) -> list[ProviderModel]:
        headers = {"Authorization": f"Bearer {api_key}"}
        await _checked_json("https://openrouter.ai/api/v1/key", headers=headers)
        data = await _checked_json("https://openrouter.ai/api/v1/models", headers=headers)
        models: list[ProviderModel] = []
        for item in data.get("data", []):
            pricing = item.get("pricing") or {}
            is_free = item.get("id", "").endswith(":free") or (
                str(pricing.get("prompt")) == "0" and str(pricing.get("completion")) == "0"
            )
            models.append(
                ProviderModel(
                    id=item["id"],
                    name=item.get("name", item["id"]),
                    billing_tier="free" if is_free else "paid",
                )
            )
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"openrouter/{model_id}"
