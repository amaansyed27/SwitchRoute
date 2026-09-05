# SwitchRoute Edge Agent Guide

Follow the repository root `AGENTS.md` first. This guide scopes `crates/switchroute-edge`.

- Edge is a local request plane. Never add a hosted gateway -> localhost tunnel, reverse proxy, LAN scan, or public bind as part of Slice 3.
- Default and currently permitted daemon binds are loopback only (`127.0.0.1` / `::1`).
- Keep runtime-specific discovery in `providers`; routing/fallback in `routing`; SQLite access in `persistence`; credentials in `secrets`; HTTP surface in `api`.
- Runtime adapters may use native APIs for discovery/health but should use stable OpenAI-compatible chat endpoints where available.
- Fallback is allowed only before an output-bearing stream event. Never splice providers after content/tool output starts.
- Never persist or log prompt, completion, system-prompt, tool, upload, Authorization-header, or raw provider-response content.
- Local API keys are high entropy and hash-only at rest. Runtime/cloud secrets belong in the OS credential store behind `SecretStore`.
- Tests must use mock HTTP runtimes; no model downloads or GPU dependencies in CI.
