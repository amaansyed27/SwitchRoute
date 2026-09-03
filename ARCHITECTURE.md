# Architecture

SwitchRoute is split into a product plane and a request plane.

## Product plane

The Next.js app owns the user experience. Supabase owns identity and the Postgres system of record. Authenticated product mutations are sent to the gateway management API with a verified Supabase access token. Public user-owned tables use RLS; encrypted provider credential ciphertext is stored outside the exposed `public` schema.

Provider identity has one authoritative source: `services/gateway/src/switchroute/providers/catalog.py`. A provider definition binds its stable ID, display/category metadata, authentication type, adapter factory, LiteLLM mapping, discovery support, free-usage hint, documentation slug, and provider-specific metadata configuration. `GET /manage/provider-catalog` exposes the browser-safe projection of that catalog. The frontend does not maintain a second provider identity list.

`provider_connections.provider_kind` is a safe-format text identifier rather than a database enum/list. Postgres enforces identifier shape; the backend registry determines whether a provider is actually supported. Adding a provider therefore does not require a database migration solely to permit its ID.

Provider connection metadata may store nonsecret invocation configuration such as a custom public base URL. Credentials remain separately encrypted in `private.provider_credentials`.

## Request plane

The FastAPI gateway receives an `sr_live_*` or `sr_test_*` virtual key, resolves its bound Route, builds ordered provider/model candidates, decrypts the selected provider credential server-side, asks the provider adapter for LiteLLM invocation arguments, and records sanitized operational metadata. It never writes request messages, response content, tool content, or authorization headers.

```text
OpenAI SDK
  -> virtual-key auth
  -> Route resolution
  -> candidate construction/filtering
  -> target selection
  -> provider adapter LiteLLM mapping
  -> LiteLLM provider invocation
  -> streaming response
  -> sanitized usage metadata
```

Fallback is permitted only before response content has started. Once a stream has emitted content, SwitchRoute never appends output from a different provider.

## Provider model normalization

Adapters own provider-specific credential validation, model discovery/filtering, metadata normalization, and LiteLLM naming. The normalized model record can contain provider/model ID, display name, billing tier, input/output pricing per million tokens, context window, max output, known capabilities, metadata provenance, and discovery timestamp.

Unknown information stays unknown. Provider adapters do not create universal quality scores or infer unsupported pricing/capability claims.

## Custom hosted endpoints

`custom_openai` is a hosted-cloud connection type, not an Edge/local escape hatch. The gateway accepts only public HTTPS base URLs, resolves and validates DNS, rejects non-global/private/loopback/link-local/cloud-metadata destinations, disables automatic redirects, revalidates every redirect target, and limits redirect count. Discovery can use `/models`; a manual model ID is available when discovery is absent. Validation includes a fixed one-token chat compatibility probe.

## Boundaries

- `apps/web`: product UI, Supabase SSR session lifecycle, BFF forwarding.
- `services/gateway/switchroute/auth`: caller and virtual-key authentication.
- `services/gateway/switchroute/providers`: canonical provider catalog, credential validation/model discovery, model normalization, custom-endpoint security, and LiteLLM naming.
- `services/gateway/switchroute/routing`: candidates, strategies, fallback and invocation orchestration.
- `services/gateway/switchroute/secrets`: replaceable secret-store contract.
- `services/gateway/switchroute/storage`: persistence contracts and Postgres implementation.
- `packages/api-contract`: generated FastAPI OpenAPI snapshot.

Redis routing state, advanced quota intelligence, Cheapest/Fastest/Balanced routing, Edge/local routing, and non-text modalities remain later-slice work.
