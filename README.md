# SwitchRoute

> **One key. Every model you already have.**

SwitchRoute is a Dawnlight Labs project that connects the AI providers a developer already has access to, turns them into reusable Routes, and exposes one OpenAI-compatible API key.

The hosted foundation includes Supabase Auth/Postgres, a Next.js product UI, a FastAPI/LiteLLM gateway, encrypted provider credentials, route-bound virtual keys, intelligent fallback, zero prompt retention, activity metadata, and documentation.

## Hosted provider foundation

SwitchRoute currently has 17 hosted production connection types backed by one gateway-owned provider catalog:

- **Direct:** OpenAI, Anthropic, Google Gemini, xAI, Mistral AI, DeepSeek, Cohere.
- **Inference:** Groq, Cerebras, NVIDIA NIM, SambaNova, Together AI, Fireworks AI, DeepInfra.
- **Gateways:** OpenRouter, Hugging Face Inference Providers, and custom OpenAI-compatible public HTTPS endpoints.

The web app consumes `GET /manage/provider-catalog`; provider IDs are not independently enumerated across frontend, API schema, and Postgres. Provider model discovery normalizes only metadata actually supplied by providers, with explicit provenance and unknown values when evidence is absent.

Custom hosted endpoints are SSRF-hardened and cannot target localhost or private/local networks. Local providers belong to SwitchRoute Edge in Slice 3.

## Smart routing

Slice 2 adds operational capacity routing while preserving the same OpenAI-compatible endpoint:

- **Priority** — user order after safety/policy filtering.
- **Free First** — confirmed free capacity before paid capacity.
- **Quota Aware** — uses known RPM/TPM/RPD/TPD/concurrency headroom.
- **Fastest** — uses rolling provider/model latency observations.
- **Cheapest** — uses normalized known provider pricing.
- **Balanced** — combines availability, quota, latency, and price without a fake model-quality score.

Routes also enforce paid fallback (`never`, `after_free`, `allowed`) and an optional daily paid spend cap. Unknown price is not free; unknown quota is not unlimited; unknown latency is not fastest. A `free_capable` model is counted as free only when available free-scoped capacity has actually been confirmed.

Production hot routing state uses standard Redis through `REDIS_URL`. Local development with no `REDIS_URL` uses a deterministic single-process memory store. If configured production Redis is unavailable, advanced strategies degrade to Priority-safe routing instead of silently assuming unlimited capacity.

See `docs/development/smart-routing.md` for strategy, quota, Redis, health, budget, and provider-header details.

## Product principles

- Free first; paid only when the user allows it.
- Prompts and completions are never persisted by SwitchRoute.
- Provider credentials are write-only from the product UI and encrypted before storage.
- A Route selects exactly one provider/model for a request; it is not an agent chain.
- UI controls in the product must correspond to real server behavior.
- Source files stay focused and modular; CI warns on oversized source files.
- Unknown provider metadata remains unknown; SwitchRoute does not invent quality scores.

## Repository

```text
apps/web/              Next.js product, landing page, auth and docs
services/gateway/      FastAPI OpenAI-compatible gateway and management API
packages/ui/           Dawnlight UI primitives shared by the web app
packages/design-tokens/Design tokens
packages/api-contract/ Generated OpenAPI contract
supabase/              Migration-managed Postgres schema and RLS tests
docs/                  Architecture, security, decisions and development guides
scripts/               Repository and contract checks
```

## Local development

Requirements for normal hosted-Supabase development: Node.js 22+ and Python 3.12+. Redis is optional for single-process development and required to exercise distributed Slice 2 routing semantics. Docker Desktop and the Supabase CLI are only required when intentionally running Redis/database integration paths locally.

1. Configure the hosted Supabase project and allow `http://localhost:3000/auth/callback` in Auth redirect URLs.
2. Copy `.env.example` to `.env` and fill the Gateway block with the hosted Supabase URL, publishable key, Session Pooler database URL, and generated local encryption secrets.
3. For in-memory routing, remove/comment `REDIS_URL`. To exercise Redis routing, start Redis and keep `REDIS_URL=redis://localhost:6379/0`.
4. Create `apps/web/.env.local` from the Web block in `.env.example`.
5. Install web dependencies: `npm install`.
6. Create the gateway Python 3.12 venv and install it: `py -3.12 -m venv .venv`, then `pip install -e ".\services\gateway[dev]"`.
7. Run the gateway: `python -m uvicorn switchroute.main:app --app-dir services/gateway/src --reload --port 8000`.
8. Run the web app in another terminal: `npm run dev:web`.

See `docs/development/local-windows.md` for the full PowerShell workflow and optional Redis/Supabase test paths.

## Deployment intent

- `apps/web` → `switchroute.dawnlightlabs.com`
- `services/gateway` → `api.switchroute.dawnlightlabs.com`

## License

No software license has been selected. This is an explicit product/legal decision; no `LICENSE` file is added by this slice.
