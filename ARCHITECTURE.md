# Architecture

SwitchRoute is split into a product plane and a request plane.

## Product plane

The Next.js app owns the user experience. Supabase owns identity and the Postgres system of record. Authenticated product mutations are sent to the gateway management API with a verified Supabase access token. Public user-owned tables use RLS; encrypted provider credential ciphertext is stored outside the exposed `public` schema.

## Request plane

The FastAPI gateway receives an `sr_live_*` or `sr_test_*` virtual key, resolves its bound Route, builds ordered provider/model candidates, asks LiteLLM to invoke one candidate, and records sanitized operational metadata. It never writes request messages, response content, tool content, or authorization headers.

```text
OpenAI SDK
  -> virtual-key auth
  -> route resolution
  -> candidate construction/filtering
  -> target selection
  -> LiteLLM provider invocation
  -> streaming response
  -> sanitized usage metadata
```

Fallback is permitted only before response content has started. Once a stream has emitted content, SwitchRoute never appends output from a different provider.

## Boundaries

- `apps/web`: product UI, Supabase SSR session lifecycle, BFF forwarding.
- `services/gateway/switchroute/auth`: caller and virtual-key authentication.
- `services/gateway/switchroute/providers`: credential validation/model discovery and LiteLLM naming.
- `services/gateway/switchroute/routing`: candidates, strategies, fallback and invocation orchestration.
- `services/gateway/switchroute/secrets`: replaceable secret-store contract.
- `services/gateway/switchroute/storage`: persistence contracts and Postgres implementation.
- `packages/api-contract`: generated FastAPI OpenAPI snapshot.

Redis, advanced quota intelligence, Edge/local routing and non-text modalities are intentionally outside Slice 1.
