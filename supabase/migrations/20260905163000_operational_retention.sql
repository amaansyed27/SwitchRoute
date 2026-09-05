create or replace function private.cleanup_operational_history(
  retain_for interval default interval '90 days'
)
returns table(request_usage_deleted bigint, audit_events_deleted bigint)
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  cutoff timestamptz;
  usage_count bigint;
  audit_count bigint;
begin
  if retain_for < interval '1 day' then
    raise exception 'retain_for must be at least 1 day';
  end if;

  cutoff := now() - retain_for;

  delete from public.request_usage where created_at < cutoff;
  get diagnostics usage_count = row_count;

  delete from public.audit_events where created_at < cutoff;
  get diagnostics audit_count = row_count;

  return query select usage_count, audit_count;
end;
$$;

revoke all on function private.cleanup_operational_history(interval) from public;
revoke all on function private.cleanup_operational_history(interval) from anon;
revoke all on function private.cleanup_operational_history(interval) from authenticated;
revoke all on function private.cleanup_operational_history(interval) from service_role;

comment on function private.cleanup_operational_history(interval) is
  'Operator-only cleanup for content-free request usage and audit metadata. Invoke from a direct privileged database maintenance connection after choosing the retention interval.';
