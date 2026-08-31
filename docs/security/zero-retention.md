# Zero prompt retention

SwitchRoute does not persist prompts or completions.

Allowed request metadata: request ID, workspace, route, virtual-key ID, provider connection/kind, model ID, token counts, latency, status, estimated cost when known, fallback count, timestamps, and normalized error category.

Forbidden persistence/logging: messages, system prompts, response text, tool arguments/results, uploaded content, raw Authorization headers, provider credentials, and arbitrary upstream error bodies.

Application exceptions are mapped to a small normalized error model before logging. Access logs contain method/path/status only.
