import Link from "next/link";

const groups = [
  ["Start", [["/docs/getting-started", "Getting Started"], ["/docs/core-concepts", "Core concepts"]]],
  ["Build", [["/docs/providers", "Providers"], ["/docs/routes", "Routes"], ["/docs/api-keys", "API keys"], ["/docs/openai-sdk", "OpenAI SDK"]]],
  ["Examples", [["/docs/javascript", "JavaScript"], ["/docs/python", "Python"], ["/docs/curl", "cURL"]]],
  ["Provider guides", [["/docs/groq", "Groq"], ["/docs/gemini", "Gemini"], ["/docs/openrouter", "OpenRouter"], ["/docs/custom-providers", "Custom providers"]]],
  ["Reference", [["/docs/security", "Security"], ["/docs/api-errors", "API errors"], ["/docs/development", "Development"]]],
] as const;

export function DocsNav() {
  return <nav className="docs-nav" aria-label="Documentation">{groups.map(([label, links]) => <div key={label} className="docs-nav-group"><strong>{label}</strong>{links.map(([href, title]) => <Link key={href} href={href}>{title}</Link>)}</div>)}</nav>;
}
