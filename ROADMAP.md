# Roadmap

## Slice 1 — Cloud Core

Supabase-backed identity/persistence, encrypted provider credentials, Routes, route-bound virtual keys, OpenAI-compatible chat streaming, sanitized activity metadata, documentation, and the core security model.

### Slice 1.8 — Provider Foundation + Cloud Provider Expansion

- Canonical backend provider catalog exposed to the management UI.
- Flexible safe-format provider persistence instead of a provider-ID database enum/check list.
- 17 hosted provider connection types across direct providers, inference platforms, gateways, and custom public OpenAI-compatible endpoints.
- Richer evidence-based model metadata with provenance.
- SSRF-hardened custom hosted endpoint support.
- Provider consistency, mocked discovery/invocation, persistence, streaming/fallback, RLS, and credential-security coverage.

## Slice 2 — Smart Routing

Implemented on `slice/2-smart-routing` for review:

- Redis-compatible hot routing state behind a vendor-neutral abstraction plus deterministic in-memory tests/local mode.
- Explicit quota provenance/confidence and conservative unknown-data behavior.
- Atomic request/token/concurrency and paid-budget reservations with TTL/reconciliation.
- Capability filtering before provider invocation.
- Priority, Free First, Quota Aware, Fastest, Cheapest, and Balanced strategies.
- Server-enforced paid fallback and optional daily paid cap.
- Provider/model transient health, circuit breakers, request-latency EWMA and streaming TTFT.
- Known-cost usage calculation and bounded routing-decision metadata.
- Dashboard, Routes and Activity visibility for routing health/reasons without content retention.

`Auto` is intentionally not included because the explicit strategies provide clearer policy and auditability.

## Slice 3 — SwitchRoute Edge

Planned first-class local/provider runtime support for at least Ollama, LM Studio, vLLM, llama.cpp, SGLang, LocalAI, FreeToken, and custom local OpenAI-compatible endpoints. Hugging Face TGI and MLX-LM remain candidates.

## Slice 4 — Release surface

Packaging/release work such as npm/PyPI SDK distribution and final release hardening remains later work. The security review also includes stronger DNS-rebinding-resistant connection pinning for custom hosted endpoints.
