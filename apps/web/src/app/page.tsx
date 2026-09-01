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

const flow = [
  ["01", "Connect", "Add Groq, Gemini or OpenRouter and validate the key before it is stored."],
  ["02", "Route", "Put provider/model targets in the exact fallback order you want."],
  ["03", "Key", "Generate one route-bound SwitchRoute key for live or test traffic."],
  ["04", "Ship", "Keep standard OpenAI client code and use model=\"auto\"."],
] as const;

export default function LandingPage() {
  return (
    <main className="marketing-page">
      <div className="sr-shell marketing-nav">
        <Brand />
        <div className="marketing-nav-links">
          <Link href="/docs/getting-started">Docs</Link>
          <Link href="/login">Sign in</Link>
          <Link className="sr-button" href="/login">Start routing</Link>
        </div>
      </div>

      <section className="sr-shell hero">
        <div className="hero-copy">
          <p className="sr-kicker hero-kicker">MULTI-PROVIDER CONTROL PLANE</p>
          <h1 className="sr-title">
            <span>YOUR APP</span>
            <span>CALLS <strong>ONE.</strong></span>
            <span>WE ROUTE THE REST.</span>
          </h1>
          <p className="sr-subtitle">Connect the AI providers you already use, order them into a Route, and expose one OpenAI-compatible endpoint to your application.</p>
          <div className="hero-actions">
            <Link className="sr-button" href="/login">Create a Route</Link>
            <Link className="sr-text-link" href="/docs/getting-started">Read the 5-minute setup →</Link>
          </div>
        </div>
        <div className="hero-route" aria-label="Example SwitchRoute priority stack">
          <div className="hero-route-head"><span>ROUTE / CODING</span><span>READY</span></div>
          <div className="hero-route-target"><span>01</span><div><strong>Groq</strong><small>qwen / free-capable</small></div><i className="sr-status sr-status-success" /></div>
          <div className="hero-route-target"><span>02</span><div><strong>Gemini</strong><small>flash / free-capable</small></div><i className="sr-status sr-status-success" /></div>
          <div className="hero-route-target"><span>03</span><div><strong>OpenRouter</strong><small>fallback / paid allowed</small></div><i className="sr-status sr-status-success" /></div>
          <div className="hero-route-foot"><span>POST /v1/chat/completions</span><strong>model = auto</strong></div>
        </div>
      </section>

      <div className="type-ribbon" aria-hidden="true"><span>CONNECT / ROUTE / SWITCH / SHIP /</span></div>

      <section className="marketing-section flow-section">
        <div className="sr-shell">
          <div className="section-heading"><p className="sr-kicker">THE WHOLE PRODUCT</p><h2>Four moves. No provider glue in your app.</h2></div>
          <div className="flow-list">
            {flow.map(([index, title, body]) => <div className="flow-row" key={index}><span>{index}</span><h3>{title}</h3><p>{body}</p></div>)}
          </div>
        </div>
      </section>

      <section className="marketing-section sticky-story">
        <div className="sr-shell sticky-story-grid">
          <div className="sticky-word" aria-hidden="true">ROUTE</div>
          <div className="story-copy">
            <p className="sr-kicker">ORDERED FALLBACK</p>
            <h2>A priority stack, not a workflow graph.</h2>
            <p className="sr-subtitle">Each request goes to one provider/model target. If that target fails before output begins, SwitchRoute can move to the next. Nothing is blended and no model output is chained into another.</p>
            <div className="story-rule"><span>01</span><strong>Prefer free-capable capacity</strong></div>
            <div className="story-rule"><span>02</span><strong>Respect your exact order</strong></div>
            <div className="story-rule"><span>03</span><strong>Fallback before streaming only</strong></div>
          </div>
        </div>
      </section>

      <section className="marketing-section code-section">
        <div className="sr-shell marketing-grid">
          <div>
            <p className="sr-kicker">KEEP YOUR CLIENT</p>
            <h2>Change the base URL. Keep the OpenAI shape.</h2>
            <p className="sr-subtitle">The provider choice moves out of application code and into a Route you can manage without redeploying the app.</p>
          </div>
          <pre className="sr-code"><code>{python}</code></pre>
        </div>
      </section>

      <section className="marketing-section privacy-section">
        <div className="sr-shell privacy-grid">
          <div><p className="sr-kicker">ZERO CONTENT RETENTION</p><h2>We need routing metadata. Not your conversations.</h2></div>
          <p>SwitchRoute stores operational metadata needed for routing, health and diagnosis. Prompts, completions, system prompts, tool contents and uploads are not persisted.</p>
        </div>
      </section>

      <section className="sr-shell marketing-cta">
        <p className="sr-kicker">READY WHEN YOUR FIRST PROVIDER IS</p>
        <h2>One provider is enough to start.<br />Add fallback later.</h2>
        <Link className="sr-button" href="/login">Open SwitchRoute</Link>
      </section>

      <footer className="sr-shell marketing-footer"><span>SwitchRoute · Dawnlight Labs</span><span>OpenAI-compatible routing for the providers you already use.</span></footer>
    </main>
  );
}
