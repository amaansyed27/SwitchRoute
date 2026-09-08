from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import UsageRecord, VirtualKeyContext
from switchroute.errors import SwitchRouteError
from switchroute.storage import postgres_keys as keys_store
from switchroute.storage import postgres_providers as provider_store
from switchroute.storage import postgres_routes as route_store
from switchroute.storage import postgres_usage as usage_store
from switchroute.storage.postgres_base import default_workspace, init_connection


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
                init=init_connection,
            )

    def _require_pool(self) -> asyncpg.Pool:
        if not self._pool:
            raise SwitchRouteError("configuration_error", "Database is not configured.", 503)
        return self._pool

    async def close(self) -> None:
        if self._pool:
            await self._pool.close()

    async def default_workspace(self, user_id: UUID) -> dict[str, Any]:
        return await default_workspace(self._require_pool(), user_id)

    async def dashboard(self, workspace_id: UUID) -> dict[str, Any]:
        return await usage_store.dashboard(self._require_pool(), workspace_id)

    async def list_providers(self, workspace_id: UUID) -> list[dict[str, Any]]:
        return await provider_store.list_providers(self._require_pool(), workspace_id)

    async def create_provider(
        self, workspace_id: UUID, kind: str, name: str, metadata: dict, encrypted_secret: str, key_id: str
    ) -> dict[str, Any]:
        return await provider_store.create_provider(
            self._require_pool(), workspace_id, kind, name, metadata, encrypted_secret, key_id
        )

    async def provider_secret(
        self, workspace_id: UUID, provider_id: UUID
    ) -> tuple[str, str, str, dict[str, Any]]:
        return await provider_store.provider_secret(self._require_pool(), workspace_id, provider_id)

    async def update_provider_health(
        self, workspace_id: UUID, provider_id: UUID, status: str, metadata: dict
    ) -> None:
        await provider_store.update_provider_health(
            self._require_pool(), workspace_id, provider_id, status, metadata
        )

    async def mark_provider_attention(self, workspace_id: UUID, provider_id: UUID) -> None:
        await self._require_pool().execute(
            """update public.provider_connections
            set status='invalid',updated_at=now()
            where id=$1 and workspace_id=$2""",
            provider_id,
            workspace_id,
        )

    async def delete_provider(self, workspace_id: UUID, provider_id: UUID) -> None:
        await provider_store.delete_provider(self._require_pool(), workspace_id, provider_id)

    async def list_routes(self, workspace_id: UUID) -> list[dict[str, Any]]:
        return await route_store.list_routes(self._require_pool(), workspace_id)

    async def create_route(
        self,
        workspace_id: UUID,
        name: str,
        slug: str,
        strategy: str,
        enabled: bool,
        targets: list[dict],
        paid_fallback: str,
        daily_paid_cap_microusd: int | None,
    ) -> dict[str, Any]:
        return await route_store.create_route(
            self._require_pool(), workspace_id, name, slug, strategy, enabled, targets,
            paid_fallback, daily_paid_cap_microusd,
        )

    async def update_route(
        self,
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
        return await route_store.update_route(
            self._require_pool(), workspace_id, route_id, name, slug, strategy, enabled, targets,
            paid_fallback, daily_paid_cap_microusd,
        )

    async def delete_route(self, workspace_id: UUID, route_id: UUID) -> None:
        await route_store.delete_route(self._require_pool(), workspace_id, route_id)

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
        return await keys_store.create_key(
            self._require_pool(), workspace_id, route_id, environment, name, prefix, key_hash, expires_at
        )

    async def list_keys(self, workspace_id: UUID) -> list[dict[str, Any]]:
        return await keys_store.list_keys(self._require_pool(), workspace_id)

    async def revoke_key(self, workspace_id: UUID, key_id: UUID) -> None:
        await keys_store.revoke_key(self._require_pool(), workspace_id, key_id)

    async def resolve_virtual_key(self, key_hash: str) -> VirtualKeyContext | None:
        return await keys_store.resolve_virtual_key(self._require_pool(), key_hash)

    async def mark_key_used(self, key_id: UUID) -> None:
        await keys_store.mark_key_used(self._require_pool(), key_id)

    async def record_usage(self, record: UsageRecord) -> None:
        await usage_store.record_usage(self._require_pool(), record)

    async def paid_spend_today(self, workspace_id: UUID, route_id: UUID) -> int:
        return await usage_store.paid_spend_today(self._require_pool(), workspace_id, route_id)

    async def activity(self, workspace_id: UUID, limit: int = 50) -> list[dict[str, Any]]:
        return await usage_store.activity(self._require_pool(), workspace_id, limit)
