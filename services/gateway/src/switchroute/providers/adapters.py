import httpx

from switchroute.domain import ProviderModel
from switchroute.errors import INVALID_REQUEST, SwitchRouteError, classify_provider_error


async def _checked_json(url: str, *, headers: dict[str, str] | None = None, params: dict[str, str] | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url, headers=headers, params=params)
        if response.status_code in (401, 403):
            raise SwitchRouteError("provider_auth_error", "Provider rejected this credential.", 400)
        if response.status_code >= 400:
            error = RuntimeError("provider validation failed")
            setattr(error, "status_code", response.status_code)
            raise classify_provider_error(error)
        return response.json()
    except SwitchRouteError:
        raise
    except Exception as exc:
        raise classify_provider_error(exc) from None


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
        data = await _checked_json("https://generativelanguage.googleapis.com/v1beta/models", params={"key": api_key})
        models: list[ProviderModel] = []
        for item in data.get("models", []):
            methods = item.get("supportedGenerationMethods", [])
            if "generateContent" not in methods:
                continue
            model_id = item.get("name", "").removeprefix("models/")
            if model_id:
                models.append(ProviderModel(id=model_id, name=item.get("displayName", model_id), billing_tier="free_capable"))
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
            models.append(ProviderModel(id=item["id"], name=item.get("name", item["id"]), billing_tier="free" if is_free else "paid"))
        return models

    def litellm_model(self, model_id: str) -> str:
        return f"openrouter/{model_id}"
