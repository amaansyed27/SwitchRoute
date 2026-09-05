# Database operations and retention

## Durable data boundary

Durable request usage is operational metadata only. `public.request_usage` contains request/workspace/Route/key/provider identifiers, provider/model identity, token counts, latency/TTFT, normalized failure category, fallback count, estimated cost, paid-routing flag, bounded routing metadata, and timestamps.

It has no prompt, message, completion, response, Authorization, or API-key content columns. Provider secret ciphertext lives separately in `private.provider_credentials`.

## Retention cleanup

Migration `20260905163000_operational_retention.sql` defines:

```sql
private.cleanup_operational_history(retain_for interval)
```

The function deletes only old `request_usage` and `audit_events` rows. It is not executable by `anon`, `authenticated`, or `service_role`; run it through a privileged direct database maintenance connection after choosing a retention policy.

The default argument is 90 days, but the migration intentionally does **not** create an automatic destructive schedule.

## Indexes

Do not drop newly added or low-traffic indexes only because Supabase reports them as unused before production load exists. Re-evaluate index usage after representative traffic and query plans are available.

## Backups

Use Supabase/Postgres backup/restore facilities. Treat encrypted provider credential rows and their decrypt key material as one recovery dependency. A database restore alone cannot recover credentials if the matching encryption key/key ID is unavailable.

## Migration rules

- Schema changes are migration-managed.
- Public user-facing tables require RLS and workspace-isolation tests.
- The `private` credential schema must remain inaccessible to browser Data API roles.
- Do not add prompt/response/content columns to operational tables.
- Prefer backward-compatible migrations so the prior gateway can remain a rollback target during deployment.
