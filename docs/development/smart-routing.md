# Smart routing

Slice 2 turns a Route from a static waterfall into an operational capacity policy while preserving one OpenAI-compatible `/v1/chat/completions` endpoint.

## Request pipeline

1. Authenticate the SwitchRoute virtual key and resolve its Route.
2. Infer capability requirements in memory only. Message, tool, image, system-prompt, and response content is never persisted for routing.
3. Load the Route's provider/model candidates and normalized model metadata.
4. Exclude confirmed capability mismatches, invalid credentials, open circuits, exhausted known quota, and targets disallowed by paid/budget policy.
5. Score/order candidates with the selected strategy.
6. Atomically reserve request/token/concurrency capacity and, when applicable, paid budget.
7. Only after reservation, decrypt the selected provider credential and invoke it through the existing LiteLLM adapter path.
8. Observe safe rate-limit headers, token usage, latency, TTFT for streams, and normalized errors.
9. Reconcile the reservation on success, error, timeout, cancellation, or stream failure.
10. Persist bounded sanitized decision metadata. Prompt/response/tool/upload content and raw upstream headers/bodies are never persisted.

Streaming preserves the Slice 1 invariant: fallback may occur only before the first content/tool/reasoning/finish event. Once output begins, SwitchRoute never continues the generation with a different provider.

## Strategies

| Strategy | Behavior | Unknown data |
| --- | --- | --- |
| Priority | Keeps Route target order after safety/policy filters. | Unknown quota does not mean unlimited; the target can still be attempted in priority order and upstream 429s can fall back before output. |
| Free First | Known free first, then free-capable targets with observed capacity, then free-capable with unknown live quota, then paid/unknown-price only if policy allows. | Unknown price is never free. |
| Quota Aware | Prefers the highest minimum known remaining-capacity ratio across RPM/TPM/RPD/TPD/concurrency. | Unknown quota is ranked after comparable known usable quota, never as unlimited. |
| Fastest | Uses provider-connection + model full-request latency EWMA. | Cold targets are ranked after observed targets; confidence is low below 3 samples, medium at 3–7, high at 8+. |
| Cheapest | Estimates the request using normalized input/output prices and an in-memory token estimate. | Unknown price sorts after known prices and never wins as “free.” |
| Balanced | Combines health (35%), usable quota (30%), latency (20%), and price (15%). | Unknown operational dimensions receive a conservative neutral-low score. No model-quality score exists. |

`Auto` is intentionally not included in Slice 2. The explicit strategies are defensible and inspectable; an additional magic policy would not add a clear invariant yet.

## Paid fallback and budgets

Routes enforce policy server-side:

- `never`: only `free` and `free_capable` targets may run. Paid and unknown-priced targets are excluded.
- `after_free`: eligible free/free-capable capacity is exhausted before paid/unknown-priced targets are considered.
- `allowed`: paid targets may participate according to the selected strategy.

`daily_paid_cap_microusd` is an optional UTC-day Route cap. Durable successful usage in Postgres is combined with hot reserved/confirmed spend in routing state. A paid or unknown-priced candidate whose request cost cannot be estimated is rejected while a cap is active; this avoids an unenforceable surprise charge.

This is provider-spend routing protection, not SwitchRoute subscription billing.

## Quota model

Every quota metric carries provenance and confidence:

- `exact`: account/quota API data.
- `observed`: routing-relevant provider response headers.
- `estimated`: SwitchRoute counters/derived state.
- `catalog`: documented non-account-specific metadata.
- `unknown`: no defensible value is available.

Metrics can represent RPM, TPM, RPD, TPD, and concurrent requests with `limit`, `remaining`, reset/window information where known, `observed_at`, source, and confidence. An estimate is never displayed as exact.

Source preference is exact account API > response headers > SwitchRoute counters > catalog > unknown. Slice 2 does not poll account APIs on every request. Stable account-specific APIs can be added adapter-by-adapter without changing the routing model.

### Provider observation support

SwitchRoute only whitelists routing-relevant headers; arbitrary response headers are discarded.

