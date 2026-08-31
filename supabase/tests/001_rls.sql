begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
insert into public.provider_connections(id,workspace_id,provider_kind,display_name) values
 ('50000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','groq','Groq A'),
 ('60000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000002','groq','Groq B');
insert into private.provider_credentials(provider_connection_id,encrypted_secret,key_id) values
 ('50000000-0000-0000-0000-000000000005','cipher-a','test'),
 ('60000000-0000-0000-0000-000000000006','cipher-b','test');
insert into public.routes(id,workspace_id,name,slug) values
 ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Route A','route-a'),
 ('40000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','Route B','route-b');
insert into public.route_targets(id,route_id,provider_connection_id,model_id,position) values
 ('70000000-0000-0000-0000-000000000007','30000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000005','model-a',0),
 ('80000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000004','60000000-0000-0000-0000-000000000006','model-b',0);
insert into public.virtual_api_keys(id,workspace_id,route_id,environment,name,prefix,key_hash) values
 ('90000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','live','Key A','sr_live_a','hash-a'),
 ('91000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','live','Key B','sr_live_b','hash-b');
insert into public.request_usage(request_id,workspace_id,route_id,virtual_key_id,provider_connection_id,provider_kind,model_id,latency_ms,status) values
 ('92000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','90000000-0000-0000-0000-000000000009','50000000-0000-0000-0000-000000000005','groq','model-a',10,'success'),
 ('93000000-0000-0000-0000-000000000012','20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000004','91000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000006','groq','model-b',10,'success');
insert into public.audit_events(workspace_id,action,entity_type) values
 ('10000000-0000-0000-0000-000000000001','route.created','route'),
 ('20000000-0000-0000-0000-000000000002','route.created','route');
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select is((select count(*)::int from public.workspaces), 1, 'user only sees their workspace');
select is((select count(*)::int from public.provider_connections), 1, 'user only sees providers in their workspace');
select is((select count(*)::int from public.routes), 1, 'user only sees routes in their workspace');
select is((select count(*)::int from public.route_targets), 1, 'user only sees route targets in their workspace');
select is((select count(*)::int from public.virtual_api_keys), 1, 'user only sees keys in their workspace');
select is((select count(*)::int from public.request_usage), 1, 'user only sees request usage in their workspace');
select is((select count(*)::int from public.audit_events), 1, 'user only sees audit events in their workspace');
select throws_ok($$ select * from private.provider_credentials $$, '42501', null, 'authenticated role cannot read credential storage');

select * from finish();
rollback;
