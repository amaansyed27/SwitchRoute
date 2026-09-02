from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

ProviderKind = Literal[
    "openai",
    "anthropic",
    "gemini",
    "groq",
    "xai",
    "mistral",
    "openrouter",
    "test",
]


class ChatCompletionRequest(BaseModel):
    model_config = {"extra": "allow"}
    model: str = "auto"
    messages: list[dict[str, Any]]
    stream: bool = False


class ProviderCredential(BaseModel):
    provider_kind: ProviderKind
    api_key: str = Field(min_length=3, max_length=2048)


class ProviderCreate(ProviderCredential):
    display_name: str = Field(min_length=1, max_length=80)


class RouteTargetInput(BaseModel):
    provider_connection_id: UUID
    model_id: str = Field(min_length=1, max_length=240)
    billing_tier: Literal["free", "free_capable", "paid", "unknown"] = "unknown"
    enabled: bool = True


class RouteWrite(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    slug: str = Field(min_length=2, max_length=64)
    strategy: Literal["priority", "free_first"] = "priority"
    enabled: bool = True
    targets: list[RouteTargetInput] = Field(min_length=1, max_length=20)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        import re

        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,63}", value):
            raise ValueError("Use lowercase letters, numbers and hyphens for the Route slug.")
        return value


class KeyCreate(BaseModel):
    route_id: UUID
    environment: Literal["live", "test"] = "live"
    name: str = Field(min_length=1, max_length=80)
    expires_at: str | None = None
