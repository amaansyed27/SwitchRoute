# Architecture

SwitchRoute is split into a product plane and two request planes: hosted Cloud and local Edge.

## Product plane

The Next.js app owns the user experience. Supabase owns identity and the Postgres system of record. Authenticated product mutations are sent to the gateway management API with a verified Supabase access token. Public user-owned tables use RLS; encrypted provider credential ciphertext is stored outside the exposed `public` schema.

Provider identity has one authoritative source: `services/gateway/src/switchroute/providers/catalog.py`. A provider definition binds its stable ID, display/category metadata, authentication type, adapter factory, LiteLLM mapping, discovery support, free-usage hint, documentation slug, and provider-specific metadata configuration. `GET /manage/provider-catalog` exposes the browser-safe projection of that catalog. The frontend does not maintain a second provider identity list.

`provider_connections.provider_kind` is a safe-format text identifier rather than a database enum/list. Postgres enforces identifier shape; the backend registry determines whether a provider is actually supported. Provider connection metadata may store nonsecret invocation configuration such as a custom public base URL. Credentials remain separately encrypted in `private.provider_credentials`.

## Hosted request plane

The FastAPI gateway receives an `sr_live_*` or `sr_test_*` virtual key and keeps one OpenAI-compatible API surface while routing among eligible provider/model targets.

```text
OpenAI SDK
  -> virtual-key authentication
  -> Route resolution
  -> capability / health / circuit filters
  -> quota, paid-policy and strategy evaluation
  -> selected credential decryption
  -> provider adapter + LiteLLM invocation
  -> bounded sanitized routing/activity metadata
```

Prompt, response, system-prompt, tool and upload contents are never written by routing. Credential decryption happens only after a target has been selected and capacity reserved.

Fallback is permitted only before response content has started. Once a stream has emitted content, SwitchRoute never appends output from a different provider.

## Edge request plane

`crates/switchroute-edge` is a separate Rust daemon for local/private runtimes. It exposes an OpenAI-compatible API on `127.0.0.1:8787` by default and rejects non-loopback daemon binds in Slice 3.

```text
Local application
  -> sr_edge_* authentication
  -> Edge Route
      -> Ollama / LM Studio / vLLM / llama.cpp / SGLang / LocalAI / FreeToken / custom local
      -> hosted SwitchRoute Route (optional fallback)
```

Edge persists runtime configuration, model metadata, Routes, hash-only API keys and bounded sanitized activity in local SQLite. Runtime and hosted fallback credentials are stored through the operating-system credential store; SQLite keeps only secret references. Edge does not persist prompt/response/tool/upload content.

Local/private runtime URLs are deliberately permitted in Edge. The hosted gateway retains its public-HTTPS SSRF boundary and never initiates requests to a user's localhost. Slice 3 adds no reverse tunnel, relay or LAN scan.

For streaming, Edge may fall back only before the first output-bearing SSE event. Once output begins it commits to that target. `Local First` uses normalized model origin, so Ollama remote/cloud models are not treated as local/free.

## Smart-routing boundaries

`services/gateway/src/switchroute/routing` contains planner/context/orchestration plus independent strategies. The orchestrator does not contain strategy scoring logic.

`services/gateway/src/switchroute/quota` models RPM, TPM, RPD, TPD and concurrency with explicit provenance, confidence and capacity scope. Unknown quota is not unlimited. Observed account limits are not automatically classified as free capacity.

`services/gateway/src/switchroute/health` owns circuit-breaker and rolling-latency behavior. Credential validity is separate from transient provider/model health.

`services/gateway/src/switchroute/budget` owns pricing/cost estimation and paid fallback policy. Durable usage records identify whether traffic actually routed as paid so confirmed free-capacity traffic does not consume a Route's paid cap.

Redis stores only hot operational state behind the `RoutingState` abstraction. Production can use any compatible Redis endpoint via `REDIS_URL`; tests and intentionally Redis-free local development use `MemoryRoutingState`. A configured-but-unavailable Redis does not silently become per-instance memory: advanced routing degrades to deterministic Priority-safe behavior.

## Provider model normalization

Adapters own provider-specific credential validation, model discovery/filtering, metadata normalization, and LiteLLM naming. Unknown information stays unknown; adapters do not invent universal quality scores or unsupported pricing/capability claims.

## Custom hosted endpoints

`custom_openai` is a hosted-cloud connection type, not an Edge/local escape hatch. The gateway accepts only public HTTPS base URLs, resolves and validates DNS, rejects non-global/private/loopback/link-local/cloud-metadata destinations, disables automatic redirects, revalidates every redirect target, and limits redirect count.

DNS-rebinding-resistant connection pinning remains an explicit Slice 4 security-hardening item.

## Boundaries

- `apps/web`: product UI, Supabase SSR session lifecycle, BFF forwarding and documentation.
- `services/gateway`: hosted Cloud management/request plane and smart routing.
- `crates/switchroute-edge`: local/private runtime discovery, routing, OpenAI-compatible API and local persistence.
- `packages/api-contract`: generated hosted FastAPI OpenAPI snapshot.
- `supabase`: hosted identity and persistence schema.

Final packaging, SDK distribution, installers and release hardening remain Slice 4 work.
