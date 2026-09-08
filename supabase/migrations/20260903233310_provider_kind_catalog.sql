-- Slice 1.8: provider identity is validated by the gateway catalog, not a DB provider enum.
alter table public.provider_connections
  drop constraint if exists provider_connections_provider_kind_check;

alter table public.provider_connections
  add constraint provider_connections_provider_kind_format_check
  check (provider_kind ~ '^[a-z0-9][a-z0-9_-]{0,63}$');
