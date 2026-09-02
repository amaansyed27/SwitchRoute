import Link from "next/link";

const groups = [
  ["Start", [["/docs/getting-started", "Getting started"], ["/docs/core-concepts", "Core concepts"]]],
  ["Build", [["/docs/providers", "Providers"], ["/docs/routes", "Waterfalls"], ["/docs/api-keys", "API keys"], ["/docs/openai-sdk", "OpenAI SDK"]]],
  ["Examples", [["/docs/javascript", "JavaScript"], ["/docs/python", "Python"], ["/docs/curl", "cURL"]]],
  ["Provider guides", [["/docs/groq", "Groq"], ["/docs/gemini", "Gemini"], ["/docs/openrouter", "OpenRouter"]]],
  ["Reference", [["/docs/security", "Security"], ["/docs/api-errors", "API errors"], ["/docs/development", "Development"]]],
] as const;

export function DocsNav() {
  return <nav className="space-y-5" aria-label="Documentation">{groups.map(([label, links]) => <div key={label}><p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted-foreground)]">{label}</p><div className="space-y-0.5">{links.map(([href, title]) => <Link key={href} href={href} className="block rounded-lg px-2 py-1.5 text-xs text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">{title}</Link>)}</div></div>)}</nav>;
}
