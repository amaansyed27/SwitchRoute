# Gateway Agent Guide

Follow the root `AGENTS.md` first. This file scopes additional rules to `services/gateway`.

## Boundaries

- FastAPI owns the public OpenAI-compatible API and management API. LiteLLM is an invocation dependency, not the application architecture.
- Keep provider validation/discovery in `providers`, routing/selection/fallback in `routing`, secret operations in `secrets`, and persistence in `storage`. Do not collapse these boundaries into a large service module.
- Prefer extending existing repository/provider contracts over replacing the backend stack or introducing another gateway layer.

## Routing and streaming

- Route targets are ordered provider/model candidates.
- Fallback is allowed only before response content has started. Once streamed content is emitted, never append or blend output from a different provider.
- Preserve the public OpenAI-compatible semantics of `/v1/chat/completions` and `/v1/models`; intentional changes require tests, docs, and an updated OpenAPI snapshot.

## Security and retention

- Never persist or log prompt, completion, system-prompt, tool, or upload content.
- Keep logs and upstream errors sanitized. Do not expose raw provider error bodies, authorization headers, provider keys, decrypted secrets, or full virtual keys.
- Provider credentials must remain encrypted at rest and write-only from the product perspective.
- Virtual keys must remain keyed-hash based and route-bound.

## Validation

Routing, auth, provider, streaming, storage-contract, or public API changes require focused tests. Run:

```bash
pip install -e ".[dev]"
ruff check --config pyproject.toml src tests ../../scripts/export_openapi.py
pyright
pytest -q
python ../../scripts/export_openapi.py --check
```

If a public schema or route intentionally changes, regenerate `packages/api-contract/openapi.json` from the repository root and review the diff before committing it.
