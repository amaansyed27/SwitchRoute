begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

set local session_replication_role = replica;
insert into public.workspaces(id,name,slug,created_by)
values ('30000000-0000-0000-0000-000000000030','Provider test','provider-test','cccccccc-cccc-cccc-cccc-cccccccccccc');
set local session_replication_role = origin;

select lives_ok(
  $$
    insert into public.provider_connections(workspace_id, provider_kind, display_name)
    select
      '30000000-0000-0000-0000-000000000030'::uuid,
      provider_kind,
      provider_kind
    from unnest(array[
      'openai','anthropic','gemini','xai','mistral','deepseek','cohere',
      'groq','cerebras','nvidia_nim','sambanova','together','fireworks','deepinfra',
      'openrouter','huggingface','custom_openai'
    ]) as provider_kind
  $$,
  'all production provider kinds can be persisted'
);

select throws_ok(
  $$
    insert into public.provider_connections(workspace_id, provider_kind, display_name)
    values ('30000000-0000-0000-0000-000000000030','bad.provider','Bad')
  $$,
  '23514',
  null,
  'unsafe provider identifiers are rejected'
);

select matches(
  pg_get_constraintdef(
    (
      select oid from pg_constraint
      where conrelid = 'public.provider_connections'::regclass
        and conname = 'provider_connections_provider_kind_format_check'
    )
  ),
  'provider_kind.*~',
  'provider kind constraint is format-based rather than an enum list'
);

select * from finish();
rollback;
