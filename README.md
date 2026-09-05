# SwitchRoute

> **One key. Every model you already have.**

SwitchRoute connects hosted and local model runtimes into reusable Routes and exposes a stable OpenAI-compatible API.

## What ships

Hosted:

- 17 hosted provider connection types
- OpenAI-compatible `POST /v1/chat/completions` and `GET /v1/models`
- Priority, Free First, Quota Aware, Fastest, Cheapest, and Balanced routing
- paid fallback controls and daily paid caps
- Redis-backed health, quota/capacity, reservation, and circuit state
- encrypted provider credentials
- route-bound `sr_live_...` / `sr_test_...` virtual keys
- content-free Activity and structured observability
- zero prompt/response retention

Edge:

- Rust local daemon for Windows, Linux, and macOS
- Ollama, LM Studio, vLLM, llama.cpp, SGLang, LocalAI, FreeToken, and custom local OpenAI-compatible runtimes
- Priority, Local First, and Free First
- explicit local → hosted fallback
- local API keys and OS credential-store integration

Developer ecosystem:

- `switchroute` Python SDK
- `@switchroute/sdk` TypeScript SDK
- standard OpenAI Python/JavaScript SDK compatibility
- raw REST/cURL/PowerShell/fetch/httpx usage
- generated OpenAPI 3.1 contract

## Hosted providers

- **Direct:** OpenAI, Anthropic, Google Gemini, xAI, Mistral AI, DeepSeek, Cohere
- **Inference:** Groq, Cerebras, NVIDIA NIM, SambaNova, Together AI, Fireworks AI, DeepInfra
- **Gateways/custom:** OpenRouter, Hugging Face Inference Providers, custom OpenAI-compatible public HTTPS endpoints

Provider metadata is evidence-based. Unknown price is not free, unknown quota is not unlimited, and unknown latency does not automatically win.

Custom hosted endpoints are HTTPS-only and use DNS-rebinding-resistant public-address validation/pinning. Local model endpoints belong to Edge; the hosted product does not create a reverse tunnel into a user's machine.

## Five-minute request

After connecting a provider, creating a Route, and generating a SwitchRoute key:

```python
from openai import OpenAI

client = OpenAI(
    api_key="sr_live_...",
    base_url="https://api.switchroute.dawnlightlabs.com/v1",
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}],
)
```

See the product docs under `apps/web/src/app/docs` for provider guides, routing semantics, Edge, SDKs, security, and operations.

## Repository

```text
apps/web/               Next.js product, auth, landing page and docs
services/gateway/       FastAPI hosted gateway and management API
crates/switchroute-edge/Rust local router/daemon
sdk/python/             switchroute Python SDK
sdk/javascript/         @switchroute/sdk TypeScript SDK
packages/api-contract/  Generated OpenAPI 3.1 contract
supabase/               Migration-managed Postgres schema and pgTAP/RLS tests
docs/                   Architecture, security and operations runbooks
tests/load/             k6 reliability/load scenarios
scripts/                Contract, privacy and release checks
```

## Local development

Normal hosted-Supabase development uses Node.js 22+ and Python 3.12+. Redis is optional for deterministic single-process development and required when testing distributed routing state. Docker Desktop and the Supabase CLI are needed for the full local database test path.

See `docs/development/local-windows.md` for the PowerShell workflow.

## Release version

`VERSION` is the release source of truth for the gateway and SDK package metadata. Edge embeds the same version at build time. Release workflows validate tags against this value before publishing artifacts.

## Production targets

- Web: `switchroute.dawnlightlabs.com`
- Gateway: `api.switchroute.dawnlightlabs.com`

Production promotion is separate from branch development and should happen only after preview verification and release review.

## License

**No software license has been selected.** Do not infer MIT, Apache, GPL, or another license from dependencies, examples, or package metadata. A license will be added only after an explicit project decision.
