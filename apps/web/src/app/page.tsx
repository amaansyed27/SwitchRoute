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

const routeTargets = [
  ["01", "Groq", "qwen/qwen3-32b", "free-capable"],
  ["02", "Gemini", "gemini-2.5-flash", "free-capable"],
  ["03", "OpenRouter", "fallback", "paid allowed"],
] as const;

const flow = [
  ["01", "Connect", "Add a provider key, validate it, and discover the models available to that account."],
  ["02", "Order", "Build one Route by placing provider/model targets in the fallback order you actually want."],
  ["03", "Key", "Generate a live or test key bound to that Route. The secret is shown once."],
  ["04", "Call", "Point your OpenAI-compatible client at SwitchRoute and keep model=\"auto\"."],
] as const;

export default function LandingPage() {
  return (
    <main className="marketing-page first-light-marketing">
      <header className="sr-shell marketing-nav first-light-nav">
        <Brand />
        <nav className="marketing-nav-links" aria-label="Primary navigation">
          <Link href="/docs/getting-started">Docs</Link>
          <Link href="/login">Sign in</Link>
          <Link className="sr-button landing-nav-cta" href="/login">Start routing</Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-frame sr-shell">
          <div className="landing-hero-meta">
            <p className="sr-kicker">SWITCHROUTE / CONTROL PLANE</p>
            <p>OPENAI-COMPATIBLE · MULTI-PROVIDER</p>
          </div>

          <div className="landing-hero-copy">
            <h1 id="landing-title">
              <span className="landing-line">One API.</span>
              <span className="landing-line">Every model.</span>
              <span className="landing-line landing-line-accent">Your order.</span>
            </h1>
            <div className="landing-hero-intro">
              <p>Connect the providers you already use, arrange a Route, then send your application to one endpoint.</p>
              <div className="landing-hero-actions">
                <Link className="sr-button" href="/login">Create your first Route</Link>
                <Link className="sr-text-link" href="/docs/getting-started">5-minute setup ↗</Link>
              </div>
            </div>
          </div>

          <div className="landing-route-stage" aria-label="Example SwitchRoute priority route">
            <div className="landing-route-stage-head">
              <div><span>ROUTE</span><strong>coding</strong></div>
              <div><span>STRATEGY</span><strong>free first</strong></div>
              <div className="landing-route-ready"><i className="sr-status sr-status-success" /><strong>ready</strong></div>
            </div>
            <div className="landing-route-track" aria-hidden="true"><span /></div>
            <div className="landing-route-targets">
              {routeTargets.map(([index, provider, model, note]) => (
                <div className="landing-route-target" key={index}>
                  <span>{index}</span>
                  <div><strong>{provider}</strong><small>{model}</small></div>
                  <em>{note}</em>
                  <i className="sr-status sr-status-success" aria-hidden="true" />
                </div>
              ))}
            </div>
            <div className="landing-route-stage-foot">
              <span>POST /v1/chat/completions</span>
              <strong>model = auto</strong>
            </div>
          </div>

          <div className="landing-hero-progress" aria-hidden="true"><span /></div>
        </div>
      </section>

      <section className="landing-manifesto">
        <div className="sr-shell landing-manifesto-frame">
          <div className="landing-section-bar"><span>01 / WHY</span><span>PROVIDER CHOICE LEAVES YOUR APP</span></div>
          <h2>
            <span>Your providers.</span>
            <span>One routing layer.</span>
          </h2>
          <p>SwitchRoute keeps provider choice, fallback order and route health outside application code. Change the Route without changing the client.</p>
        </div>
      </section>

      <section className="landing-flow">
        <div className="sr-shell landing-flow-frame">
          <div className="landing-section-bar"><span>02 / SETUP</span><span>FOUR MOVES TO A WORKING REQUEST</span></div>
          <div className="landing-flow-heading">
            <p className="sr-kicker">FROM PROVIDER KEY TO API CALL</p>
            <h2>Routing should feel smaller than the problem it removes.</h2>
          </div>
          <div className="landing-flow-list">
            {flow.map(([index, title, body]) => (
              <article className="landing-flow-row" key={index}>
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-priority">
        <div className="sr-shell landing-priority-frame">
          <div className="landing-section-bar"><span>03 / ROUTES</span><span>ORDERED FALLBACK · NOT A NODE GRAPH</span></div>
          <div className="landing-priority-copy">
            <h2>Exactly one target at a time.</h2>
            <p>Each request starts with the first eligible target. If that target fails before output begins, SwitchRoute can move down the stack. No model output is blended or chained into another.</p>
          </div>
          <div className="landing-priority-sequence" aria-label="Route fallback sequence">
            <div><span>01</span><strong>Check eligibility</strong><small>health · limits · route strategy</small></div>
            <div><span>02</span><strong>Call target</strong><small>one provider / one model</small></div>
            <div><span>03</span><strong>Fallback if needed</strong><small>before streaming begins</small></div>
          </div>
        </div>
      </section>

      <section className="landing-code">
        <div className="sr-shell landing-code-frame">
          <div className="landing-section-bar"><span>04 / CLIENT</span><span>KEEP THE OPENAI SHAPE</span></div>
          <div className="landing-code-grid">
            <div className="landing-code-copy">
              <p className="sr-kicker">THE CLIENT STAYS FAMILIAR</p>
              <h2>Change the base URL. Move provider logic out.</h2>
              <p>Use your normal OpenAI-compatible client. The SwitchRoute key selects the Route; the Route decides where the request should go.</p>
            </div>
            <div className="landing-code-window">
              <div className="landing-code-window-head"><span>python</span><span>switchroute.py</span></div>
              <pre className="sr-code"><code>{python}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-privacy">
        <div className="sr-shell landing-privacy-frame">
          <div className="landing-section-bar"><span>05 / DATA</span><span>ZERO CONTENT RETENTION</span></div>
          <h2>Routing metadata, not your conversations.</h2>
          <p>SwitchRoute stores the operational metadata required for routing, health and diagnosis. Prompts, completions, system prompts, tool contents and uploads are not persisted.</p>
          <Link className="sr-text-link" href="/docs/security">Read the security model ↗</Link>
        </div>
      </section>

      <section className="landing-final">
        <div className="sr-shell landing-final-frame">
          <p className="sr-kicker">READY WHEN YOUR FIRST PROVIDER IS</p>
          <h2><span>Connect one.</span><span>Route the rest later.</span></h2>
          <Link className="sr-button" href="/login">Open SwitchRoute</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="sr-shell landing-footer-inner">
          <Brand />
          <span>Dawnlight Labs</span>
          <span>OpenAI-compatible multi-provider routing.</span>
        </div>
      </footer>
    </main>
  );
}
