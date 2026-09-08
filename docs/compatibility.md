# Compatibility matrix

Release source of truth: `VERSION`.

| Surface | Support |
| --- | --- |
| `POST /v1/chat/completions` | Hosted gateway + Edge |
| streaming chat completions | Hosted gateway + Edge |
| `GET /v1/models` | Hosted gateway + Edge |
| OpenAI Python SDK custom base URL | CI compatibility check |
| OpenAI JavaScript SDK custom base URL | CI compatibility check |
| `switchroute` Python SDK | 0.4.x release candidate |
| `@switchroute/sdk` | 0.4.x release candidate |
| `/v1/responses` | Not implemented |

Hosted routing strategies: Priority, Free First, Quota Aware, Fastest, Cheapest, Balanced.

Edge routing strategies: Priority, Local First, Free First.

Edge runtime support: Ollama, LM Studio, vLLM, llama.cpp, SGLang, LocalAI, FreeToken, custom OpenAI-compatible local endpoints.

Edge release targets: Windows x64, Linux x64, macOS arm64, and macOS x64 when the native release workflow passes.
