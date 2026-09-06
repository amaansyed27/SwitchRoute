# SwitchRoute Roadmap

This roadmap describes intended delivery slices. It is not a compatibility or release promise.

## Slice 1 — Cloud Core

Implemented on `main`.

- Supabase Auth and SSR session lifecycle.
- provider credential validation + encrypted gateway-side storage.
- `switchroute` virtual keys shown once and stored as keyed hashes.
- deterministic priority Routes.
- OpenAI-compatible `/v1/chat/completions` and `/v1/models`.
- sanitized activity metadata and zero prompt/response persistence.
- strict browser-to-gateway management BFF.
- responsive desktop/mobile management UI.
- current validated hosted provider catalog plus explicit custom OpenAI-compatible endpoints.
- production domain targets:
  - `switchroute.dawnlightlabs.com`
  - `api.switchroute.dawnlightlabs.com`

## Slice 2 — Smart Capacity Routing

Implemented on `main`.

- Route strategies: Priority, Free First, Quota Aware, Fastest, Cheapest, and Balanced.
- explicit RPM/TPM/RPD/TPD/concurrency quota semantics with confidence and provenance.
- conservative free-capacity rules: unknown is never silently treated as free/unlimited.
- distributed Redis hot state for counters, reservations, health, latency, and circuit breakers.
- deterministic fail-closed/degraded behavior if configured Redis state is unavailable.
- paid fallback controls and atomic daily paid-cap enforcement.
- immutable normalized pricing and capability metadata.
- failover/retry before output only; no mixed-provider streams.
- bounded routing telemetry in the Activity UI.

## Slice 3 — Edge + Local Models

Implemented on `main`.

- Rust Edge daemon for Windows, macOS, and Linux with loopback-only bind enforcement.
- local discovery for Ollama, LM Studio, and vLLM.
- manual llama.cpp, SGLang, LocalAI, FreeToken, custom local, and hosted SwitchRoute targets.
- Priority, Local First, and Free First Edge strategies.
- local OpenAI-compatible `/v1/chat/completions` and `/v1/models`.
- hash-only `sr_edge_` keys and OS credential-store secrets.
- SQLite configuration/model/Route/activity metadata with no prompt/response persistence.
- terminal-first `discover`, `runtime`, `model`, `route`, `key`, and `activity` UX.

## Slice 4 — Release Hardening

Implemented as the final development slice. After the reviewed Slice 4 candidate is merged, the planned four-slice SwitchRoute product implementation is code-complete; public publishing and production promotion remain deliberate release-operator actions.

### SDKs

- Python SDK with sync/async clients, context managers, streaming SSE, typed exceptions and package metadata.
- TypeScript SDK with fetch implementation, async-iterable streaming, typed errors and package metadata.
- OpenAI SDK compatibility matrix and explicit unsupported-endpoint documentation.
- package build, install, audit and release workflows.

### Edge distribution

- release binaries for Windows x64, Linux x64, macOS ARM64, and macOS x64.
- `switchroute-edge --version` / `version`.
- checksum generation and versioned release archives.
- Windows install/upgrade/uninstall guide.

### Hosted hardening

- request correlation IDs and bounded structured operational logs.
- reconnect-safe Redis quota reservation lifecycle.
- custom-endpoint SSRF protections with DNS validation and connection pinning.
- versioned provider-credential encryption keys with optional AWS KMS-wrapped production data keys.
- stable OpenAI-shaped error taxonomy and docs.
- multiple credential connections for the same provider; Waterfalls/Routes may use two or more API keys from one provider as independent targets with separate quota/health state.

### Quality gates

- full CI across web, gateway, database, SDKs, Rust targets, audits, secret scans and release checks.
- generated OpenAPI contract drift detection.
- official OpenAI Python/JavaScript smoke coverage.
- zero-retention static checks and database tests.
- release version consistency checks.
- load/k6 scenarios for normal, model-list and streaming requests.

### Launch documentation

- getting-started flow for sign-in -> provider -> Route -> key -> request.
- provider guide links for every current provider.
- API and SDK docs, Edge docs, security docs, production runbooks and rollback procedures.
- changelog, release process, compatibility matrix and explicit repository license status.

### Public-beta release-operator gates

These are external/credentialed operations rather than missing product code and must remain explicit instead of being faked by a branch merge.

- attach `switchroute.dawnlightlabs.com` and `api.switchroute.dawnlightlabs.com` to verified web/gateway production deployments and verify TLS, auth callbacks, cookies, deep links and browser-to-gateway behavior;
- enable Supabase leaked-password protection if password authentication remains available;
- run and record measured load tests against the intended production environment, plus deployment rollback and database restore drills;
- configure production Redis and the selected credential-encryption backend (AWS KMS-wrapped data key is supported) and retain rotation material safely;
- configure PyPI trusted publishing/npm credentials and exercise SDK publishing only when a release is intentionally approved;
- choose a repository software license before third-party distribution; no license is inferred automatically;
- supply signing/notarization credentials if signed Windows/macOS Edge artifacts are required. Unsigned artifacts must remain clearly labelled.
