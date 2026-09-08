# Edge runtime support

Runtime behavior is based on the runtime's current official API documentation. Automatic discovery probes only documented/common **loopback** endpoints. Edge never scans the LAN. A manually configured runtime may use localhost, a private address, or a user-specified LAN endpoint because the request originates from the user's own machine.

| Runtime | Automatic endpoint | Discovery | Invocation | Notes |
| --- | --- | --- | --- | --- |
| Ollama | `http://127.0.0.1:11434` | `/api/tags`, `/api/ps`, `/api/show` | `/v1/chat/completions` | First-class native metadata; preserves Ollama local vs remote/cloud provenance. |
| LM Studio | `http://127.0.0.1:1234` | `/api/v1/models` | `/v1/chat/completions` | Native model metadata where available. |
| vLLM | `http://127.0.0.1:8000` | `/v1/models` | `/v1/chat/completions` | OpenAI-compatible serving API. |
| llama.cpp / llama-server | `http://127.0.0.1:8080` | `/v1/models` | `/v1/chat/completions` | `/health` is used as the runtime fingerprint. |
| SGLang | `http://127.0.0.1:30000` | `/v1/models` | `/v1/chat/completions` | OpenAI-compatible server API. |
| LocalAI | `http://127.0.0.1:8080` | `/v1/models` | `/v1/chat/completions` | `/readyz` distinguishes LocalAI from llama.cpp on the shared common port. |
| FreeToken | `http://127.0.0.1:1919` | `/v1/models` | `/v1/chat/completions` | `ft serve` OpenAI-compatible server; `/health` is used for probing. |
| Custom local OpenAI-compatible | none | `/v1/models` | `/v1/chat/completions` | Manual URL only; supports localhost/private/LAN endpoints. |

## Ollama

Official documentation: <https://docs.ollama.com/api> and <https://docs.ollama.com/api/openai-compatibility>

1. **Detection:** Edge probes `GET /api/tags` on `127.0.0.1:11434`.
2. **Default endpoint:** `http://127.0.0.1:11434`.
3. **Manual configuration:** add an `ollama` runtime with the server root URL.
4. **Model discovery:** `/api/tags` supplies installed/available model summaries, `/api/ps` supplies running/loaded state and runtime context length, and `/api/show` supplies detailed model information/capabilities.
5. **Capabilities:** Edge preserves capabilities that Ollama itself reports. It does not infer tool or vision support from model names.
6. **Limitations:** metadata varies by Ollama/model version. `remote_model`/`remote_host` evidence is used to mark a model as cloud/remote; name-pattern guessing is not used.

## LM Studio

Official documentation: <https://lmstudio.ai/docs/developer/rest> and <https://lmstudio.ai/docs/developer/openai-compat>

1. **Detection:** Edge probes LM Studio's native model API on the common local server port.
2. **Default endpoint:** `http://127.0.0.1:1234`.
3. **Manual configuration:** add an `lmstudio` runtime with the LM Studio server root URL.
4. **Model discovery:** native `GET /api/v1/models` is preferred so loaded/context information can be retained when supplied.
5. **Capabilities:** chat is routed through the OpenAI-compatible Chat Completions API; only evidence returned by LM Studio is normalized.
6. **Limitations:** optional metadata depends on the LM Studio version and server configuration. Unknown context/capability fields remain unknown.

## vLLM

Official documentation: <https://docs.vllm.ai/en/latest/serving/openai_compatible_server/>

1. **Detection:** Edge probes `/v1/models` on the common vLLM local port.
2. **Default endpoint:** `http://127.0.0.1:8000`.
3. **Manual configuration:** add a `vllm` runtime with the server root or a URL ending in `/v1`.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** chat and SSE streaming use the OpenAI-compatible server directly.
6. **Limitations:** generic OpenAI model-list metadata does not always expose context size, hardware state, or modality support; Edge does not invent those values.

## llama.cpp / llama-server

Official documentation: <https://github.com/ggml-org/llama.cpp/tree/master/tools/server>

1. **Detection:** Edge probes `/health` on the common llama-server port.
2. **Default endpoint:** `http://127.0.0.1:8080`.
3. **Manual configuration:** add a `llamacpp` runtime with the llama-server root URL.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** OpenAI-compatible Chat Completions and SSE streaming are forwarded without an unnecessary protocol rewrite.
6. **Limitations:** llama.cpp and LocalAI commonly use port 8080. Edge uses their health fingerprints rather than registering both from a generic successful `/v1/models` response.

## SGLang

Official documentation: <https://docs.sglang.ai/basic_usage/openai_api_completions.html>

1. **Detection:** Edge probes `/v1/models` on the common SGLang server port.
2. **Default endpoint:** `http://127.0.0.1:30000`.
3. **Manual configuration:** add an `sglang` runtime with the server root or `/v1` URL.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** OpenAI-compatible chat and SSE streaming.
6. **Limitations:** model-list responses may not include hardware/loading/context metadata, so those fields remain unknown unless the runtime returns evidence.

## LocalAI

Official documentation: <https://localai.io/basics/getting_started/>

1. **Detection:** Edge probes `/readyz` on the common LocalAI port.
2. **Default endpoint:** `http://127.0.0.1:8080`.
3. **Manual configuration:** add a `localai` runtime with the LocalAI server root URL. When LocalAI authentication is enabled, provide the credential through an environment variable so Edge stores it in the OS credential store.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** OpenAI-compatible Chat Completions and streaming.
6. **Limitations:** authenticated deployments may protect health/model endpoints. Model-list metadata is backend-dependent and is normalized conservatively.

## FreeToken

Official project: <https://github.com/FlashML-org/FreeToken>

1. **Detection:** Edge probes `/health` on FreeToken's documented local serving port.
2. **Default endpoint:** `http://127.0.0.1:1919`.
3. **Manual configuration:** run `ft serve`, then add a `freetoken` runtime when using a non-default address.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** OpenAI-compatible chat and streaming.
6. **Limitations:** Edge treats the runtime as local only when its discovered model is served locally. It does not infer additional model capabilities not reported by the server.

## Custom local OpenAI-compatible endpoint

1. **Detection:** none; custom endpoints are intentionally manual to avoid local network scanning.
2. **Default endpoint:** none.
3. **Manual configuration:** add a `custom` runtime with an HTTP/HTTPS root or `/v1` URL. Loopback, private IP, and user-selected LAN addresses are valid for Edge.
4. **Model discovery:** `GET /v1/models`.
5. **Capabilities:** `POST /v1/chat/completions`, including SSE streaming, must be OpenAI-compatible.
6. **Limitations:** Edge cannot safely identify vendor-specific hardware/capability metadata through a generic OpenAI contract, so unknown fields remain unknown.

This local endpoint policy is intentionally different from hosted `custom_openai`: the hosted gateway continues to reject loopback/private/non-public destinations and is not modified by Edge.
