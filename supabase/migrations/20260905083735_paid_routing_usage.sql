-- Slice 2: distinguish usage that participated as paid from free/free-quota routing.
alter table public.request_usage
  add column paid_routing boolean not null default false;

comment on column public.request_usage.paid_routing is
  'True only when the selected target participated as paid under the enforced Route policy.';
