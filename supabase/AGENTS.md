# Supabase Agent Guide

Follow the root `AGENTS.md` first. This file scopes additional rules to `supabase`.

## Schema and migrations

- Make schema changes through new ordered migration files under `supabase/migrations`; do not edit hosted schema manually as the source of truth.
- Keep RLS enabled on exposed workspace/user tables. New exposed tables require deliberate RLS policies before they are considered complete.
- Preserve workspace isolation across profiles, memberships, providers, routes, keys, usage, and audit data.
- Keep provider credential ciphertext in the private credential schema; do not move credential material into exposed public tables or the Supabase Data API.
- Never expose Supabase service-role/secret credentials to browser code or commit them to the repository.

## Policies and tests

- Prefer explicit workspace-scoped policies and narrow SECURITY DEFINER functions with fixed `search_path` where such functions are necessary.
- Policy, authorization, membership, or isolation changes must add/update pgTAP tests under `supabase/tests`.
- Schema changes that add foreign keys should consider supporting indexes and the Supabase advisors rather than leaving obvious performance/security warnings.

Validate database changes with:

```bash
supabase start
supabase test db
supabase stop
```

Also review `SECURITY.md`, `docs/security/threat-model.md`, and the relevant migration history before changing data exposure or credential storage.
