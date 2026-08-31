import json
from typing import Any
from uuid import UUID

import asyncpg

from switchroute.errors import SwitchRouteError


async def init_connection(connection: asyncpg.Connection) -> None:
    for type_name in ("json", "jsonb"):
        await connection.set_type_codec(
            type_name,
            schema="pg_catalog",
            encoder=json.dumps,
            decoder=json.loads,
            format="text",
        )


def record_dict(row: asyncpg.Record) -> dict[str, Any]:
    return {str(key): row[key] for key in row.keys()}  # noqa: SIM118


async def default_workspace(pool: asyncpg.Pool, user_id: UUID) -> dict[str, Any]:
    row = await pool.fetchrow(
        "select w.* from public.workspaces w join public.workspace_members m on m.workspace_id=w.id where m.user_id=$1 order by w.created_at limit 1",
        user_id,
    )
    if not row:
        raise SwitchRouteError(
            "authentication_error", "No workspace is available for this user.", 403
        )
    return record_dict(row)
