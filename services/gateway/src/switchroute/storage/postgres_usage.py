from typing import Any
from uuid import UUID

import asyncpg

from switchroute.domain import UsageRecord
from switchroute.errors import SwitchRouteError
from switchroute.storage.postgres_base import record_dict


async def dashboard(pool: asyncpg.Pool, workspace_id: UUID) -> dict[str, Any]:
    row = await pool.fetchrow(
        """select
          (select count(*) from public.provider_connections where workspace_id=$1) providers,
          (select count(*) from public.provider_connections where workspace_id=$1 and status='healthy') healthy_providers,
          (select count(*) from public.routes where workspace_id=$1 and enabled) active_routes,
          (select count(*) from public.request_usage where workspace_id=$1 and created_at > now()-interval '24 hours') requests_24h,
          (select coalesce(sum(estimated_cost_microusd),0) from public.request_usage where workspace_id=$1 and paid_routing and created_at > now()-interval '24 hours') cost_24h_microusd""",
        workspace_id,
    )
    if row is None:
        raise SwitchRouteError("configuration_error", "Dashboard query failed.", 500)
    return record_dict(row)


async def record_usage(pool: asyncpg.Pool, record: UsageRecord) -> None:
    await pool.execute(
        """insert into public.request_usage(
            request_id,workspace_id,route_id,virtual_key_id,provider_connection_id,
            provider_kind,model_id,input_tokens,output_tokens,latency_ms,status,
            fallback_count,estimated_cost_microusd,error_category,ttft_ms,paid_routing,
            routing_decision
        ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)""",
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
        record.ttft_ms,
        record.paid_routing,
        record.routing_decision,
    )


async def paid_spend_today(
    pool: asyncpg.Pool, workspace_id: UUID, route_id: UUID
) -> int:
    value = await pool.fetchval(
        """select coalesce(sum(estimated_cost_microusd),0)
        from public.request_usage
        where workspace_id=$1 and route_id=$2 and status='success'
          and paid_routing
          and estimated_cost_microusd is not null
          and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'""",
        workspace_id,
        route_id,
    )
    return int(value or 0)


async def activity(
    pool: asyncpg.Pool, workspace_id: UUID, limit: int = 50
) -> list[dict[str, Any]]:
    rows = await pool.fetch(
        """select u.request_id,u.route_id,r.name route_name,u.provider_kind,u.model_id,
        u.input_tokens,u.output_tokens,u.latency_ms,u.ttft_ms,u.status,u.fallback_count,
        u.estimated_cost_microusd,u.paid_routing,u.error_category,u.routing_decision,u.created_at
        from public.request_usage u join public.routes r on r.id=u.route_id
        where u.workspace_id=$1 order by u.created_at desc limit $2""",
        workspace_id,
        limit,
    )
    return [record_dict(row) for row in rows]
