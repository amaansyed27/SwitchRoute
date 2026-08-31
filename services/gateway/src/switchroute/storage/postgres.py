import json
from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import Candidate, UsageRecord, VirtualKeyContext
from switchroute.errors import ROUTE_NOT_FOUND, SwitchRouteError


async def _init_connection(connection: asyncpg.Connection) -> None:
    for type_name in ("json", "jsonb"):
        await connection.set_type_codec(
            type_name,
            schema="pg_catalog",
            encoder=json.dumps,
            decoder=json.loads,
            format="text",
        )


def _record_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {str(key): row[key] for key in row.keys()}  # noqa: SIM118


def _target_provider_ids(targets: list[dict]) -> list[UUID]:
    return [UUID(str(target["provider_connection_id"])) for target in targets]


class PostgresRepository:
    def __init__(self, database_url: str | None) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._database_url:
            self._pool = await asyncpg.create_pool(
                self._database_url,
                min_size=1,
                max_size=8,
                command_timeout=10,
                init=_init_connection,
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

    async def provider_secret(
        self, workspace_id: UUID, provider_id: UUID
    ) -> tuple[str, str, str]:
        row = await self._require_pool().fetchrow(
            """select p.provider_kind,c.encrypted_secret,c.key_id
            from public.provider_connections p
            join private.provider_credentials c on c.provider_connection_id=p.id
            where p.id=$1 and p.workspace_id=$2""",
            provider_id,
            workspace_id,
        )
        if not row:
            raise SwitchRouteError("provider_not_found", "Provider not found.", 404)
        return row["provider_kind"], row["encrypted_secret"], row["key_id"]

    async def update_provider_health(
        self,
        workspace_id: UUID,
        provider_id: UUID,
        status: str,
        metadata: dict,
    ) -> None:
        result = await self._require_pool().execute(
            """update public.provider_connections
            set status=$3,metadata=$4::jsonb,last_validated_at=now(),updated_at=now()
            where id=$1 and workspace_id=$2""",
            provider_id,
            workspace_id,
            status,
            json.dumps(metadata),
        )
        if result == "UPDATE 0":
            raise SwitchRouteError("provider_not_found", "Provider not found.", 404)

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

    async def _validate_target_ownership(
        self,
        conn: asyncpg.Connection,
        workspace_id: UUID,
        targets: list[dict],
    ) -> list[UUID]:
        provider_ids = _target_provider_ids(targets)
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
        return provider_ids

    async def _replace_targets(
        self,
        conn: asyncpg.Connection,
        route_id: UUID,
        targets: list[dict],
        provider_ids: list[UUID],
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

    async def create_route(
        self,
        workspace_id: UUID,
        name: str,
        slug: str,
        strategy: str,
        enabled: bool,
        targets: list[dict],
    ) -> dict[str, Any]:
        pool = self._require_pool()
        async with pool.acquire() as conn, conn.transaction():
            provider_ids = await self._validate_target_ownership(conn, workspace_id, targets)
            row = await conn.fetchrow(
                "insert into public.routes(workspace_id,name,slug,strategy,enabled) values($1,$2,$3,$4,$5) returning *",
                workspace_id,
                name,
                slug,
                strategy,
                enabled,
            )
            if row is None:
                raise SwitchRouteError("invalid_route", "Route creation failed.", 500)
            await self._replace_targets(conn, row["id"], targets, provider_ids)
            return _record_dict(row)

    async def update_route(
        self,
        workspace_id: UUID,
        route_id: UUID,
        name: str,
        slug: str,
        strategy: str,
        enabled: bool,
        targets: list[dict],
    ) -> dict[str, Any]:
        pool = self._require_pool()
        async with pool.acquire() as conn, conn.transaction():
            provider_ids = await self._validate_target_ownership(conn, workspace_id, targets)
            row = await conn.fetchrow(
                """update public.routes set name=$3,slug=$4,strategy=$5,enabled=$6,updated_at=now()
                where id=$1 and workspace_id=$2 returning *""",
                route_id,
                workspace_id,
                name,
                slug,
                strategy,
                enabled,
            )
            if row is None:
                raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
            await self._replace_targets(conn, route_id, targets, provider_ids)
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

    async def create_key(
        self,
        workspace_id: UUID,
        route_id: UUID,
        environment: str,
        name: str,
        prefix: str,
        key_hash: str,
        expires_at: str | None,
    ) -> dict[str, Any]:
        row = await self._require_pool().fetchrow(
            """with inserted as (
              insert into public.virtual_api_keys(workspace_id,route_id,environment,name,prefix,key_hash,expires_at)
              select $1,$2,$3,$4,$5,$6,case when $7::text is null then null else $7::text::timestamptz end
              where exists(select 1 from public.routes where id=$2 and workspace_id=$1)
              returning id,workspace_id,route_id,environment,name,prefix,status,last_used_at,expires_at,created_at
            )
            select inserted.*,r.name route_name from inserted join public.routes r on r.id=inserted.route_id""",
            workspace_id,
            route_id,
            environment,
            name,
            prefix,
            key_hash,
            expires_at,
        )
        if not row:
            raise SwitchRouteError(ROUTE_NOT_FOUND, "Route not found.", 404)
        return _record_dict(row)

    async def list_keys(self, workspace_id: UUID) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            """select k.id,k.route_id,k.environment,k.name,k.prefix,k.status,k.last_used_at,
            k.expires_at,k.created_at,k.revoked_at,r.name route_name
            from public.virtual_api_keys k join public.routes r on r.id=k.route_id
            where k.workspace_id=$1 order by k.created_at desc""",
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
            """select k.id key_id,k.workspace_id,k.route_id,r.name route_name,r.slug route_slug,
            r.strategy,r.enabled route_enabled
            from public.virtual_api_keys k join public.routes r on r.id=k.route_id
            where k.key_hash=$1 and k.status='active' and r.enabled
              and (k.expires_at is null or k.expires_at>now())""",
            key_hash,
        )
        if not row:
            return None
        context = _record_dict(row)
        context["candidates"] = await self.route_candidates(
            row["workspace_id"], row["route_id"]
        )
        return VirtualKeyContext(**context)

    async def route_candidates(self, workspace_id: UUID, route_id: UUID) -> list[Candidate]:
        rows = await self._require_pool().fetch(
            """select t.id target_id,t.provider_connection_id,p.provider_kind,t.model_id,
            t.billing_tier,t.position
            from public.route_targets t
            join public.provider_connections p on p.id=t.provider_connection_id
            join private.provider_credentials c on c.provider_connection_id=p.id
            where t.route_id=$1 and t.enabled and p.workspace_id=$2 and p.status='healthy'
            order by t.position""",
            route_id,
            workspace_id,
        )
        return [Candidate(**_record_dict(row)) for row in rows]

    async def mark_key_used(self, key_id: UUID) -> None:
        await self._require_pool().execute(
            "update public.virtual_api_keys set last_used_at=now() where id=$1",
            key_id,
        )

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

    async def activity(self, workspace_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
        rows = await self._require_pool().fetch(
            """select u.request_id,u.route_id,r.name route_name,u.provider_kind,u.model_id,
            u.input_tokens,u.output_tokens,u.latency_ms,u.status,u.fallback_count,
            u.estimated_cost_microusd,u.error_category,u.created_at
            from public.request_usage u join public.routes r on r.id=u.route_id
            where u.workspace_id=$1 order by u.created_at desc limit $2""",
            workspace_id,
            limit,
        )
        return [_record_dict(row) for row in rows]
