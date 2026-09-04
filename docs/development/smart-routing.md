# Smart routing

Slice 2 turns a Route from a static waterfall into an operational capacity policy while preserving one OpenAI-compatible `/v1/chat/completions` endpoint.

## Request pipeline

1. Authenticate the SwitchRoute virtual key and resolve its Route.
2. Infer capability requirements in memory only. Message, tool, image, system-prompt, and response content is never persisted for routing.
3. Load the Route's provider/model candidates and normalized model metadata.
4. Exclude confirmed capability mismatches and known-unavailable/open-circuit targets.
5. Load quota/capacity state and enforce paid fallback plus daily paid-cap policy.
6. Score/order candidates with the selected strategy.
7. Atomically reserve request/token/concurrency capacity and, when applicable, paid budget.
8. Only after reservation, decrypt the selected provider credential and invoke it through the existing LiteLLM adapter path.
9. Observe safe rate-limit headers, token usage, latency, TTFT for streams, and normalized errors.
10. Reconcile the reservation on success, error, timeout, cancellation, or stream failure.
11. Persist bounded sanitized decision metadata. Prompt/response/tool/upload content and raw upstream headers/bodies are never persisted.

Streaming preserves the Slice 1 invariant: fallback may occur only before the first content/tool/reasoning/finish event. Once output begins, SwitchRoute never continues the generation with a different provider.

## Strategies

| Strategy | Behavior | Unknown data |
| --- | --- | --- |
| Priority | Keeps Route target order after safety/policy filters. | Unknown quota does not mean unlimited; user order remains the deterministic fallback. |
| Free First | Known-free targets first. A `free_capable` target joins the free group only when hot quota state explicitly confirms available free-scoped capacity. Paid targets participate only when policy permits them. | `free_capable` by itself is not proof of free capacity. Unknown price is never free. |
| Quota Aware | Prefers the highest minimum known remaining-capacity ratio across RPM/TPM/RPD/TPD/concurrency. | Unknown quota is ranked after comparable known usable quota, never as unlimited. |
| Fastest | Uses provider-connection + model full-request latency EWMA. | Cold targets rank after observed targets; confidence is low below 3 samples, medium at 3–7, high at 8+. |
| Cheapest | Estimates the request using normalized input/output prices and an in-memory token estimate. | Unknown price sorts after known prices and never wins as zero-cost. |
| Balanced | Combines health/availability, usable quota, latency, and price. | Missing operational signals are handled conservatively. No model-quality score exists. |

`Auto` is intentionally not included in Slice 2. The explicit strategies are defensible and inspectable; an additional magic policy would not add a clear invariant yet.

## Paid fallback and budgets

Routes enforce policy server-side:

- `never`: only known-free targets or `free_capable` targets with confirmed available free-scoped capacity may run.
- `after_free`: confirmed free capacity is exhausted before paid candidates are considered.
- `allowed`: paid candidates may participate according to the selected strategy.

`daily_paid_cap_microusd` is an optional UTC-day Route cap. Durable successful usage in Postgres is combined with hot reserved/confirmed spend in routing state. `request_usage.paid_routing` records whether the selected target actually participated as paid, so confirmed free-quota traffic does not consume the paid cap.

A paid candidate whose request cost cannot be estimated is rejected while a daily cap is active; this avoids an unenforceable surprise charge. This is provider-spend routing protection, not SwitchRoute subscription billing.

## Quota model

Every quota metric carries explicit evidence:

- `exact`: account-specific authoritative provider quota data.
- `observed`: routing-relevant provider response headers.
- `estimated`: SwitchRoute counters/derived state.
- `catalog`: documented non-account-specific metadata.
- `unknown`: no defensible value is available.

Metrics can represent RPM, TPM, RPD, TPD, and concurrent requests with `limit`, `remaining`, reset/window information where known, `observed_at`, source, capacity scope, and confidence. Capacity scope is separate from provenance: `free`, `account`, or `unknown`. An observed account limit is never automatically reclassified as free quota.

Source preference is exact account API > response headers > SwitchRoute counters > catalog > unknown. Slice 2 does not poll account APIs on every request. The model supports Exact data, but no hosted provider account/quota API is currently polled on the live request path; a secret-aware cached refresh path is required before adding those integrations safely.

### Provider observation support

