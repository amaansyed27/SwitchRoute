import json
from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.errors import ROUTE_NOT_FOUND, SwitchRouteError


class PostgresRepository:
    def __init__(self, database_url: str | None) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._database_url:
            self._pool = await asyncpg.create_pool(self._database_url, min_size=1, max_size=8, command_timeout=10)

    def _require_pool(self) -> asyncpg.Pool:
        if not self._pool:
            raise SwitchRouteError("configuration_error", "Database is not configured.", 503)
        return self._pool

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def default_workspace(self, user_id: UUID) -> dict[str, Any]:
        row = await self._require_pool().fetchrow(
            "select w.* from public.workspaces w join public.workspace_members m on m.workspace_id=w.id where m.user_id=$1 order by w.created_at limit 1",
            user_id,
        )
        if not row:
            raise SwitchRouteError("authentication_error", "No workspace is available for this user.", 403)
        return dict(row)

    async def dashboard(self, workspace_id: UUID) -> dict[str, Any]:
        row = await self._require_pool().fetchrow(
            """select
              (select count(*) from public.provider_connections where workspace_id=$1) providers,
              (select count(*) from public.provider_connections where workspace_id=$1 and status='healthy') healthy_providers,
              (select count(*) from public.routes where workspace_id=$1 and enabled) active_routes,
              (select count(*) from public.request_usage where workspace_id=$1 and created_at > now()-interval '24 hours') requests_24h,
              (select coalesce(sum(estimated_cost_microusd),0) from public.request_usage where workspace_id=$1 and created_at > now()-interval '24 hours') cost_24h_microusd""",
            workspace_id,
        )
        return dict(row)

    async def list_providers(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            "select id,provider_kind,display_name,status,metadata,last_validated_at,created_at from public.provider_connections where workspace_id=$1 order by created_at",
            workspace_id,
        )
        return [dict(row) for row in rows]

    async def create_provider(self, workspace_id: UUID, kind: str, name: str, metadata: dict, encrypted_secret: str, key_id: str) -> dict[str, Any]:
        pool = self._require_pool()
        async with pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "insert into public.provider_connections(workspace_id,provider_kind,display_name,status,metadata,last_validated_at) values($1,$2,$3,'healthy',$4::jsonb,now()) returning *",
                workspace_id, kind, name, json.dumps(metadata),
            )
            await conn.execute(
                "insert into private.provider_credentials(provider_connection_id,encrypted_secret,key_id) values($1,$2,$3)",
                row["id"], encrypted_secret, key_id,
            )
        return dict(row)

    async def provider_secret(self, workspace_id: UUID, provider_id: UUID) -> tuple[str, str, str]:
        row = await self._require_pool().fetchrow(
            """select p.provider_kind,c.encrypted_secret,c.key_id from public.provider_connections p
            join private.provider_credentials c on c.provider_connection_id=p.id
            where p.id=$1 and p.workspace_id=$2""", provider_id, workspace_id,
        )
        if not row:
            raise SwitchRouteError("invalid_request", "Provider connection not found.", 404)
        return row["provider_kind"], row["encrypted_secret"], row["key_id"]

    async def update_provider_health(self, workspace_id: UUID, provider_id: UUID, status: str, metadata: dict) -> None:
        await self._require_pool().execute(
            "update public.provider_connections set status=$3,metadata=$4::jsonb,last_validated_at=now(),updated_at=now() where id=$1 and workspace_id=$2",
            provider_id, workspace_id, status, json.dumps(metadata),
        )

    async def delete_provider(self, workspace_id: UUID, provider_id: UUID) -> None:
        result = await self._require_pool().execute("delete from public.provider_connections where id=$1 and workspace_id=$2", provider_id, workspace_id)
        if result.endswith("0"):
            raise SwitchRouteError("invalid_request", "Provider connection not found or is in use by a Route.", 409)

    async def list_routes(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            """select r.*,coalesce(jsonb_agg(jsonb_build_object('id',t.id,'provider_connection_id',t.provider_connection_id,'model_id',t.model_id,'position',t.position,'billing_tier',t.billing_tier,'enabled',t.enabled) order by t.position) filter(where t.id is not null),'[]') targets
            from public.routes r left join public.route_targets t on t.route_id=r.id where r.workspace_id=$1 group by r.id order by r.created_at""", workspace_id,
        )
        return [dict(row) for row in rows]

    async def _write_route(self, conn: asyncpg.Connection, workspace_id: UUID, route_id: UUID | None, name: str, slug: str, strategy: str, enabled: bool, targets: list[dict]) -> dict[str, Any]:
        if route_id:
            row = await conn.fetchrow("update public.routes set name=$3,slug=$4,strategy=$5,enabled=$6,updated_at=now() where id=$1 and workspace_id=$2 returning *", route_id, workspace_id, name, slug, strategy, enabled)
            if not row:
                raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
            await conn.execute("delete from public.route_targets where route_id=$1", route_id)
        else:
            row = await conn.fetchrow("insert into public.routes(workspace_id,name,slug,strategy,enabled) values($1,$2,$3,$4,$5) returning *", workspace_id, name, slug, strategy, enabled)
            route_id = row["id"]
        for index, target in enumerate(targets):
            await conn.execute("insert into public.route_targets(route_id,provider_connection_id,model_id,position,billing_tier,enabled) select $1,$2,$3,$4,$5,$6 where exists(select 1 from public.provider_connections where id=$2 and workspace_id=$7)", route_id, UUID(str(target["provider_connection_id"])), target["model_id"], index, target.get("billing_tier","unknown"), target.get("enabled",True), workspace_id)
        return dict(row)

    async def create_route(self, workspace_id: UUID, name: str, slug: str, strategy: str, enabled: bool, targets: list[dict]) -> dict[str, Any]:
        async with self._require_pool().acquire() as conn, conn.transaction():
            return await self._write_route(conn, workspace_id, None, name, slug, strategy, enabled, targets)

    async def update_route(self, workspace_id: UUID, route_id: UUID, name: str, slug: str, strategy: str, enabled: bool, targets: list[dict]) -> dict[str, Any]:
        async with self._require_pool().acquire() as conn, conn.transaction():
            return await self._write_route(conn, workspace_id, route_id, name, slug, strategy, enabled, targets)

    async def delete_route(self, workspace_id: UUID, route_id: UUID) -> None:
        try:
            await self._require_pool().execute("delete from public.routes where id=$1 and workspace_id=$2", route_id, workspace_id)
        except asyncpg.ForeignKeyViolationError as exc:
            raise SwitchRouteError("invalid_request", "Revoke Route API keys before deleting this Route.", 409) from exc

    async def list_keys(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch("select k.id,k.name,k.prefix,k.environment,k.status,k.last_used_at,k.expires_at,k.created_at,k.route_id,r.name route_name from public.virtual_api_keys k join public.routes r on r.id=k.route_id where k.workspace_id=$1 order by k.created_at desc", workspace_id)
        return [dict(row) for row in rows]

    async def create_key(self, workspace_id: UUID, route_id: UUID, environment: str, name: str, prefix: str, key_hash: str, expires_at: str | None) -> dict[str, Any]:
        row = await self._require_pool().fetchrow("insert into public.virtual_api_keys(workspace_id,route_id,environment,name,prefix,key_hash,expires_at) select $1,id,$3,$4,$5,$6,$7::timestamptz from public.routes where id=$2 and workspace_id=$1 returning id,name,prefix,environment,status,route_id,created_at,expires_at", workspace_id, route_id, environment, name, prefix, key_hash, expires_at)
        if not row:
            raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
        return dict(row)

    async def revoke_key(self, workspace_id: UUID, key_id: UUID) -> None:
        await self._require_pool().execute("update public.virtual_api_keys set status='revoked',revoked_at=now() where id=$1 and workspace_id=$2", key_id, workspace_id)

    async def resolve_virtual_key(self, key_hash: str) -> VirtualKeyContext | None:
        pool = self._require_pool()
        key = await pool.fetchrow("""select k.id key_id,k.workspace_id,k.route_id,r.name route_name,r.slug route_slug,r.strategy,r.enabled route_enabled
          from public.virtual_api_keys k join public.routes r on r.id=k.route_id
          where k.key_hash=$1 and k.status='active' and (k.expires_at is null or k.expires_at>now())""", key_hash)
        if not key:
            return None
        rows = await pool.fetch("""select t.id target_id,t.provider_connection_id,p.provider_kind,t.model_id,t.billing_tier,t.position
          from public.route_targets t join public.provider_connections p on p.id=t.provider_connection_id
          where t.route_id=$1 and t.enabled and p.status in ('healthy','unknown') order by t.position""", key["route_id"])
        candidates = [Candidate(**dict(row)) for row in rows]
        return VirtualKeyContext(candidates=candidates, **dict(key))

    async def mark_key_used(self, key_id: UUID) -> None:
        await self._require_pool().execute("update public.virtual_api_keys set last_used_at=now() where id=$1", key_id)

    async def record_usage(self, record: UsageRecord) -> None:
        await self._require_pool().execute("""insert into public.request_usage(request_id,workspace_id,route_id,virtual_key_id,provider_connection_id,provider_kind,model_id,input_tokens,output_tokens,latency_ms,status,fallback_count,estimated_cost_microusd,error_category)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)""", record.request_id,record.workspace_id,record.route_id,record.virtual_key_id,record.provider_connection_id,record.provider_kind,record.model_id,record.input_tokens,record.output_tokens,record.latency_ms,record.status,record.fallback_count,record.estimated_cost_microusd,record.error_category)

    async def activity(self, workspace_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch("""select u.request_id,u.created_at,r.name route_name,u.provider_kind,u.model_id,u.input_tokens,u.output_tokens,u.latency_ms,u.status,u.fallback_count,u.error_category
          from public.request_usage u join public.routes r on r.id=u.route_id where u.workspace_id=$1 order by u.created_at desc limit $2""", workspace_id, min(max(limit,1),100))
        return [dict(row) for row in rows]
