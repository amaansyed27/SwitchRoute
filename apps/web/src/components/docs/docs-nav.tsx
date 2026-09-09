"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  [
    "Start",
    [
      ["/docs", "Welcome"],
      ["/docs/getting-started", "Quickstart"],
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

export function DocsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const visible = groups.map(([label, links]) => ({ label, links: links.filter(([, title]) => `${label} ${title}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(group => group.links.length);
  return <div className="docs-navigation">
    <label className="docs-filter"><span className="sr-only">Find a guide</span><input type="search" placeholder="Find a guide…" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <nav aria-label="Documentation">{visible.map(({label, links}) => <section key={label}><h2>{label}</h2><ul>{links.map(([href,title]) => <li key={href}><Link href={href} aria-current={pathname === href ? "page" : undefined} onClick={onNavigate}>{title}</Link></li>)}</ul></section>)}</nav>
    {!visible.length && <p className="docs-no-results" role="status">No guides match “{query}”.</p>}
  </div>;
}