SwitchRoute only whitelists routing-relevant headers; arbitrary response headers are discarded.

| Provider | Account/quota API in Slice 2 | Safe header parser |
| --- | --- | --- |
| OpenAI | None | OpenAI-style request/token/day limit, remaining, reset names when surfaced |
| Anthropic | None | `anthropic-ratelimit-requests-*` and `anthropic-ratelimit-tokens-*` |
| Gemini | None | OpenAI-style names only if the LiteLLM response exposes equivalent headers; otherwise counters/unknown |
| xAI | None | OpenAI-style names when exposed |
| Mistral | None | OpenAI-style names when exposed |
| DeepSeek | None | OpenAI-style names when exposed |
| Cohere | None | OpenAI-style names when exposed |
| Groq | None | OpenAI-style names when exposed |
| Cerebras | None | OpenAI-style names when exposed |
| NVIDIA NIM | None | OpenAI-style names when exposed |
| SambaNova | None | OpenAI-style names when exposed |
| Together AI | None | OpenAI-style names when exposed |
| Fireworks AI | None | OpenAI-style names when exposed |
| DeepInfra | None | OpenAI-style names when exposed |
| OpenRouter | None | Only the whitelisted OpenAI-style names are parsed; unrelated credit headers are not reinterpreted as request quota |
| Hugging Face Inference Providers | None | OpenAI-style names when exposed |
| Custom OpenAI-compatible | None | Same whitelist when the custom endpoint emits the standard names |

Quota detection quality therefore depends on what each upstream exposes. Absence of a header remains unknown, not unlimited. Generic observed headers have `account`/`unknown` capacity scope and do not prove that a `free_capable` model is currently free.

## Redis hot state

Set `REDIS_URL` to any standard Redis-compatible endpoint. Routing code uses a `RoutingState` abstraction and is not coupled to a managed Redis vendor.

Hot keys hold only operational data: quota snapshots, expiring reservations, daily budget reservations/spend, circuit state, failure counts, and EWMA latency/TTFT. No prompt/response or credentials enter Redis.

Capacity reservations use Redis lease locks plus transactional pipelines. Active reservations are stored in expiry-scored sorted sets, so expired leases stop consuming capacity even if a worker crashes. Route budget locking is acquired before target locking so concurrent requests on different paid targets cannot race a daily cap. Half-open circuits allow only one active probe reservation.

Local development with no `REDIS_URL` uses the deterministic in-process implementation. It is single-process by definition and is not a production substitute for cross-instance atomicity.

### Redis unavailable

If `REDIS_URL` was configured but Redis cannot be reached, the gateway starts in degraded routing-state mode instead of silently replacing distributed state with per-instance memory. Advanced strategies deterministically degrade to Priority. Unknown state is never interpreted as unlimited. Paid requests with a daily cap are not allowed when the distributed budget reservation cannot be enforced. The product UI reports routing-state safe mode.

## Health and circuits

Credential validity remains separate from transient provider/model health.

- provider 401/403: `provider_auth_error`; the connection is marked attention-required and is not put into a temporary retry loop.
- 429: `provider_rate_limited`; transient circuit signal.
- timeout: `provider_timeout`; transient circuit signal.
- upstream unavailable/5xx: `provider_unavailable`; transient circuit signal.

Circuits are scoped by provider connection + model. Three consecutive transient failures open a circuit for 30 seconds. After cooldown it becomes half-open for one probe; success closes/resets it, while another transient failure reopens it.

## Latency and cost

Full request latency uses an EWMA with alpha 0.25. Streaming TTFT is measured separately from request start to the first output-bearing event and has its own EWMA. Fastest ranks by full-request EWMA so TTFT is never silently substituted for end-to-end latency.

Known model prices from Slice 1.8 are applied to estimated/observed input and output tokens. `estimated_cost_microusd` remains null when price or usable token information is unknown.

## Sanitized decision metadata

`request_usage.routing_decision` is limited to 16 KiB. It can include requested/effective strategy, selected provider/model, whether it routed as paid, safe reason codes, bounded fallback path, bounded exclusions, quota source/confidence, free-capacity confirmation, circuit state, and latency confidence.

It cannot contain request content, response content, system prompts, tool contents, uploads, provider keys, authorization headers, raw provider bodies, or arbitrary upstream headers.
