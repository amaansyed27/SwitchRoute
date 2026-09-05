# SwitchRoute threat model

## Assets

Primary assets are provider credentials, SwitchRoute virtual keys, Edge secrets, workspace/Route configuration, encrypted credential key material, and content-free operational metadata.

Prompts and completions are intentionally transient request data and must never become durable SwitchRoute assets.

## Trust boundaries

- Browser ↔ Next.js control plane/BFF
- BFF ↔ hosted gateway management API
- application client ↔ public `/v1` gateway
- gateway ↔ Supabase/Postgres
- gateway ↔ Redis routing state
- gateway ↔ hosted providers/custom HTTPS endpoints
- Edge CLI/API ↔ local runtimes
- Edge ↔ explicitly configured hosted SwitchRoute fallback
- process ↔ OS credential store / production KMS

## Primary threats and controls

### Cross-workspace access

Supabase Auth verifies identity. Public tables use RLS, and gateway repository operations are scoped by workspace. pgTAP exercises cross-workspace isolation. Credential ciphertext is stored in a private schema outside the browser Data API path.

### Provider credential disclosure

Provider keys are write-only from the product UI, encrypted before persistence, and decrypted only for provider operations. Logs and normalized errors must never contain provider keys or Authorization headers. Production can use KMS-wrapped data keys; local development does not require KMS.

### Virtual-key theft

Virtual keys are bearer credentials, shown once, and stored only as keyed hashes/prefixes. Keys can be revoked. Browser applications should not embed live keys.

### SSRF and DNS rebinding

Hosted custom endpoints require HTTPS and public internet addresses. Loopback/private/link-local/metadata destinations are rejected. DNS is resolved and validated before connection; the request connector is pinned to those validated addresses while retaining the hostname for TLS verification. Redirect targets repeat the same validation. This closes the validate-DNS-then-resolve-again gap.

### Local endpoint exposure

Edge defaults to loopback, does not perform arbitrary LAN scanning, and does not establish a hosted reverse tunnel into the user's network. Runtime endpoints are explicit/discovered within the intended local boundary. Edge secrets use the operating-system credential store.

### Prompt/response leakage

Request content is not written to `request_usage`, Activity, structured logs, or raw-error storage. Raw provider response/error bodies are not propagated when they can echo content. CI asserts the durable usage schema/domain contract contains only allowed operational fields.

### Routing abuse and uncontrolled spend

Gateway-enforced paid fallback and daily paid caps prevent UI-only policy bypass. Unknown cost is not treated as zero. Unknown quota is not treated as unlimited. Reservations and durable paid-spend accounting reduce concurrent overspend races.

### Provider instability

Normalized rate-limit/timeout/unavailable failures feed health/circuit state. Fallback is allowed only before streaming output begins; SwitchRoute never splices a second model into an already-started answer.

### Observability leakage

Allowed observability is request ID, Route, provider/model, latency, token counts, estimated cost, fallback count, normalized failure category, circuit state, quota provenance, and timestamp. Operational logs are structured and content-free.

### Dependency compromise

CI runs language-specific dependency audits and gitleaks in addition to lint/type/test/build gates. Release artifacts are produced by GitHub Actions; signing/notarization is never claimed unless actually configured.

## Residual/operational risks

- A compromised gateway process can access plaintext provider credentials while making provider calls.
- A stolen virtual key remains usable until revoked/expired.
- Upstream providers receive prompts by definition when selected; SwitchRoute's zero-retention policy does not override the provider's own data policy.
- KMS, Redis, Supabase, DNS, and deployment credentials require normal production access control and rotation.
- Edge users who deliberately bind beyond loopback assume the network exposure created by that configuration.

## Release review

Before release, review Supabase Security Advisor, Vercel build/runtime errors, dependency audit output, RLS/privacy tests, DNS/custom-endpoint regression tests, and the exact production secret/domain configuration.
