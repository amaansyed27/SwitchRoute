alter table public.virtual_api_keys
  drop constraint if exists virtual_api_keys_route_id_fkey;

alter table public.virtual_api_keys
  add constraint virtual_api_keys_route_id_fkey
  foreign key (route_id) references public.routes(id) on delete restrict;
