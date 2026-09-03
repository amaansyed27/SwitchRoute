from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from switchroute.providers.adapters import (
    AnthropicAdapter,
    BearerModelsAdapter,
    CerebrasAdapter,
    CohereAdapter,
    DeepInfraAdapter,
    FireworksAdapter,
    GeminiAdapter,
    TogetherAdapter,
)
from switchroute.providers.gateway_adapters import (
    CustomOpenAIAdapter,
    HuggingFaceAdapter,
    OpenRouterAdapter,
)


@dataclass(frozen=True, slots=True)
class ProviderDefinition:
    id: str
    display_name: str
    company: str
    category: str
    auth_type: str
    adapter_factory: Callable[[Any], Any]
    litellm_mapping: str
    supports_model_discovery: bool
    free_usage_may_exist: bool | None
    documentation_slug: str
    description: str
    mark: str
    models_url: str = ""
    models_list_key: str = "data"
    models_params: tuple[tuple[str, str], ...] = field(default_factory=tuple)
    pricing_unit: str = "per_token"
    litellm_api_base: str | None = None
    requires_base_url: bool = False
    supports_manual_model: bool = False
    default_billing_tier: str = "unknown"

    def public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "company": self.company,
            "category": self.category,
            "auth_type": self.auth_type,
            "litellm_mapping": self.litellm_mapping,
            "supports_model_discovery": self.supports_model_discovery,
            "free_usage_may_exist": self.free_usage_may_exist,
            "documentation_slug": self.documentation_slug,
            "description": self.description,
            "mark": self.mark,
            "requires_base_url": self.requires_base_url,
            "supports_manual_model": self.supports_manual_model,
        }


def _provider(
    id: str,
    name: str,
    company: str,
    category: str,
    adapter: Callable[[Any], Any],
    mapping: str,
    models_url: str,
    description: str,
    mark: str,
    *,
    free: bool | None = None,
    list_key: str = "data",
    pricing_unit: str = "per_token",
    api_base: str | None = None,
    default_billing_tier: str = "unknown",
) -> ProviderDefinition:
    return ProviderDefinition(
        id=id,
        display_name=name,
        company=company,
        category=category,
        auth_type="api_key",
        adapter_factory=adapter,
        litellm_mapping=mapping,
        supports_model_discovery=True,
        free_usage_may_exist=free,
        documentation_slug=id.replace("_", "-"),
        description=description,
        mark=mark,
        models_url=models_url,
        models_list_key=list_key,
        pricing_unit=pricing_unit,
        litellm_api_base=api_base,
        default_billing_tier=default_billing_tier,
    )


PROVIDER_DEFINITIONS: tuple[ProviderDefinition, ...] = (
    _provider("openai", "OpenAI", "OpenAI", "direct", BearerModelsAdapter, "openai", "https://api.openai.com/v1/models", "GPT and reasoning models through the direct API.", "OA", free=False),
    _provider("anthropic", "Anthropic", "Anthropic", "direct", AnthropicAdapter, "anthropic", "https://api.anthropic.com/v1/models", "Claude models through the direct Anthropic API.", "AN", free=False),
    _provider("gemini", "Google Gemini", "Google", "direct", GeminiAdapter, "gemini", "https://generativelanguage.googleapis.com/v1beta/models", "Gemini models through the Gemini Developer API.", "G", free=True, list_key="models", default_billing_tier="free_capable"),
    _provider("xai", "xAI", "xAI", "direct", BearerModelsAdapter, "xai", "https://api.x.ai/v1/language-models", "Grok models through the direct xAI API.", "x", free=None, list_key="models"),
    _provider("mistral", "Mistral AI", "Mistral AI", "direct", BearerModelsAdapter, "mistral", "https://api.mistral.ai/v1/models", "Mistral and Codestral-family models through La Plateforme.", "M", free=None),
    _provider("deepseek", "DeepSeek", "DeepSeek", "direct", BearerModelsAdapter, "deepseek", "https://api.deepseek.com/models", "DeepSeek chat and reasoning models through the direct API.", "DS", free=None),
    _provider("cohere", "Cohere", "Cohere", "direct", CohereAdapter, "cohere_chat", "https://api.cohere.com/v1/models", "Command-family chat models through Cohere.", "CO", free=None, list_key="models", pricing_unit="per_million"),
    _provider("groq", "Groq", "Groq", "inference", BearerModelsAdapter, "groq", "https://api.groq.com/openai/v1/models", "Low-latency hosted inference across supported chat models.", "GQ", free=True, default_billing_tier="free_capable"),
    _provider("cerebras", "Cerebras", "Cerebras", "inference", CerebrasAdapter, "cerebras", "https://api.cerebras.ai/v1/models", "Fast hosted inference on Cerebras Inference.", "CB", free=True, default_billing_tier="free_capable"),
    _provider("nvidia_nim", "NVIDIA NIM", "NVIDIA", "inference", BearerModelsAdapter, "nvidia_nim", "https://integrate.api.nvidia.com/v1/models", "Hosted NVIDIA API Catalog models through the NIM-compatible API.", "NV", free=None, api_base="https://integrate.api.nvidia.com/v1"),
    _provider("sambanova", "SambaNova", "SambaNova", "inference", BearerModelsAdapter, "sambanova", "https://api.sambanova.ai/v1/models", "SambaCloud hosted model inference.", "SN", free=None),
    _provider("together", "Together AI", "Together AI", "inference", TogetherAdapter, "together_ai", "https://api.together.ai/v1/models", "Together hosted open-model inference.", "TO", free=True, pricing_unit="per_million"),
    _provider("fireworks", "Fireworks AI", "Fireworks AI", "inference", FireworksAdapter, "fireworks_ai", "https://api.fireworks.ai/v1/accounts/fireworks/models", "Fireworks serverless text and vision model inference.", "FW", free=None),
    _provider("deepinfra", "DeepInfra", "DeepInfra", "inference", DeepInfraAdapter, "deepinfra", "https://api.deepinfra.com/models/list", "DeepInfra hosted text-generation models.", "DI", free=None, pricing_unit="per_million"),
    _provider("openrouter", "OpenRouter", "OpenRouter", "gateway", OpenRouterAdapter, "openrouter", "https://openrouter.ai/api/v1/models", "A multi-provider model gateway with broad model coverage.", "OR", free=True),
    _provider("huggingface", "Hugging Face Inference Providers", "Hugging Face", "gateway", HuggingFaceAdapter, "openai", "https://router.huggingface.co/v1/models", "Hugging Face's OpenAI-compatible router across Inference Providers.", "HF", free=True, pricing_unit="per_million", api_base="https://router.huggingface.co/v1"),
    ProviderDefinition(
        id="custom_openai",
        display_name="Custom OpenAI-compatible",
        company="Custom",
        category="gateway",
        auth_type="api_key_and_endpoint",
        adapter_factory=CustomOpenAIAdapter,
        litellm_mapping="openai",
        supports_model_discovery=True,
        free_usage_may_exist=None,
        documentation_slug="custom-openai",
        description="Connect an arbitrary public HTTPS OpenAI-compatible cloud endpoint.",
        mark="<>",
        pricing_unit="per_token",
        requires_base_url=True,
        supports_manual_model=True,
    ),
)

PROVIDER_CATALOG = {definition.id: definition for definition in PROVIDER_DEFINITIONS}
