# SwitchRoute Agent Guide

`AGENTS.md` is the canonical repository guidance for coding agents. Scoped `AGENTS.md` files may add local rules but must not contradict this file. Before editing `apps/web`, `services/gateway`, or `supabase`, read the nearest scoped guide too.

## Product and architecture

SwitchRoute is a Dawnlight Labs routing layer that lets developers connect AI providers, define ordered Routes, and call them through one OpenAI-compatible API key.

The system has two primary planes:

- `apps/web`: Next.js product plane for auth, onboarding, provider/route/key management, activity, docs, and the BFF.
- `services/gateway`: FastAPI request/management plane for auth, routing, fallback, provider invocation through LiteLLM, secret handling, and sanitized usage metadata.
- `supabase`: Auth/Postgres schema, migrations, RLS, workspace isolation, and DB tests.
- `packages/ui` and `packages/design-tokens`: shared frontend primitives/tokens.
- `packages/api-contract`: generated OpenAPI snapshot.
- `docs`: architecture, security, decisions, and development guidance.

Read `ARCHITECTURE.md` before changing system boundaries.

## Common validation commands

From the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:web
npm run build:web
npm run check:files
python scripts/export_openapi.py --check
```

Gateway checks, with the Python 3.12 environment active:

```bash
cd services/gateway
pip install -e ".[dev]"
ruff check --config pyproject.toml src tests ../../scripts/export_openapi.py
pyright
pytest -q
```

Database/RLS checks require the local Supabase test stack:

```bash
supabase start
supabase test db
supabase stop
```

See `docs/development/local-windows.md` for the supported Windows workflow and `.github/workflows/ci.yml` for the authoritative CI sequence.

## Engineering rules

- Prefer small, responsibility-focused modules. Avoid catch-all files and unnecessary backend rewrites.
- Keep TS/TSX and Python source files near 250 lines where practical; reconsider structure above 300 lines. The repository file-size check is a guardrail, not a target.
- Extend existing architecture and contracts before introducing new abstraction layers.
- Preserve existing behavior unless the task explicitly changes it. Add tests for behavior, authorization, routing, or API changes.
- Preserve OpenAI-compatible behavior for the public API, especially `/v1/chat/completions` and `/v1/models`. Intentional contract changes must update the generated OpenAPI snapshot and relevant docs.
- UI controls must perform real actions. Never add fake, decorative, or knowingly nonfunctional controls.

## Security invariants

- SwitchRoute must never persist prompt, completion, system-prompt, tool, or upload content. Do not add telemetry or logs that violate zero retention.
- Logs, usage records, and client-facing upstream errors must be sanitized; never log authorization headers, provider keys, virtual keys, raw upstream bodies, prompts, or model output.
- Provider credentials are gateway-owned secrets: validate them, encrypt them before storage, and never return stored plaintext to the UI.
- Browser code may receive only Supabase publishable credentials. Never expose service-role/secret credentials client-side.
- Virtual SwitchRoute keys are shown once and persisted only as safe metadata plus keyed hashes.
- RLS and workspace isolation are mandatory for exposed Supabase data. Private provider credential storage must remain outside the exposed public schema.

Read `SECURITY.md`, `docs/security/threat-model.md`, and `docs/security/zero-retention.md` before changing auth, secrets, logging, storage, or data exposure.

## Change validation

Before considering work complete:

1. Run the checks relevant to the files changed; run the full CI-equivalent suite for cross-cutting or merge-boundary changes.
2. Check OpenAPI drift when public gateway schemas/routes change.
3. Add or update DB tests when migrations, policies, workspace access, or RLS behavior change.
4. Browser-verify meaningful user-facing web changes at representative desktop and mobile widths.
5. Confirm no secrets, `.env` files, prompt/completion content, generated `.next` output, or unrelated changes are staged.

## Git and documentation

- Use focused branches and conventional commit messages.
- Keep commits scoped and reviewable; do not mix unrelated refactors with feature/fix work.
- Do not force-update shared branches or merge failing CI without an explicit repository-owner decision.
- Keep generated artifacts such as `package-lock.json` and `packages/api-contract/openapi.json` in sync when their sources change.
- `ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/workflows/ci.yml`, and relevant files under `docs/` remain authoritative. Update them when their documented behavior or boundaries change; do not duplicate them into agent files.
