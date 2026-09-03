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
- `provider_kind` persistence accepts only a restricted identifier format; support is authorized by the backend provider registry.

## Custom hosted endpoint SSRF boundary

Custom OpenAI-compatible cloud connections are restricted to public HTTPS destinations. The gateway rejects localhost, loopback, private, link-local, non-global IPs, known cloud metadata endpoints, user-info URLs, query/fragment-bearing base URLs, and DNS resolutions that produce any non-public destination. HTTP redirects are followed manually, every target is revalidated, and redirect count is capped.

The custom-provider compatibility check uses a fixed synthetic one-token prompt. It never reuses user traffic and is not retained by SwitchRoute. The upstream service may record or bill that validation request according to its own policy.

Local/private destinations are intentionally excluded from the hosted gateway and belong to SwitchRoute Edge.

See `docs/security/threat-model.md` and `docs/security/zero-retention.md`.
