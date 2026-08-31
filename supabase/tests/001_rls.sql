begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok((select relrowsecurity from pg_class where oid='public.workspaces'::regclass), 'workspaces RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.provider_connections'::regclass), 'providers RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.routes'::regclass), 'routes RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.request_usage'::regclass), 'usage RLS enabled');
select hasnt_table('public', 'provider_credentials', 'credential table is not exposed in public schema');

set local session_replication_role = replica;
insert into public.workspaces(id,name,slug,created_by) values
 ('10000000-0000-0000-0000-000000000001','A','workspace-a','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
 ('20000000-0000-0000-0000-000000000002','B','workspace-b','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into public.workspace_members(workspace_id,user_id,role) values
 ('10000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','owner'),
 ('20000000-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','owner');
insert into public.routes(id,workspace_id,name,slug) values
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Route A','route-a'),
 ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','Route B','route-b');
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select is((select count(*)::int from public.workspaces), 1, 'user only sees their workspace');
select is((select count(*)::int from public.routes), 1, 'user only sees routes in their workspace');
select throws_ok($$ select * from private.provider_credentials $$, '42501', null, 'authenticated role cannot read credential storage');

select * from finish();
rollback;
