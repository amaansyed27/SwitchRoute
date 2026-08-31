# Security Policy

Do not report exploitable vulnerabilities in public issues. Use GitHub's private vulnerability reporting when available, or contact Dawnlight Labs privately.

## Security invariants

- Browser code receives only the Supabase publishable key; never a Supabase secret/service-role key.
- Provider credentials are encrypted by the gateway and are never returned after storage.
- Virtual SwitchRoute keys are displayed once and stored only as a prefix plus keyed hash.
- Prompt, completion, system-prompt, tool and upload contents are not persisted.
- Raw upstream error bodies are not persisted or returned to clients.
- Public data access is workspace-scoped with RLS.
- Private credential storage is not exposed through the Supabase Data API.

See `docs/security/threat-model.md` and `docs/security/zero-retention.md`.
