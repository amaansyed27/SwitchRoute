create index if not exists workspaces_created_by_idx on public.workspaces(created_by);
create index if not exists route_targets_provider_connection_idx on public.route_targets(provider_connection_id);
create index if not exists request_usage_virtual_key_idx on public.request_usage(virtual_key_id);
create index if not exists request_usage_provider_connection_idx on public.request_usage(provider_connection_id);
create index if not exists audit_events_actor_user_idx on public.audit_events(actor_user_id);
