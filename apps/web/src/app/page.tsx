import Link from "next/link";
import { Brand } from "@/components/brand";

const python = `from openai import OpenAI

client = OpenAI(
    api_key="sr_live_...",
    base_url="https://api.switchroute.dawnlightlabs.com/v1"
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello"}]
)`;

export default function LandingPage() {
  return (
    <main>
      <div className="sr-shell marketing-nav">
        <Brand />
        <div className="sr-row">
          <Link href="/docs/getting-started">Docs</Link>
          <Link className="sr-button" href="/login">Start routing</Link>
        </div>
      </div>

      <section className="sr-shell hero">
        <p className="sr-kicker">Dawnlight Labs / Cloud routing</p>
        <h1 className="sr-title">ONE KEY. EVERY MODEL <strong>YOU ALREADY HAVE.</strong></h1>
        <p className="sr-subtitle">Connect your free, paid and custom AI providers once. Build a Route, keep standard OpenAI code, and let SwitchRoute choose from the capacity you already have.</p>
        <div className="hero-actions">
          <Link className="sr-button" href="/login">Create your Route</Link>
          <Link className="sr-button sr-button-secondary" href="/docs/getting-started">Read the quick start</Link>
        </div>
      </section>

      <div className="sr-shell provider-strip" aria-label="Initial provider support">
        <div>GROQ</div><div>GEMINI</div><div>OPENROUTER</div>
      </div>

      <section className="marketing-section">
        <div className="sr-shell marketing-grid">
          <div><p className="sr-kicker">Less provider glue</p><h2>Your providers stop leaking into your app.</h2></div>
          <div className="compare">
            <div><span className="sr-kicker">Before</span><p>Different keys, model IDs, fallback code, provider dashboards and integration paths.</p></div>
            <div className="sr-panel-paper"><span className="sr-kicker">After</span><p><strong>One base URL. One route-bound key.</strong><br />Your application asks for <span className="sr-mono">model=&quot;auto&quot;</span>.</p></div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="sr-shell marketing-grid">
          <div><p className="sr-kicker">Routes, not workflows</p><h2>One request. One target. Ordered fallback.</h2><p className="sr-subtitle">A Route is a small priority stack, not an agent graph. SwitchRoute can prefer free-capable targets and move on only when a target fails before streaming begins.</p></div>
          <div className="route-demo">
            <div className="route-demo-head sr-between"><strong>CODING</strong><span className="sr-badge">FREE FIRST</span></div>
            <div className="route-demo-row"><span>☰</span><div><strong>Groq / Qwen</strong><br /><small>Free-capable · healthy</small></div><span className="sr-status sr-status-success" /></div>
            <div className="route-demo-row"><span>☰</span><div><strong>Gemini Flash</strong><br /><small>Free-capable · healthy</small></div><span className="sr-status sr-status-success" /></div>
            <div className="route-demo-row"><span>☰</span><div><strong>OpenRouter fallback</strong><br /><small>Paid only when you allow it</small></div><span className="sr-status sr-status-success" /></div>
          </div>
        </div>
      </section>

      <section className="marketing-section">
        <div className="sr-shell marketing-grid">
          <div><p className="sr-kicker">Zero prompt retention</p><h2>Routing metadata, not your conversations.</h2><p className="sr-subtitle">SwitchRoute stores operational metadata needed to route and diagnose requests. Prompts, completions, system prompts and tool contents are not persisted.</p></div>
          <pre className="sr-code"><code>{python}</code></pre>
        </div>
      </section>

      <section className="marketing-section">
        <div className="sr-shell sr-between">
          <div><p className="sr-kicker">Free first. Paid only when you allow it.</p><h2 style={{ margin: 0 }}>Use what you already have.</h2></div>
          <Link className="sr-button" href="/login">Connect a provider</Link>
        </div>
      </section>

      <footer className="sr-shell marketing-footer"><span>SwitchRoute · Dawnlight Labs</span><span>Built for interoperable AI access.</span></footer>
    </main>
  );
}
