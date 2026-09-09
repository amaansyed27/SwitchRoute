import Link from "next/link";

export const metadata = { title: "Documentation" };

export default function DocsPage() {
  return <>
    <p className="docs-eyebrow">Get started</p>
    <h1>SwitchRoute documentation</h1>
    <p className="docs-intro">One API for your AI providers. Connect accounts, arrange fallback models, and decide exactly when paid requests are allowed.</p>
    <Link href="/docs/getting-started" className="docs-quickstart"><span><strong>Make your first request</strong><span>From provider connection to a working API call.</span></span><span aria-hidden="true">→</span></Link>
    <h2>Build your routing layer</h2><p>Set up the pieces behind your application.</p>
    <div className="docs-card-grid">{[
      ["/docs/providers", "01", "Connect providers", "Bring your own accounts and discover their available models."],
      ["/docs/routes", "02", "Arrange waterfalls", "Set fallback order, choose a strategy, and control spending."],
      ["/docs/api-keys", "03", "Create an API key", "Give your application access to one configured Route."],
      ["/docs/edge", "04", "Run locally", "Route requests to local models with SwitchRoute Edge."],
    ].map(([href, number, title, description]) => <Link className="docs-guide-card" href={href} key={href}><span className="docs-card-number">{number}<span aria-hidden="true">↗</span></span><strong>{title}</strong><span>{description}</span></Link>)}</div>
    <h2>Use your preferred client</h2><p>Keep the OpenAI-compatible request shape. Change the endpoint and key.</p>
    <div className="docs-client-links"><Link href="/docs/openai-sdk">OpenAI SDK <span aria-hidden="true">→</span></Link><Link href="/docs/python">Python <span aria-hidden="true">→</span></Link><Link href="/docs/javascript">JavaScript & TypeScript <span aria-hidden="true">→</span></Link><Link href="/docs/api">HTTP API <span aria-hidden="true">→</span></Link></div>
    <h2>Understand the boundaries</h2><p>Read about <Link href="/docs/security">security and zero retention</Link>, <Link href="/docs/compatibility">API compatibility</Link>, and <Link href="/docs/operations">running SwitchRoute in production</Link>.</p>
  </>;
}
