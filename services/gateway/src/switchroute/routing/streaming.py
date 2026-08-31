import json
from typing import Any


def object_dict(value: Any) -> dict:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(exclude_none=True)
    return dict(value)


def chunk_has_content(chunk: Any) -> bool:
    data = object_dict(chunk)
    for choice in data.get("choices") or []:
        delta = choice.get("delta") or {}
        if delta.get("content") or delta.get("tool_calls") or delta.get("function_call"):
            return True
        if delta.get("reasoning_content") or choice.get("finish_reason"):
            return True
    return bool(data.get("error"))


def normalized_chunk(chunk: Any) -> dict:
    data = object_dict(chunk)
    if "model" in data:
        data["model"] = "auto"
    return data


def sse_data(data: dict) -> bytes:
    return f"data: {json.dumps(data, separators=(',', ':'), default=str)}\n\n".encode()


def sse_error(code: str, message: str) -> bytes:
    return sse_data({"error": {"message": message, "type": code, "code": code}})


def sse_done() -> bytes:
    return b"data: [DONE]\n\n"


def usage_from(data: Any) -> tuple[int | None, int | None]:
    payload = object_dict(data)
    usage = payload.get("usage") or {}
    input_tokens = usage.get("prompt_tokens") or usage.get("input_tokens")
    output_tokens = usage.get("completion_tokens") or usage.get("output_tokens")
    return input_tokens, output_tokens
