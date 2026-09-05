# Architecture

SwitchRoute is split into a product plane and a request plane.

## Product plane

The Next.js app owns the user experience. Supabase owns identity and the Postgres system of record. Authenticated product mutations are sent to the gateway management API with a verified Supabase access token. Public user-owned tables use RLS; encrypted provider credential ciphertext is stored outside the exposed `public` schema.

Provider identity has one authoritative source: `services/gateway/src/switchroute/providers/catalog.py`. A provider definition binds its stable ID, display/category metadata, authentication type, adapter factory, LiteLLM mapping, discovery support, free-usage hint, documentation slug, and provider-specific metadata configuration. `GET /manage/provider-catalog` exposes the browser-safe projection of that catalog. The frontend does not maintain a second provider identity list.

`provider_connections.provider_kind` is a safe-format text identifier rather than a database enum/list. Postgres enforces identifier shape; the backend registry determines whether a provider is actually supported. Provider connection metadata may store nonsecret invocation configuration such as a custom public base URL. Credentials remain separately encrypted in `private.provider_credentials`.

## Request plane

The FastAPI gateway receives an `sr_live_*` or `sr_test_*` virtual key and keeps one OpenAI-compatible API surface while routing among eligible provider/model targets.

```text
OpenAI SDK
  -> virtual-key authentication
  -> Route resolution
  -> in-memory capability requirements
  -> capability / health / circuit filters
  -> paid-policy and quota evaluation
  -> strategy scoring / ordering
  -> atomic capacity + budget reservation
  -> selected credential decryption
  -> provider adapter + LiteLLM invocation
  -> safe quota / token / latency / error observation
  -> reservation reconciliation
  -> bounded sanitized usage metadata
```

Prompt, response, system-prompt, tool and upload contents are never written by routing. Credential decryption happens only after a target has been selected and capacity reserved.

Fallback is permitted only before response content has started. Once a stream has emitted content, SwitchRoute never appends output from a different provider.

## Smart-routing boundaries

`services/gateway/src/switchroute/routing` contains planner/context/orchestration plus independent strategies. The orchestrator does not contain strategy scoring logic.

`services/gateway/src/switchroute/quota` models RPM, TPM, RPD, TPD and concurrency with explicit provenance, confidence and capacity scope. Unknown quota is not unlimited. Observed account limits are not automatically classified as free capacity.

`services/gateway/src/switchroute/health` owns circuit-breaker and rolling-latency behavior. Credential validity is separate from transient provider/model health.

`services/gateway/src/switchroute/budget` owns pricing/cost estimation and paid fallback policy. Durable usage records identify whether traffic actually routed as paid so confirmed free-capacity traffic does not consume a Route's paid cap.

Redis stores only hot operational state behind the `RoutingState` abstraction. Production can use any compatible Redis endpoint via `REDIS_URL`; tests and intentionally Redis-free local development use `MemoryRoutingState`. A configured-but-unavailable Redis does not silently become per-instance memory: advanced routing degrades to deterministic Priority-safe behavior.

## Provider model normalization

Adapters own provider-specific credential validation, model discovery/filtering, metadata normalization, and LiteLLM naming. The normalized model record can contain provider/model ID, display name, billing tier, input/output pricing per million tokens, context window, max output, known capabilities, metadata provenance, and discovery timestamp.

Unknown information stays unknown. Provider adapters do not create universal quality scores or infer unsupported pricing/capability claims.

## Custom hosted endpoints

`custom_openai` is a hosted-cloud connection type, not an Edge/local escape hatch. The gateway accepts only public HTTPS base URLs, resolves and validates DNS, rejects non-global/private/loopback/link-local/cloud-metadata destinations, disables automatic redirects, revalidates every redirect target, and limits redirect count. Discovery can use `/models`; a manual model ID is available when discovery is absent. Validation includes a fixed one-token chat compatibility probe.

DNS-rebinding-resistant connection pinning remains an explicit Slice 4 security-hardening item. Slice 2 does not weaken the existing validation boundary.

## Boundaries

- `apps/web`: product UI, Supabase SSR session lifecycle, BFF forwarding.
- `services/gateway/switchroute/auth`: caller and virtual-key authentication.
- `services/gateway/switchroute/providers`: canonical provider catalog, validation/model discovery, normalization, custom-endpoint security, and LiteLLM naming.
- `services/gateway/switchroute/routing`: capability-aware planning, strategy ordering, reservation-aware fallback and invocation orchestration.
- `services/gateway/switchroute/quota`: quota evidence and safe header parsing.
- `services/gateway/switchroute/health`: provider/model transient health, circuits and latency aggregates.
- `services/gateway/switchroute/budget`: paid policy and cost estimation.
- `services/gateway/switchroute/secrets`: replaceable secret-store contract.
- `services/gateway/switchroute/storage`: persistence contracts and Postgres implementation.
- `packages/api-contract`: generated FastAPI OpenAPI snapshot.

Edge/local routing and final release/security packaging remain Slice 3 and Slice 4 work respectively.
