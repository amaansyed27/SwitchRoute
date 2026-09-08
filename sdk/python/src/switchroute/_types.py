from typing import Any, Literal, TypedDict


class ChatMessage(TypedDict, total=False):
    role: str
    content: Any


class ChatCompletion(TypedDict, total=False):
    id: str
    object: str
    created: int
    model: str
    choices: list[Any]
    usage: dict[str, Any]


class ChatCompletionChunk(TypedDict, total=False):
    id: str
    object: str
    created: int
    model: str
    choices: list[Any]


class Model(TypedDict, total=False):
    id: str
    object: str
    created: int
    owned_by: str


class ModelList(TypedDict):
    object: Literal["list"] | str
    data: list[Model]
