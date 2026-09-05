# Edge security boundary

SwitchRoute Edge is trusted local software, but loopback is not treated as authentication.

## Network boundary

- The daemon defaults to `127.0.0.1:8787`.
- Slice 3 rejects non-loopback daemon binds.
- Automatic runtime discovery probes only documented/common loopback endpoints.
- Edge never scans the LAN.
- Manual runtime connections may point at localhost, private IPs, or an explicitly selected LAN server because the connection originates from the user's own machine.
- The hosted SwitchRoute gateway never calls Edge or a user's localhost.
- Slice 3 contains no reverse tunnel, relay, public proxy, arbitrary hosted-to-local RPC, or remote inference channel.

## Authentication and secrets

Every OpenAI-compatible Edge request requires an `sr_edge_...` key. Keys contain 256 bits of random material, are shown once, and are persisted only as a prefix plus SHA-256 hash.

Runtime credentials and hosted SwitchRoute fallback credentials are stored through the OS credential-store abstraction (Windows Credential Manager, macOS Keychain, or the platform keyring/Secret Service implementation available through the Rust keyring backend). SQLite stores only references to those secrets.

Hosted provider credentials remain in the existing hosted encrypted provider credential store. Edge never requests OpenAI/Gemini/Groq/Anthropic/etc. provider secrets from SwitchRoute.

## Zero content retention

The local database has no prompt/completion/system-prompt/tool/upload columns. Activity stores only bounded operational metadata:

- request ID;
- Edge Route ID;
- runtime/cloud target label;
- model/Route identifier;
- local/cloud origin;
- latency and TTFT when available;
- fallback count/path;
- status and safe error category;
- timestamp.

Request bodies, response bodies, raw SSE, Authorization headers, and raw upstream errors are not written to SQLite or tracing logs.

## Streaming fallback

Edge may retry another target only before an output-bearing event is observed. Role-only/metadata SSE events do not commit the route. Once content, tool/function output, or reasoning content begins, the target is committed for that response. Later failure terminates that stream; Edge never appends a second model's output.

## Hosted custom-provider policy remains separate

Edge's manual local endpoint policy does not modify the hosted `custom_openai` validation path. Hosted custom endpoints continue to require public HTTPS destinations and continue to reject localhost/private/link-local/non-global destinations. DNS-rebinding-resistant socket pinning remains a Slice 4 hosted hardening item.

## Pairing

Slice 3 deliberately does not introduce an `edge_devices` schema or dashboard pairing control. A secure pairing protocol would require an outbound-authenticated presence/session design with a sharply constrained message schema. Adding UI or database rows without that protocol would imply a capability that does not exist. No remote inference tunnel is required for local Edge usage.
