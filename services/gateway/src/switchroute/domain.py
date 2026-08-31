from dataclasses import dataclass, field
from typing import Any
from uuid import UUID


@dataclass(slots=True)
class ProviderModel:
    id: str
    name: str
    billing_tier: str = "unknown"
    capabilities: list[str] = field(default_factory=lambda: ["chat"])


@dataclass(slots=True)
class Candidate:
    target_id: UUID
    provider_connection_id: UUID
    provider_kind: str
    model_id: str
    billing_tier: str
    position: int


@dataclass(slots=True)
class VirtualKeyContext:
    key_id: UUID
    workspace_id: UUID
    route_id: UUID
    route_name: str
    route_slug: str
    strategy: str
    route_enabled: bool
    candidates: list[Candidate]


@dataclass(slots=True)
class UsageRecord:
    request_id: UUID
    workspace_id: UUID
    route_id: UUID
    virtual_key_id: UUID
    provider_connection_id: UUID | None
    provider_kind: str | None
    model_id: str | None
    input_tokens: int | None
    output_tokens: int | None
    latency_ms: int
    status: str
    fallback_count: int
    error_category: str | None = None
    estimated_cost_microusd: int | None = None


JsonObject = dict[str, Any]
