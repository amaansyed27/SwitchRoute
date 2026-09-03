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

## Slice 2 — Routing intelligence

Planned, not implemented by Slice 1.8:

- Redis-backed live routing state.
- Quota-aware strategy.
- Cheapest, Fastest, and Balanced strategies.
- Circuit breakers, concurrency reservations, and advanced budgets.

## Slice 3 — SwitchRoute Edge

Planned first-class local/provider runtime support for at least Ollama, LM Studio, vLLM, llama.cpp, SGLang, LocalAI, FreeToken, and custom local OpenAI-compatible endpoints. Hugging Face TGI and MLX-LM remain candidates.

## Slice 4 — Release surface

Packaging/release work such as npm/PyPI SDK distribution and final release hardening remains later work.
