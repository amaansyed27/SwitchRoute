from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class RequestRequirements:
    capabilities: frozenset[str]


def infer_requirements(payload: dict[str, Any]) -> RequestRequirements:
    required = {"chat"}
    if payload.get("stream") is True:
        required.add("streaming")
    if payload.get("tools") or payload.get("tool_choice") not in (None, "none"):
        required.add("tools")
    if payload.get("response_format") is not None:
        required.add("structured_output")
    if payload.get("reasoning") is not None or payload.get("reasoning_effort") is not None:
        required.add("reasoning")

    messages = payload.get("messages")
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            content = message.get("content")
            if not isinstance(content, list):
                continue
            for part in content:
                if isinstance(part, dict) and str(part.get("type", "")).lower() in {
                    "image", "image_url", "input_image"
                }:
                    required.add("vision")
                    break
    return RequestRequirements(frozenset(required))


def capability_reason(capabilities: tuple[str, ...], provenance: str, required: frozenset[str]) -> str | None:
    available = set(capabilities)
    missing = required - available
    if not missing:
        return None
    if provenance == "unknown":
        return "capability_unknown"
    return "unsupported_capability"
