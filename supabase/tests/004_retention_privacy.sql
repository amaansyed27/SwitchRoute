begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_function(
  'private',
  'cleanup_operational_history',
  array['interval'],
  'operator retention cleanup exists'
);
select hasnt_column('public', 'request_usage', 'prompt', 'usage does not retain prompts');
select hasnt_column('public', 'request_usage', 'messages', 'usage does not retain messages');
select hasnt_column('public', 'request_usage', 'completion', 'usage does not retain completions');
select hasnt_column('public', 'request_usage', 'response', 'usage does not retain responses');
select hasnt_column('public', 'request_usage', 'authorization', 'usage does not retain auth headers');
select hasnt_column('public', 'request_usage', 'api_key', 'usage does not retain API keys');
select ok(
  not has_function_privilege('anon', 'private.cleanup_operational_history(interval)', 'EXECUTE'),
  'anon cannot execute retention cleanup'
);
select ok(
  not has_function_privilege('authenticated', 'private.cleanup_operational_history(interval)', 'EXECUTE'),
  'authenticated cannot execute retention cleanup'
);
select ok(
  not has_function_privilege('service_role', 'private.cleanup_operational_history(interval)', 'EXECUTE'),
  'service_role cannot execute retention cleanup through the Data API role'
);

select * from finish();
rollback;
