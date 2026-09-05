# Security Policy

Do not report exploitable vulnerabilities in public issues. Use GitHub's private vulnerability reporting when available, or contact Dawnlight Labs privately.

## Security invariants

- Browser code receives only the Supabase publishable key; never a Supabase secret/service-role key.
- Provider credentials are encrypted by the gateway and are never returned after storage.
- Virtual SwitchRoute keys are displayed once and stored only as a prefix plus keyed hash.
- Prompt, completion, system-prompt, tool and upload contents are not persisted.
- Raw upstream error bodies and arbitrary upstream headers are not persisted or returned to clients.
- Public data access is workspace-scoped with RLS.
- Private credential storage is not exposed through the Supabase Data API.
- `provider_kind` persistence accepts only a restricted identifier format; support is authorized by the backend provider registry.
- Redis stores operational routing state only and is never exposed to browser code.

## Smart-routing security boundary

Capability detection runs only against the in-memory request and persists no content. Routing decisions may store bounded provider/model identifiers, safe reason codes, quota provenance/confidence, paid/free participation, latency/circuit metadata and fallback paths.

Unknown data is handled conservatively: unknown price is not free, unknown quota is not unlimited, and unknown latency is not fastest. A `free_capable` model is considered free only when available free-scoped capacity has been confirmed.

Capacity and paid-budget reservations are made before the selected provider credential is decrypted. Reservation TTLs prevent crashed workers from holding capacity indefinitely. When distributed Redis state is configured but unavailable, advanced strategies fall back to deterministic Priority-safe routing rather than silently creating per-instance unlimited state; capped paid traffic is rejected when a distributed budget reservation cannot be enforced.

Authentication failures are not treated as temporary circuit failures. 401/403 marks the provider connection as requiring attention. Transient 429, timeout and upstream-unavailable/5xx failures influence the provider-connection + model circuit breaker.

Streaming fallback is allowed only before the first output-bearing event. SwitchRoute never splices output from a second provider into a stream that has already started.

## Custom hosted endpoint SSRF boundary

Custom OpenAI-compatible cloud connections are restricted to public HTTPS destinations. The gateway rejects localhost, loopback, private, link-local, non-global IPs, known cloud metadata endpoints, user-info URLs, query/fragment-bearing base URLs, and DNS resolutions that produce any non-public destination. HTTP redirects are followed manually, every target is revalidated, and redirect count is capped.

The custom-provider compatibility check uses a fixed synthetic one-token prompt. It never reuses user traffic and is not retained by SwitchRoute. The upstream service may record or bill that validation request according to its own policy.

Local/private destinations are intentionally excluded from the hosted gateway and belong to SwitchRoute Edge.

### Release-hardening item

The current custom-endpoint validation resolves and validates public DNS addresses before requests and revalidates redirect targets. Stronger DNS-rebinding-resistant connection pinning, so the socket is guaranteed to connect to the previously validated address throughout the request lifecycle, remains an explicit Slice 4 security-review item. Slice 2 does not weaken the existing SSRF protections.

See `docs/security/threat-model.md`, `docs/security/zero-retention.md`, and `docs/development/smart-routing.md`.
