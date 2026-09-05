from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import Candidate, VirtualKeyContext
from switchroute.errors import ROUTE_NOT_FOUND, SwitchRouteError
from switchroute.storage.postgres_base import record_dict


async def create_key(
    pool: asyncpg.Pool,
    workspace_id: UUID,
    route_id: UUID,
    environment: str,
    name: str,
    prefix: str,
    key_hash: str,
    expires_at: str | None,
) -> dict[str, Any]:
    row = await pool.fetchrow(
        """with inserted as (
          insert into public.virtual_api_keys(workspace_id,route_id,environment,name,prefix,key_hash,expires_at)
          select $1,$2,$3,$4,$5,$6,case when $7::text is null then null else $7::text::timestamptz end
          where exists(select 1 from public.routes where id=$2 and workspace_id=$1)
          returning id,workspace_id,route_id,environment,name,prefix,status,last_used_at,expires_at,created_at
        )
        select inserted.*,r.name route_name from inserted join public.routes r on r.id=inserted.route_id""",
        workspace_id, route_id, environment, name, prefix, key_hash, expires_at,
    )
    if not row:
        raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
    return record_dict(row)


async def list_keys(pool: asyncpg.Pool, workspace_id: UUID) -> list[dict[str, Any]]:
    rows = await pool.fetch(
        """select k.id,k.route_id,k.environment,k.name,k.prefix,k.status,k.last_used_at,
        k.expires_at,k.created_at,k.revoked_at,r.name route_name
        from public.virtual_api_keys k join public.routes r on r.id=k.route_id
        where k.workspace_id=$1 order by k.created_at desc""",
        workspace_id,
    )
    return [record_dict(row) for row in rows]


async def revoke_key(pool: asyncpg.Pool, workspace_id: UUID, key_id: UUID) -> None:
    result = await pool.execute(
        "update public.virtual_api_keys set status='revoked',revoked_at=now() where id=$1 and workspace_id=$2 and status='active'",
        key_id, workspace_id,
    )
    if result == "UPDATE 0":
        raise SwitchRouteError("key_not_found", "Active key not found.", 404)


def _candidate(row: asyncpg.Record) -> Candidate:
    data = record_dict(row)
    metadata = data.pop("metadata", {}) or {}
    models = metadata.get("models", []) if isinstance(metadata, dict) else []
    model = next((item for item in models if isinstance(item, dict) and item.get("id") == data["model_id"]), {})
    capabilities = set(model.get("capabilities") or ["chat"])
    capabilities.add("chat")
    # Hosted adapters in Slice 1.8 have a tested LiteLLM streaming path. Arbitrary custom
    # endpoints remain conservative unless their discovered metadata explicitly says streaming.
    if data["provider_kind"] != "custom_openai":
        capabilities.add("streaming")
    billing_tier = model.get("billing_tier") or data["billing_tier"]
    return Candidate(
        target_id=data["target_id"],
        provider_connection_id=data["provider_connection_id"],
        provider_kind=data["provider_kind"],
        model_id=data["model_id"],
        billing_tier=billing_tier,
        position=data["position"],
        capabilities=tuple(sorted(capabilities)),
        metadata_provenance=str(model.get("metadata_provenance") or "unknown"),
        input_price_per_million_usd=model.get("input_price_per_million_usd"),
        output_price_per_million_usd=model.get("output_price_per_million_usd"),
        connection_status=data["connection_status"],
    )


async def route_candidates(pool: asyncpg.Pool, workspace_id: UUID, route_id: UUID) -> list[Candidate]:
    rows = await pool.fetch(
        """select t.id target_id,t.provider_connection_id,p.provider_kind,t.model_id,
        t.billing_tier,t.position,p.status connection_status,p.metadata
        from public.route_targets t
        join public.provider_connections p on p.id=t.provider_connection_id
        join private.provider_credentials c on c.provider_connection_id=p.id
        where t.route_id=$1 and t.enabled and p.workspace_id=$2 and p.status <> 'invalid'
        order by t.position""",
        route_id, workspace_id,
    )
    return [_candidate(row) for row in rows]


async def resolve_virtual_key(pool: asyncpg.Pool, key_hash: str) -> VirtualKeyContext | None:
    row = await pool.fetchrow(
        """select k.id key_id,k.workspace_id,k.route_id,r.name route_name,r.slug route_slug,
        r.strategy,r.enabled route_enabled,r.paid_fallback,r.daily_paid_cap_microusd
        from public.virtual_api_keys k join public.routes r on r.id=k.route_id
        where k.key_hash=$1 and k.status='active' and r.enabled
          and (k.expires_at is null or k.expires_at>now())""",
        key_hash,
    )
    if not row:
        return None
    context = record_dict(row)
    context["candidates"] = await route_candidates(pool, row["workspace_id"], row["route_id"])
    return VirtualKeyContext(**context)


async def mark_key_used(pool: asyncpg.Pool, key_id: UUID) -> None:
    await pool.execute("update public.virtual_api_keys set last_used_at=now() where id=$1", key_id)
