# SwitchRoute

> **One key. Every model you already have.**

SwitchRoute is a Dawnlight Labs project that connects the AI providers a developer already has access to, turns them into reusable Routes, and exposes one OpenAI-compatible API key.

Slice 1 is the Cloud Core: Supabase Auth/Postgres, a Next.js product UI, a FastAPI/LiteLLM gateway, encrypted provider credentials, route-bound virtual keys, provider fallback, zero prompt retention, activity metadata, and documentation.

## Product principles

- Free first; paid only when the user allows it.
- Prompts and completions are never persisted by SwitchRoute.
- Provider credentials are write-only from the product UI and encrypted before storage.
- A Route selects exactly one provider/model for a request; it is not an agent chain.
- UI controls in the product must correspond to real behavior.
- Source files stay focused and modular; CI warns on oversized source files.

## Repository

```text
apps/web/              Next.js product, landing page, auth, onboarding and docs
services/gateway/      FastAPI OpenAI-compatible gateway and management API
packages/ui/           Dawnlight UI primitives shared by the web app
packages/design-tokens/Design tokens
packages/api-contract/ Generated OpenAPI contract
supabase/              Migration-managed Postgres schema and RLS tests
docs/                  Architecture, security, decisions and development guides
scripts/               Repository and contract checks
```

Directories are added only when they serve Slice 1 or establish an immediate extension boundary.

## Local development

Requirements for normal hosted-Supabase development: Node.js 22+ and Python 3.12+. Docker Desktop and the Supabase CLI are only required when intentionally running the database/RLS test stack locally.

1. Configure the hosted Supabase project and allow `http://localhost:3000/auth/callback` in Auth redirect URLs.
2. Copy `.env.example` to `.env` and fill the Gateway block with the hosted Supabase URL, publishable key, Session Pooler database URL, and generated local encryption secrets.
3. Create `apps/web/.env.local` from the Web block in `.env.example`.
4. Install web dependencies: `npm install`.
5. Create the gateway Python 3.12 venv and install it: `py -3.12 -m venv .venv`, then `pip install -e ".\services\gateway[dev]"`.
6. Run the gateway: `python -m uvicorn switchroute.main:app --app-dir services/gateway/src --reload --port 8000`.
7. Run the web app in another terminal: `npm run dev:web`.

See `docs/development/local-windows.md` for the full PowerShell workflow and the optional local Supabase test path.

## Deployment intent

- `apps/web` → `switchroute.dawnlightlabs.com`
- `services/gateway` → `api.switchroute.dawnlightlabs.com`

Production domain changes are intentionally not performed by Slice 1.

## License

No software license has been selected. This is an explicit product/legal decision still to be made; no `LICENSE` file is added by Slice 1.
