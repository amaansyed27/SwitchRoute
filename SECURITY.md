# Security Policy

Do not report exploitable vulnerabilities in public issues. Use GitHub's private vulnerability reporting when available, or contact Dawnlight Labs privately.

## Security invariants

- Browser code receives only the Supabase publishable key; never a Supabase secret/service-role key.
- Provider credentials are encrypted by the gateway and are never returned after storage.
- Hosted virtual SwitchRoute keys are displayed once and stored only as a prefix plus keyed hash.
- Prompt, completion, system-prompt, tool and upload contents are not persisted.
- Raw upstream error bodies and arbitrary upstream headers are not persisted or returned to clients.
- Public data access is workspace-scoped with RLS.
- Private credential storage is not exposed through the Supabase Data API.
- Redis stores operational routing state only and is never exposed to browser code.

## Hosted smart-routing boundary

Capability detection runs only against the in-memory request and persists no content. Routing decisions may store bounded provider/model identifiers, safe reason codes, quota provenance/confidence, paid/free participation, latency/circuit metadata and fallback paths.

Unknown data is handled conservatively: unknown price is not free, unknown quota is not unlimited, and unknown latency is not fastest. Authentication failures are distinct from transient circuit failures.

Streaming fallback is allowed only before the first output-bearing event. SwitchRoute never splices output from a second provider into a stream that has already started.

## Custom hosted endpoint SSRF boundary

Custom OpenAI-compatible cloud connections are restricted to public HTTPS destinations. The gateway rejects localhost, loopback, private, link-local, non-global IPs, known cloud metadata endpoints, user-info URLs, query/fragment-bearing base URLs, and DNS resolutions that produce any non-public destination. HTTP redirects are followed manually, every target is revalidated, and redirect count is capped.

Local/private destinations are intentionally excluded from the hosted gateway and belong to SwitchRoute Edge.

## Edge security boundary

SwitchRoute Edge is local-first and deliberately has a different outbound trust boundary from the hosted gateway:

- the Edge API binds to loopback only in Slice 3; non-loopback daemon binds are rejected;
- there is no reverse tunnel, relay, hosted callback into Edge, automatic LAN scan, or public localhost exposure;
- private/LAN runtime endpoints may be configured manually because reaching private inference servers is Edge's purpose;
- Edge API keys use `sr_edge_` plaintext presented once and SHA-256 hash-only local persistence;
- runtime and hosted fallback secrets are stored through the operating-system credential store, while SQLite stores references only;
- prompts, completions, system prompts, tool contents, uploads, Authorization headers and raw upstream responses are not persisted;
- request activity is bounded and sanitized;
- upstream redirects are disabled by the Edge HTTP client;
- streaming target switches are permitted only before output begins.

A hosted SwitchRoute fallback target carries only the hosted SwitchRoute Route/API credential. Hosted provider credentials are never downloaded to Edge.

## Release-hardening items

Slice 4 retains final packaging/signing review and stronger DNS-rebinding-resistant connection pinning for custom hosted endpoints.

The live Supabase security advisor currently reports RLS disabled on `private.provider_credentials`. That table is outside the exposed public schema and is intentionally gateway-owned; do not enable RLS blindly without matching gateway-access policies and a migration/test review.

See `docs/security/threat-model.md`, `docs/security/zero-retention.md`, and `docs/edge/security.md`.
