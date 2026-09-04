from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

PROVIDER_KIND_PATTERN = r"^[a-z0-9][a-z0-9_-]{0,63}$"


class ChatCompletionRequest(BaseModel):
    model_config = {"extra": "allow"}
    model: str = "auto"
    messages: list[dict[str, Any]]
    stream: bool = False


class ProviderConnectionConfig(BaseModel):
    base_url: str | None = Field(default=None, max_length=2048)
    discover_models: bool = True
    manual_model_id: str | None = Field(default=None, min_length=1, max_length=240)


class ProviderCredential(BaseModel):
    provider_kind: str = Field(min_length=1, max_length=64, pattern=PROVIDER_KIND_PATTERN)
    api_key: str = Field(min_length=3, max_length=2048)
    connection: ProviderConnectionConfig | None = None


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
    strategy: Literal[
        "priority", "free_first", "quota_aware", "fastest", "cheapest", "balanced"
    ] = "priority"
    enabled: bool = True
    paid_fallback: Literal["never", "after_free", "allowed"] = "after_free"
    daily_paid_cap_microusd: int | None = Field(default=None, ge=0)
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
