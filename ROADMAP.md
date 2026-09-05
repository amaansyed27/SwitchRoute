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

Implemented on `slice/4-release-hardening` and awaiting release review before merge or public-beta promotion.

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

### Remaining public-beta release gates

The release-hardening code and CI implementation are complete. The remaining work is operational evidence, deployment verification, and release policy rather than missing routing/product code.

- record measured load-test thresholds against the real deployment and tune from evidence.
- perform a production deploy + rollback drill and a database restore drill before making public trust claims.
- configure release credentials/trusted publishing and exercise the SDK/Edge release workflows without publishing unintended artifacts.
- make an explicit repository license decision before third-party distribution.
- attach the production web/API domains to verified deployments and verify deep links, authentication callbacks, cookies, and browser-to-gateway behavior.
- review current Supabase security/performance advisors and resolve any launch-blocking findings that apply to the production plan and architecture.
