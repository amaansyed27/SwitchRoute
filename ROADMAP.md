# Roadmap

## Slice 1 — Cloud Core

Supabase-backed identity/persistence, encrypted provider credentials, Routes, route-bound virtual keys, OpenAI-compatible chat streaming, sanitized activity metadata, documentation, and the core security model.

### Slice 1.8 — Provider Foundation + Cloud Provider Expansion

- Canonical backend provider catalog exposed to the management UI.
- Flexible safe-format provider persistence instead of a provider-ID database enum/check list.
- 17 hosted provider connection types across direct providers, inference platforms, gateways, and custom public OpenAI-compatible endpoints.
- Richer evidence-based model metadata with provenance.
- SSRF-hardened custom hosted endpoint support.

## Slice 2 — Smart Routing

Implemented and merged before Slice 3:

- Redis-compatible hot routing state behind a vendor-neutral abstraction.
- Explicit quota provenance/confidence and conservative unknown-data behavior.
- Atomic capacity and paid-budget reservations.
- Capability filtering, Priority, Free First, Quota Aware, Fastest, Cheapest, and Balanced strategies.
- Server-enforced paid fallback and optional daily paid cap.
- Provider/model health, circuit breakers, latency and streaming TTFT.

## Slice 3 — SwitchRoute Edge

Implemented on `slice/3-edge-local` for review:

- Rust Edge daemon with loopback-only OpenAI-compatible API.
- First-class Ollama, LM Studio, vLLM, llama.cpp, SGLang, LocalAI, FreeToken, and custom local OpenAI-compatible runtime support.
- Native/stronger discovery where available, with normalized local/cloud/unknown model origin.
- Local SQLite persistence with hash-only Edge keys and bounded sanitized activity.
- OS credential-store integration for runtime and hosted-fallback secrets.
- Priority, Local First and Free First routing with health/model checks.
- Local-to-hosted SwitchRoute fallback without copying hosted provider credentials to the machine.
- Streaming fallback only before output begins; no cross-provider stream splicing.
- Mock-runtime contract/E2E tests plus Linux, Windows, and macOS CI.
- Edge runtime, security, Windows, and web documentation.

Remote device pairing and a public tunnel are intentionally not implemented in Slice 3; no fake pairing UI/schema is present.

## Slice 4 — Release surface

Remaining release work includes installers/binary distribution, npm/PyPI SDK distribution, signing/release automation, final security hardening, production deployment review, and stronger DNS-rebinding-resistant connection pinning for custom hosted endpoints.
