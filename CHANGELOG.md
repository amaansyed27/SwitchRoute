# Changelog

All notable product changes are recorded here. SwitchRoute follows Semantic Versioning using the repository `VERSION` file as the release source of truth.

## [Unreleased]

### Release hardening

- Added the `switchroute` Python SDK with sync/async clients, streaming, models, typed errors, packaging tests, and guarded PyPI publishing.
- Added `@switchroute/sdk` with TypeScript-first chat, streaming, models, typed errors, ESM exports, and guarded npm publishing.
- Added deterministic compatibility checks for the official OpenAI Python and JavaScript SDKs.
- Added DNS-rebinding-resistant custom hosted endpoint connections and redirect revalidation.
- Added request-ID propagation, structured content-free observability, and expanded normalized gateway errors.
- Added rotatable provider-secret backends including optional KMS-wrapped data keys for production.
- Added installable Edge release packaging for Windows x64, Linux x64, macOS arm64, and macOS x64.
- Expanded Edge CLI lifecycle, runtime, model, Route, and key operations.
- Added retention/privacy database checks and operator cleanup tooling for operational metadata.
- Added k6 load/reliability scenarios.
- Expanded CI for SDKs, dependency audits, version consistency, zero-retention checks, and OpenAPI drift.
- Reworked public documentation around quickstart, API/SDKs, routing, Edge, security, operations, compatibility, and all provider guides.

## 0.3.0

- Added SwitchRoute Edge and local runtime routing.

## 0.2.0

- Added Smart Routing, Redis routing state, quota/capacity handling, health/circuit breakers, paid fallback policy, and budgets.

## 0.1.0

- Established the hosted cloud core, authenticated control plane, encrypted provider credentials, provider catalog, Routes, virtual keys, and OpenAI-compatible chat/models API.
