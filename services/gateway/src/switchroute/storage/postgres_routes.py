from typing import Any
from uuid import UUID

import asyncpg

from switchroute.errors import ROUTE_NOT_FOUND, SwitchRouteError
from switchroute.storage.postgres_base import record_dict


def _target_provider_ids(targets: list[dict]) -> list[UUID]:
    return [UUID(str(target["provider_connection_id"])) for target in targets]


async def _validate_target_ownership(
    conn: asyncpg.Connection, workspace_id: UUID, targets: list[dict]
) -> list[UUID]:
    provider_ids = _target_provider_ids(targets)
    owned = await conn.fetch(
        "select id from public.provider_connections where workspace_id=$1 and id=any($2::uuid[])",
        workspace_id,
        provider_ids,
    )
    if len(owned) != len(set(provider_ids)):
        raise SwitchRouteError(
            "invalid_route", "Every Route target must use a provider from this workspace.", 400
        )
    return provider_ids


async def _replace_targets(
    conn: asyncpg.Connection, route_id: UUID, targets: list[dict], provider_ids: list[UUID]
) -> None:
    await conn.execute("delete from public.route_targets where route_id=$1", route_id)
    for position, (target, provider_id) in enumerate(zip(targets, provider_ids, strict=True)):
        await conn.execute(
            "insert into public.route_targets(route_id,provider_connection_id,model_id,position,billing_tier,enabled) values($1,$2,$3,$4,$5,$6)",
            route_id,
            provider_id,
            target["model_id"],
            position,
            target.get("billing_tier", "unknown"),
            target.get("enabled", True),
        )


async def list_routes(pool: asyncpg.Pool, workspace_id: UUID) -> list[dict[str, Any]]:
    routes = await pool.fetch(
        "select * from public.routes where workspace_id=$1 order by created_at", workspace_id
    )
    result: list[dict[str, Any]] = []
    for route in routes:
        targets = await pool.fetch(
            """select t.*,p.provider_kind,p.display_name provider_name
            from public.route_targets t join public.provider_connections p on p.id=t.provider_connection_id
            where t.route_id=$1 order by t.position""",
            route["id"],
        )
        item = record_dict(route)
        item["targets"] = [record_dict(target) for target in targets]
        result.append(item)
    return result


async def create_route(
    pool: asyncpg.Pool,
    workspace_id: UUID,
    name: str,
    slug: str,
    strategy: str,
    enabled: bool,
    targets: list[dict],
    paid_fallback: str,
    daily_paid_cap_microusd: int | None,
) -> dict[str, Any]:
    async with pool.acquire() as conn, conn.transaction():
        provider_ids = await _validate_target_ownership(conn, workspace_id, targets)
        row = await conn.fetchrow(
            """insert into public.routes(
            workspace_id,name,slug,strategy,enabled,paid_fallback,daily_paid_cap_microusd
            ) values($1,$2,$3,$4,$5,$6,$7) returning *""",
            workspace_id, name, slug, strategy, enabled, paid_fallback, daily_paid_cap_microusd,
        )
        if row is None:
            raise SwitchRouteError("invalid_route", "Route creation failed.", 500)
        await _replace_targets(conn, row["id"], targets, provider_ids)
        return record_dict(row)


async def update_route(
    pool: asyncpg.Pool,
    workspace_id: UUID,
    route_id: UUID,
    name: str,
    slug: str,
    strategy: str,
    enabled: bool,
    targets: list[dict],
    paid_fallback: str,
    daily_paid_cap_microusd: int | None,
) -> dict[str, Any]:
    async with pool.acquire() as conn, conn.transaction():
        provider_ids = await _validate_target_ownership(conn, workspace_id, targets)
        row = await conn.fetchrow(
            """update public.routes set name=$3,slug=$4,strategy=$5,enabled=$6,
            paid_fallback=$7,daily_paid_cap_microusd=$8,updated_at=now()
            where id=$1 and workspace_id=$2 returning *""",
            route_id, workspace_id, name, slug, strategy, enabled, paid_fallback, daily_paid_cap_microusd,
        )
        if row is None:
            raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
        await _replace_targets(conn, route_id, targets, provider_ids)
        return record_dict(row)


async def delete_route(pool: asyncpg.Pool, workspace_id: UUID, route_id: UUID) -> None:
    try:
        result = await pool.execute(
            "delete from public.routes where id=$1 and workspace_id=$2", route_id, workspace_id
        )
    except asyncpg.ForeignKeyViolationError as exc:
        raise SwitchRouteError(
            "route_in_use", "Revoke and remove this Route's API keys before deleting it.", 409
        ) from exc
    if result == "DELETE 0":
        raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
