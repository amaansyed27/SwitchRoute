import json
from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.errors import ROUTE_NOT_FOUND, SwitchRouteError


def _record_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {str(key): row[key] for key in row.keys()}  # noqa: SIM118


class PostgresRepository:
    def __init__(self, database_url: str | None) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._database_url:
            self._pool = await asyncpg.create_pool(
                self._database_url, min_size=1, max_size=8, command_timeout=10
            )

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
            raise SwitchRouteError(
                "authentication_error", "No workspace is available for this user.", 403
            )
        return _record_dict(row)

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
        if row is None:
            raise SwitchRouteError("configuration_error", "Dashboard query failed.", 500)
        return _record_dict(row)

    async def list_providers(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            "select id,provider_kind,display_name,status,metadata,last_validated_at,created_at from public.provider_connections where workspace_id=$1 order by created_at",
            workspace_id,
        )
        return [_record_dict(row) for row in rows]

    async def create_provider(
        self,
        workspace_id: UUID,
        kind: str,
        name: str,
        metadata: dict,
        encrypted_secret: str,
        key_id: str,
    ) -> dict[str, Any]:
        pool = self._require_pool()
        async with pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                "insert into public.provider_connections(workspace_id,provider_kind,display_name,status,metadata,last_validated_at) values($1,$2,$3,'healthy',$4::jsonb,now()) returning *",
                workspace_id,
                kind,
                name,
                json.dumps(metadata),
            )
            if row is None:
                raise SwitchRouteError(
                    "configuration_error", "Provider creation failed.", 500
                )
            await conn.execute(
                "insert into private.provider_credentials(provider_connection_id,encrypted_secret,key_id) values($1,$2,$3)",
                row["id"],
                encrypted_secret,
                key_id,
            )
            return _record_dict(row)

    async def get_provider(self, workspace_id: UUID, provider_id: UUID) -> dict[str, Any] | None:
        row = await self._require_pool().fetchrow(
            "select * from public.provider_connections where id=$1 and workspace_id=$2",
            provider_id,
            workspace_id,
        )
        return _record_dict(row) if row else None

    async def update_provider_metadata(
        self, workspace_id: UUID, provider_id: UUID, metadata: dict
    ) -> None:
        await self._require_pool().execute(
            "update public.provider_connections set metadata=$3::jsonb,last_validated_at=now(),updated_at=now() where id=$1 and workspace_id=$2",
            provider_id,
            workspace_id,
            json.dumps(metadata),
        )

    async def provider_secret(self, workspace_id: UUID, provider_id: UUID) -> str | None:
        row = await self._require_pool().fetchrow(
            "select c.encrypted_secret from private.provider_credentials c join public.provider_connections p on p.id=c.provider_connection_id where p.id=$1 and p.workspace_id=$2",
            provider_id,
            workspace_id,
        )
        return row["encrypted_secret"] if row else None

    async def delete_provider(self, workspace_id: UUID, provider_id: UUID) -> None:
        try:
            result = await self._require_pool().execute(
                "delete from public.provider_connections where id=$1 and workspace_id=$2",
                provider_id,
                workspace_id,
            )
        except asyncpg.ForeignKeyViolationError as exc:
            raise SwitchRouteError(
                "provider_in_use",
                "Remove this provider from all Routes before disconnecting it.",
                409,
            ) from exc
        if result == "DELETE 0":
            raise SwitchRouteError("provider_not_found", "Provider not found.", 404)

    async def list_routes(self, workspace_id: UUID) -> list[dict[str, Any]]:
        routes = await self._require_pool().fetch(
            "select * from public.routes where workspace_id=$1 order by created_at",
            workspace_id,
        )
        result: list[dict[str, Any]] = []
        for route in routes:
            targets = await self._require_pool().fetch(
                """select t.*,p.provider_kind,p.display_name provider_name
                from public.route_targets t join public.provider_connections p on p.id=t.provider_connection_id
                where t.route_id=$1 order by t.position""",
                route["id"],
            )
            item = _record_dict(route)
            item["targets"] = [_record_dict(target) for target in targets]
            result.append(item)
        return result

    async def create_route(
        self,
        workspace_id: UUID,
        name: str,
        slug: str,
        strategy: str,
        targets: list[dict],
    ) -> dict[str, Any]:
        pool = self._require_pool()
        async with pool.acquire() as conn, conn.transaction():
            provider_ids = [target["provider_connection_id"] for target in targets]
            if provider_ids:
                owned = await conn.fetch(
                    "select id from public.provider_connections where workspace_id=$1 and id=any($2::uuid[])",
                    workspace_id,
                    provider_ids,
                )
                if len(owned) != len(set(provider_ids)):
                    raise SwitchRouteError(
                        "invalid_route",
                        "Every Route target must use a provider from this workspace.",
                        400,
                    )
            row = await conn.fetchrow(
                "insert into public.routes(workspace_id,name,slug,strategy) values($1,$2,$3,$4) returning *",
                workspace_id,
                name,
                slug,
                strategy,
            )
            if row is None:
                raise SwitchRouteError("invalid_route", "Route creation failed.", 500)
            for position, target in enumerate(targets):
                await conn.execute(
                    "insert into public.route_targets(route_id,provider_connection_id,model_id,position,billing_tier,enabled) values($1,$2,$3,$4,$5,$6)",
                    row["id"],
                    target["provider_connection_id"],
                    target["model_id"],
                    position,
                    target.get("billing_tier", "unknown"),
                    target.get("enabled", True),
                )
            return _record_dict(row)

    async def delete_route(self, workspace_id: UUID, route_id: UUID) -> None:
        try:
            result = await self._require_pool().execute(
                "delete from public.routes where id=$1 and workspace_id=$2",
                route_id,
                workspace_id,
            )
        except asyncpg.ForeignKeyViolationError as exc:
            raise SwitchRouteError(
                "route_in_use",
                "Revoke and remove this Route's API keys before deleting it.",
                409,
            ) from exc
        if result == "DELETE 0":
            raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)

    async def create_virtual_key(
        self,
        workspace_id: UUID,
        route_id: UUID,
        environment: str,
        name: str,
        prefix: str,
        key_hash: str,
    ) -> dict[str, Any]:
        row = await self._require_pool().fetchrow(
            "insert into public.virtual_api_keys(workspace_id,route_id,environment,name,prefix,key_hash) select $1,$2,$3,$4,$5,$6 where exists(select 1 from public.routes where id=$2 and workspace_id=$1) returning id,workspace_id,route_id,environment,name,prefix,status,created_at",
            workspace_id,
            route_id,
            environment,
            name,
            prefix,
            key_hash,
        )
        if not row:
            raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
        return _record_dict(row)

    async def list_keys(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            "select id,route_id,environment,name,prefix,status,last_used_at,expires_at,created_at,revoked_at from public.virtual_api_keys where workspace_id=$1 order by created_at desc",
            workspace_id,
        )
        return [_record_dict(row) for row in rows]

    async def revoke_key(self, workspace_id: UUID, key_id: UUID) -> None:
        result = await self._require_pool().execute(
            "update public.virtual_api_keys set status='revoked',revoked_at=now() where id=$1 and workspace_id=$2 and status='active'",
            key_id,
            workspace_id,
        )
        if result == "UPDATE 0":
            raise SwitchRouteError("key_not_found", "Active key not found.", 404)

    async def resolve_virtual_key(self, key_hash: str) -> VirtualKeyContext | None:
        row = await self._require_pool().fetchrow(
            "select k.id virtual_key_id,k.workspace_id,k.route_id,r.slug route_slug,r.strategy from public.virtual_api_keys k join public.routes r on r.id=k.route_id where k.key_hash=$1 and k.status='active' and r.enabled and (k.expires_at is null or k.expires_at>now())",
            key_hash,
        )
        if not row:
            return None
        return VirtualKeyContext(**dict(row))

    async def route_candidates(self, context: VirtualKeyContext) -> list[Candidate]:
        rows = await self._require_pool().fetch(
            """select t.provider_connection_id,t.model_id,t.billing_tier,p.provider_kind,c.encrypted_secret
            from public.route_targets t
            join public.provider_connections p on p.id=t.provider_connection_id
            join private.provider_credentials c on c.provider_connection_id=p.id
            where t.route_id=$1 and t.enabled and p.workspace_id=$2 and p.status='healthy'
            order by t.position""",
            context.route_id,
            context.workspace_id,
        )
        return [Candidate(**dict(row)) for row in rows]

    async def record_usage(self, record: UsageRecord) -> None:
        await self._require_pool().execute(
            """insert into public.request_usage(
                request_id,workspace_id,route_id,virtual_key_id,provider_connection_id,
                provider_kind,model_id,input_tokens,output_tokens,latency_ms,status,
                fallback_count,estimated_cost_microusd,error_category
            ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)""",
            record.request_id,
            record.workspace_id,
            record.route_id,
            record.virtual_key_id,
            record.provider_connection_id,
            record.provider_kind,
            record.model_id,
            record.input_tokens,
            record.output_tokens,
            record.latency_ms,
            record.status,
            record.fallback_count,
            record.estimated_cost_microusd,
            record.error_category,
        )
        await self._require_pool().execute(
            "update public.virtual_api_keys set last_used_at=now() where id=$1",
            record.virtual_key_id,
        )

    async def activity(self, workspace_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            """select request_id,route_id,provider_kind,model_id,input_tokens,output_tokens,
            latency_ms,status,fallback_count,estimated_cost_microusd,error_category,created_at
            from public.request_usage where workspace_id=$1 order by created_at desc limit $2""",
            workspace_id,
            limit,
        )
        return [_record_dict(row) for row in rows]
