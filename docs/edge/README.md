# SwitchRoute Edge

SwitchRoute Edge is the local request plane for local models and optional hosted SwitchRoute fallback.

```text
Local application
  -> http://127.0.0.1:8787/v1
  -> sr_edge_* authentication
  -> Edge Route
      -> local runtime/model
      -> local runtime/model
      -> SwitchRoute Cloud Route (optional)
          -> existing hosted Smart Routing
```

The hosted gateway never initiates a request to Edge or a user's localhost. Slice 3 contains no reverse tunnel, relay, ngrok/Cloudflare Tunnel integration, LAN scan, or public localhost exposure.

## Development build

Edge is built manually in Slice 3. Packaging/installers belong to Slice 4.

```powershell
cd crates\switchroute-edge
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build
cargo run -- start
```

The daemon binds to `127.0.0.1:8787` by default. Slice 3 rejects non-loopback daemon binds. Stop a foreground daemon with `Ctrl+C`.

On first start, when no local API key exists, Edge creates a 256-bit `sr_edge_...` key and prints it once. Only its SHA-256 hash and a short prefix are stored in SQLite.

## CLI

```text
switchroute-edge start
switchroute-edge status
switchroute-edge providers
switchroute-edge models
switchroute-edge routes
switchroute-edge doctor
switchroute-edge key create --name "Local dev"
switchroute-edge runtime add <kind> <url>
switchroute-edge runtime refresh
switchroute-edge route create <name> <slug> --strategy local_first --default
switchroute-edge route add-local <route> <runtime-id> <model-id> <position>
switchroute-edge route add-cloud <route> <base-url> <cloud-route> <position>
switchroute-edge route target <target-id> <true|false>
```

Runtime/cloud credentials are read from environment variables when configured and copied into the operating-system credential store. Do not put secrets directly in command arguments.

## OpenAI-compatible use

```python
from openai import OpenAI

client = OpenAI(
    api_key="sr_edge_...",
    base_url="http://127.0.0.1:8787/v1",
)

stream = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain this function."}],
    stream=True,
)

for chunk in stream:
    if chunk.choices and chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

`model="auto"` resolves the default enabled Edge Route. An enabled Edge Route slug may also be supplied directly.

## Persistence

Edge uses SQLite in the platform-local application data directory. It persists only:

- runtime connections and non-secret URLs;
- discovered model metadata/cache;
- Routes and ordered targets;
- hashed Edge API keys;
- bounded sanitized request Activity;
- settings required by the daemon.

Runtime credentials and hosted SwitchRoute fallback keys live in the OS credential store through the Edge secret-store abstraction. SQLite stores only secret references.

Prompts, completions, system prompts, tool contents, uploads, Authorization headers, and raw provider responses are never persisted.

## Routing semantics

Slice 3 implements the subset of routing for which local evidence is reliable:

- `Priority`: enabled healthy targets in configured order.
- `Local First`: eligible local targets before hosted cloud targets, preserving order within each group.
- `Free First`: confirmed zero-API-cost local models first, then other targets.

An Ollama model reported as remote/cloud is not classified as a free local model.

For streaming, Edge buffers upstream SSE until an output-bearing event is observed. A failed/empty target can be replaced before that point. Once content, tool output, function output, or reasoning content has begun, Edge commits to that target and never splices another provider into the stream.

## Cloud fallback

A cloud target stores only:

- the hosted SwitchRoute API base URL;
- the hosted SwitchRoute Route slug;
- a reference to one `sr_live_*`/`sr_test_*` credential in the OS credential store.

OpenAI, Gemini, Groq, Anthropic, or other provider credentials stay in the hosted encrypted secret store. Edge never downloads or decrypts them.

See `docs/edge/runtimes.md` for runtime-specific behavior and `docs/edge/security.md` for the trust boundary.
