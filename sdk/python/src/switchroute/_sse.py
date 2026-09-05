import json
from collections.abc import AsyncIterator, Iterator
from typing import cast

from ._types import ChatCompletionChunk


def iter_sse(lines: Iterator[str]) -> Iterator[ChatCompletionChunk]:
    data: list[str] = []
    for line in lines:
        line = line.rstrip("\r")
        if not line:
            if data:
                value = "\n".join(data)
                data.clear()
                if value.strip() == "[DONE]":
                    return
                yield cast(ChatCompletionChunk, json.loads(value))
            continue
        if line.startswith("data:"):
            data.append(line[5:].lstrip())


async def aiter_sse(lines: AsyncIterator[str]) -> AsyncIterator[ChatCompletionChunk]:
    data: list[str] = []
    async for line in lines:
        line = line.rstrip("\r")
        if not line:
            if data:
                value = "\n".join(data)
                data.clear()
                if value.strip() == "[DONE]":
                    return
                yield cast(ChatCompletionChunk, json.loads(value))
            continue
        if line.startswith("data:"):
            data.append(line[5:].lstrip())
