-- Slice 2: smart routing policy and bounded sanitized routing metadata.
alter table public.routes drop constraint if exists routes_strategy_check;
alter table public.routes
  add constraint routes_strategy_check
  check (strategy in ('priority','free_first','quota_aware','fastest','cheapest','balanced'));

alter table public.routes
  add column paid_fallback text not null default 'after_free'
    check (paid_fallback in ('never','after_free','allowed')),
  add column daily_paid_cap_microusd bigint
    check (daily_paid_cap_microusd is null or daily_paid_cap_microusd >= 0);

alter table public.request_usage
  add column ttft_ms integer check (ttft_ms is null or ttft_ms >= 0),
  add column routing_decision jsonb not null default '{}'::jsonb
    check (jsonb_typeof(routing_decision) = 'object')
    check (pg_column_size(routing_decision) <= 16384);

comment on column public.routes.paid_fallback is
  'Server-enforced paid routing policy: never, after_free, or allowed.';
comment on column public.routes.daily_paid_cap_microusd is
  'Optional UTC-day cap for routed paid usage, measured in micro-USD.';
comment on column public.request_usage.routing_decision is
  'Bounded sanitized routing metadata only. Never request or response content.';
