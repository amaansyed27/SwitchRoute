begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_column('public', 'routes', 'paid_fallback', 'routes has paid fallback policy');
select has_column('public', 'routes', 'daily_paid_cap_microusd', 'routes has daily paid cap');
select has_column('public', 'request_usage', 'ttft_ms', 'usage stores TTFT separately');
select has_column('public', 'request_usage', 'routing_decision', 'usage stores sanitized routing decisions');
select has_column('public', 'request_usage', 'paid_routing', 'usage distinguishes paid routing');
select col_is_null('public', 'routes', 'daily_paid_cap_microusd', 'daily paid cap is optional');

set local session_replication_role = replica;
insert into public.workspaces(id,name,slug,created_by)
values ('40000000-0000-0000-0000-000000000040','Routing test','routing-test','dddddddd-dddd-dddd-dddd-dddddddddddd');
set local session_replication_role = origin;

select lives_ok(
  $$insert into public.routes(workspace_id,name,slug,strategy,paid_fallback,daily_paid_cap_microusd)
    values ('40000000-0000-0000-0000-000000000040','Balanced','balanced','balanced','after_free',2000000)$$,
  'smart routing strategy and paid policy are accepted'
);

select throws_ok(
  $$insert into public.routes(workspace_id,name,slug,strategy)
    values ('40000000-0000-0000-0000-000000000040','Bad strategy','bad-strategy','magic')$$,
  '23514', null, 'unknown routing strategy is rejected'
);

select throws_ok(
  $$insert into public.routes(workspace_id,name,slug,strategy,daily_paid_cap_microusd)
    values ('40000000-0000-0000-0000-000000000040','Bad cap','bad-cap','priority',-1)$$,
  '23514', null, 'negative paid cap is rejected'
);

select * from finish();
rollback;
