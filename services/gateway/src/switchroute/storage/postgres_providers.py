from typing import Any
from uuid import UUID

import asyncpg

from switchroute.errors import SwitchRouteError
from switchroute.storage.postgres_base import record_dict


async def list_providers(pool: asyncpg.Pool, workspace_id: UUID) -> list[dict[str, Any]]:
    rows = await pool.fetch(
        "select id,provider_kind,display_name,status,metadata,last_validated_at,created_at from public.provider_connections where workspace_id=$1 order by created_at",
        workspace_id,
    )
    return [record_dict(row) for row in rows]


async def create_provider(
    pool: asyncpg.Pool,
    workspace_id: UUID,
    kind: str,
    name: str,
    metadata: dict,
    encrypted_secret: str,
    key_id: str,
) -> dict[str, Any]:
    async with pool.acquire() as conn, conn.transaction():
        row = await conn.fetchrow(
            "insert into public.provider_connections(workspace_id,provider_kind,display_name,status,metadata,last_validated_at) values($1,$2,$3,'healthy',$4::jsonb,now()) returning *",
            workspace_id,
            kind,
            name,
            metadata,
        )
        if row is None:
            raise SwitchRouteError("configuration_error", "Provider creation failed.", 500)
        await conn.execute(
            "insert into private.provider_credentials(provider_connection_id,encrypted_secret,key_id) values($1,$2,$3)",
            row["id"],
            encrypted_secret,
            key_id,
        )
        return record_dict(row)


async def provider_secret(
    pool: asyncpg.Pool, workspace_id: UUID, provider_id: UUID
) -> tuple[str, str, str, dict[str, Any]]:
    row = await pool.fetchrow(
        """select p.provider_kind,p.metadata,c.encrypted_secret,c.key_id
        from public.provider_connections p
        join private.provider_credentials c on c.provider_connection_id=p.id
        where p.id=$1 and p.workspace_id=$2""",
        provider_id,
        workspace_id,
    )
    if not row:
        raise SwitchRouteError("provider_not_found", "Provider not found.", 404)
    metadata = row["metadata"] if isinstance(row["metadata"], dict) else {}
    return row["provider_kind"], row["encrypted_secret"], row["key_id"], metadata


async def update_provider_health(
    pool: asyncpg.Pool,
    workspace_id: UUID,
    provider_id: UUID,
    status: str,
    metadata: dict,
) -> None:
    result = await pool.execute(
        """update public.provider_connections
        set status=$3,metadata=$4::jsonb,last_validated_at=now(),updated_at=now()
        where id=$1 and workspace_id=$2""",
        provider_id,
        workspace_id,
        status,
        metadata,
    )
    if result == "UPDATE 0":
        raise SwitchRouteError("provider_not_found", "Provider not found.", 404)


async def delete_provider(pool: asyncpg.Pool, workspace_id: UUID, provider_id: UUID) -> None:
    try:
        result = await pool.execute(
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
