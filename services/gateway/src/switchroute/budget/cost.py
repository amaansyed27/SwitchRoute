import math
from typing import Any

from switchroute.domain import Candidate


def estimate_request_tokens(payload: dict[str, Any]) -> tuple[int, int]:
    """Estimate tokens in memory only. Content is never logged or persisted."""
    chars = 0

    def visit(value: Any) -> None:
        nonlocal chars
        if isinstance(value, str):
            chars += len(value)
        elif isinstance(value, list):
            for item in value:
                visit(item)
        elif isinstance(value, dict):
            for key, item in value.items():
                if key not in {"image_url", "input_image"}:
                    visit(item)

    visit(payload.get("messages", []))
    visit(payload.get("tools", []))
    input_tokens = max(1, math.ceil(chars / 4))
    output_hint = payload.get("max_completion_tokens", payload.get("max_tokens", 256))
    try:
        output_tokens = max(1, int(output_hint))
    except (TypeError, ValueError):
        output_tokens = 256
    return input_tokens, output_tokens


def cost_microusd(candidate: Candidate, input_tokens: int, output_tokens: int) -> int | None:
    input_price = candidate.input_price_per_million_usd
    output_price = candidate.output_price_per_million_usd
    if input_price is None or output_price is None:
        return None
    # USD / million tokens converts numerically to micro-USD per token.
    return max(0, round(input_price * input_tokens + output_price * output_tokens))
