import Link from "next/link";

const groups = [
  [
    "Start",
    [
      ["/docs/getting-started", "Getting started"],
      ["/docs/core-concepts", "Core concepts"],
      ["/docs/compatibility", "Compatibility"],
    ],
  ],
  [
    "Build",
    [
      ["/docs/providers", "Providers"],
      ["/docs/routes", "Routes & strategies"],
      ["/docs/api-keys", "API keys"],
      ["/docs/edge", "Edge / Local"],
    ],
  ],
  [
    "API & SDKs",
    [
      ["/docs/api", "API / REST"],
      ["/docs/openai-sdk", "OpenAI SDK"],
      ["/docs/python", "Python SDK"],
      ["/docs/javascript", "JavaScript SDK"],
      ["/docs/api-errors", "Errors"],
    ],
  ],
  [
    "Provider guides",
    [
      ["/docs/providers/openai", "OpenAI"],
      ["/docs/providers/anthropic", "Anthropic"],
      ["/docs/providers/gemini", "Gemini"],
      ["/docs/providers/xai", "xAI"],
      ["/docs/providers/mistral", "Mistral"],
      ["/docs/providers/deepseek", "DeepSeek"],
      ["/docs/providers/cohere", "Cohere"],
      ["/docs/providers/groq", "Groq"],
      ["/docs/providers/cerebras", "Cerebras"],
      ["/docs/providers/nvidia-nim", "NVIDIA NIM"],
      ["/docs/providers/sambanova", "SambaNova"],
      ["/docs/providers/together", "Together"],
      ["/docs/providers/fireworks", "Fireworks"],
      ["/docs/providers/deepinfra", "DeepInfra"],
      ["/docs/providers/openrouter", "OpenRouter"],
      ["/docs/providers/huggingface", "Hugging Face"],
      ["/docs/providers/custom-openai", "Custom cloud"],
    ],
  ],
  [
    "Operations",
    [
      ["/docs/security", "Security & privacy"],
      ["/docs/operations", "Operations"],
      ["/docs/development", "Development"],
    ],
  ],
] as const;

export function DocsNav() {
  return (
    <nav className="space-y-5" aria-label="Documentation">
      {groups.map(([label, links]) => (
        <div key={label}>
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted-foreground)]">
            {label}
          </p>
          <div className="space-y-0.5">
            {links.map(([href, title]) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              >
                {title}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