| Provider | Account/quota API in Slice 2 | Safe header parser |
| --- | --- | --- |
| OpenAI | None with ordinary project API keys | OpenAI-style request/token limit, remaining, reset |
| Anthropic | None | `anthropic-ratelimit-requests-*` and aggregate `anthropic-ratelimit-tokens-*` when emitted |
| Gemini | None | OpenAI-style parser only if the upstream adapter exposes equivalent normalized headers; otherwise counters/unknown |
| xAI | None | OpenAI-style request/token headers when emitted |
| Mistral | None | OpenAI-style request/token headers when emitted |
| DeepSeek | None | OpenAI-style request/token headers when emitted |
| Cohere | None | OpenAI-style request/token headers when emitted |
| Groq | None | OpenAI-style request/token headers when emitted |
| Cerebras | None | OpenAI-style request/token headers when emitted |
| NVIDIA NIM | None | OpenAI-style request/token headers when emitted |
| SambaNova | None | OpenAI-style request/token headers when emitted |
| Together AI | None | OpenAI-style request/token headers when emitted |
| Fireworks AI | None | OpenAI-style request/token headers when emitted |
| DeepInfra | None | OpenAI-style request/token headers when emitted |
| OpenRouter | None | Only the explicit OpenAI-style names are parsed; unrelated credit headers are not reinterpreted as request quota |
| Hugging Face Inference Providers | None | OpenAI-style request/token headers when emitted |
| Custom OpenAI-compatible | None | Same whitelist when the custom endpoint emits the standard names |

Quota detection quality therefore depends on what each upstream exposes. Absence of a header remains unknown, not unlimited.

## Redis hot state

Set `REDIS_URL` to any standard Redis-compatible endpoint. Routing code uses a `RoutingState` abstraction and is not coupled to a managed Redis vendor.

Hot keys hold only operational data: quota snapshots, expiring reservations, daily budget reservations/spend, circuit state, failure counts, and EWMA latency/TTFT. No prompt/response or credentials enter Redis.

Capacity reservations use Redis lease locks (`SET NX` semantics through redis-py locks) plus transactional pipelines. Active reservations are stored in expiry-scored sorted sets, so expired leases stop consuming capacity even if a worker crashes. Route budget locking is acquired before target locking so concurrent requests on different paid targets cannot race a daily cap.

Local development with no `REDIS_URL` uses the deterministic in-process implementation. It is single-process by definition and is not a production substitute for cross-instance atomicity.

### Redis unavailable

If `REDIS_URL` was configured but Redis cannot be reached, the gateway starts in degraded routing-state mode instead of silently replacing distributed state with per-instance memory. Advanced strategies deterministically degrade to Priority. Unknown state is never interpreted as unlimited. Paid requests with a daily cap are not allowed when the distributed budget reservation cannot be enforced. The health endpoint reports routing state as degraded.

## Health and circuits

Credential validity remains separate from transient provider/model health.

- provider 401/403: `provider_auth_error`; connection is marked `invalid`/attention-required and is not put into a temporary retry loop.
- 429: `provider_rate_limited`; transient circuit signal.
- timeout: `provider_timeout`; transient circuit signal.
- upstream unavailable/5xx/model unavailable normalization: `provider_unavailable`; transient circuit signal.

Circuits are scoped by provider connection + model. Three consecutive transient failures open a circuit for 30 seconds. After cooldown it becomes half-open for a probe; success closes/reset it, while another transient failure can reopen it.

## Latency and cost

Full request latency uses an EWMA with alpha 0.25. Streaming TTFT is measured separately from request start to first output-bearing event and has its own EWMA. Fastest currently ranks by full-request EWMA so TTFT is never silently substituted for end-to-end latency.

Known model prices from Slice 1.8 are applied to estimated/observed input and output tokens. `estimated_cost_microusd` remains null when price or usable token information is unknown.

## Sanitized decision metadata

`request_usage.routing_decision` is limited to 16 KiB. It can include requested/effective strategy, selected provider/model, safe reason codes, bounded fallback path, bounded exclusions, quota source/confidence, circuit state, and latency confidence. It cannot contain request content, response content, system prompts, tool contents, uploads, provider keys, authorization headers, raw provider bodies, or arbitrary upstream headers.
