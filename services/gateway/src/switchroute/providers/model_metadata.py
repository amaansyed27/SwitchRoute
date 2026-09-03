from typing import Any

from switchroute.domain import ProviderModel

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

KNOWN_CAPABILITIES = {"chat", "streaming", "tools", "vision", "reasoning", "structured_output"}


def number(value: Any) -> float | None:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def integer(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def per_million(value: Any, unit: str) -> float | None:
    value_number = number(value)
    if value_number is None:
        return None
    return value_number * 1_000_000 if unit == "per_token" else value_number


def billing(input_price: float | None, output_price: float | None) -> str:
    known = [price for price in (input_price, output_price) if price is not None]
    if not known:
        return "unknown"
    return "free" if all(price == 0 for price in known) else "paid"


def looks_chat_capable(item: dict[str, Any], model_id: str) -> bool:
    capabilities = item.get("capabilities")
    if isinstance(capabilities, dict) and capabilities.get("completion_chat") is False:
        return False
    model_type = str(item.get("type") or item.get("reported_type") or "").lower()
    if model_type and model_type not in {"chat", "language", "code", "text-generation", "llm"}:
        return False
    output_modalities = item.get("output_modalities")
    if isinstance(output_modalities, list) and output_modalities and "text" not in output_modalities:
        return False
    lowered = model_id.lower()
    return not any(hint in lowered for hint in NON_CHAT_HINTS)


def capabilities(item: dict[str, Any]) -> list[str]:
    values = {"chat"}
    raw = item.get("capabilities")
    if isinstance(raw, dict):
        if raw.get("streaming") is True:
            values.add("streaming")
        if raw.get("function_calling") is True or raw.get("tools") is True:
            values.add("tools")
        if raw.get("vision") is True:
            values.add("vision")
        if raw.get("reasoning") is True:
            values.add("reasoning")
        if raw.get("structured_outputs") is True or raw.get("json_mode") is True:
            values.add("structured_output")
    supported = item.get("supported_parameters")
    if isinstance(supported, list):
        if any(value in supported for value in ("tools", "tool_choice")):
            values.add("tools")
        if any(value in supported for value in ("response_format", "structured_outputs")):
            values.add("structured_output")
    architecture = item.get("architecture")
    if isinstance(architecture, dict):
        inputs = architecture.get("input_modalities")
        if isinstance(inputs, list) and any(value in inputs for value in ("image", "vision")):
            values.add("vision")
    return sorted(values & KNOWN_CAPABILITIES)


def common_model(definition: Any, item: dict[str, Any], model_id: str, name: str) -> ProviderModel:
    pricing_value = item.get("pricing")
    pricing: dict[str, Any] = pricing_value if isinstance(pricing_value, dict) else {}
    limits_value = item.get("limits")
    limits: dict[str, Any] = limits_value if isinstance(limits_value, dict) else {}
    input_raw = pricing.get("input", pricing.get("prompt"))
    output_raw = pricing.get("output", pricing.get("completion"))
    input_price = per_million(input_raw, definition.pricing_unit)
    output_price = per_million(output_raw, definition.pricing_unit)
    context = integer(
        item.get("context_length")
        or item.get("max_context_length")
        or item.get("max_model_len")
        or limits.get("max_context_length")
    )
    max_output = integer(
        item.get("max_completion_tokens")
        or item.get("max_output_tokens")
        or limits.get("max_completion_tokens")
    )
    tier = (
        billing(input_price, output_price)
        if input_price is not None or output_price is not None
        else definition.default_billing_tier
    )
    return ProviderModel(
        id=model_id,
        name=name,
        billing_tier=tier,
        input_price_per_million_usd=input_price,
        output_price_per_million_usd=output_price,
        context_window=context,
        max_output_tokens=max_output,
        capabilities=capabilities(item),
        metadata_provenance="provider",
    )
