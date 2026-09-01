import Link from "next/link";
import { Brand } from "@/components/brand";
import { IntegrationPanel } from "@/components/marketing/integration-panel";
import { RouterVisual } from "@/components/marketing/router-visual";

const providerRail = ["Groq", "Gemini", "OpenRouter", "Priority routes", "Free first", "OpenAI-compatible"];

export default function LandingPage() {
  return (
    <main className="sr-site-v2">
      <header className="sr-shell sr-v2-nav">
        <Brand />
        <nav aria-label="Primary navigation">
          <Link href="/docs/getting-started">Docs</Link>
          <Link href="/login">Sign in</Link>
          <Link className="sr-v2-nav-cta" href="/login">Start routing</Link>
        </nav>
      </header>

      <section className="sr-v2-hero" aria-labelledby="sr-v2-title">
        <div className="sr-shell sr-v2-hero-inner">
          <div className="sr-v2-hero-copy">
            <p className="sr-kicker">MULTI-PROVIDER ROUTING / ONE OPENAI-COMPATIBLE API</p>
            <h1 id="sr-v2-title">
              <span>One endpoint.</span>
              <span>A whole Route</span>
              <span className="sr-v2-hero-accent">behind it.</span>
            </h1>
            <p className="sr-v2-hero-lede">
              Connect the providers you already use. Put their models in order. SwitchRoute handles the fallback while your app keeps one client and one key.
            </p>
            <div className="sr-v2-hero-actions">
              <Link className="sr-v2-primary" href="/login">Build your first Route</Link>
              <Link className="sr-v2-secondary" href="/docs/getting-started">Read the 5-minute setup</Link>
            </div>
          </div>

          <div className="sr-v2-demo-wrap">
            <div className="sr-v2-orbit sr-v2-orbit-a" aria-hidden="true" />
            <div className="sr-v2-orbit sr-v2-orbit-b" aria-hidden="true" />
            <RouterVisual />
          </div>
        </div>
      </section>

      <section className="sr-v2-provider-band" aria-label="SwitchRoute capabilities and connected providers">
        <div className="sr-v2-provider-track">
          {[...providerRail, ...providerRail].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="sr-shell sr-v2-explainer">
        <div className="sr-v2-explainer-head">
          <p className="sr-kicker">THE ROUTE IS THE PRODUCT</p>
          <h2>Provider logic leaves your application code.</h2>
          <p>
            Your app talks to SwitchRoute. The Route decides which eligible provider/model target receives the request and what happens when that target is unavailable.
          </p>
        </div>

        <div className="sr-v2-route-story" aria-label="How a SwitchRoute request is handled">
          <article>
            <span>01</span>
            <div><strong>Connect</strong><p>Validate provider credentials and discover the models available to that account.</p></div>
          </article>
          <div className="sr-v2-story-line" aria-hidden="true"><i /></div>
          <article>
            <span>02</span>
            <div><strong>Order</strong><p>Put provider/model targets into the exact priority or free-first order you want.</p></div>
          </article>
          <div className="sr-v2-story-line" aria-hidden="true"><i /></div>
          <article>
            <span>03</span>
            <div><strong>Call</strong><p>Use one Route-bound API key and keep <code>{'model="auto"'}</code> in your client.</p></div>
          </article>
        </div>
      </section>

      <section className="sr-v2-switch-stage">
        <div className="sr-shell sr-v2-switch-inner">
          <div className="sr-v2-switch-copy">
            <p className="sr-kicker">CHANGE THE ROUTE, NOT THE APP</p>
            <h2>
              <span>Move a model.</span>
              <span>Change a fallback.</span>
              <span className="sr-v2-switch-muted">Ship no client patch.</span>
            </h2>
          </div>

          <div className="sr-v2-strategy-visual" aria-label="Route strategies">
            <div className="sr-v2-strategy-label">ROUTE / production</div>
            <div className="sr-v2-strategy-card sr-v2-strategy-card-main">
              <span>Priority</span>
              <strong>01 → 02 → 03</strong>
              <small>Use the first eligible target, then fall back in order.</small>
            </div>
            <div className="sr-v2-strategy-card sr-v2-strategy-card-float">
              <span>Free first</span>
              <strong>limits before spend</strong>
              <small>Prefer free-capable targets while they are eligible.</small>
            </div>
            <div className="sr-v2-strategy-signal" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="sr-shell sr-v2-integration">
        <IntegrationPanel />
      </section>

      <section className="sr-v2-privacy">
        <div className="sr-shell sr-v2-privacy-inner">
          <div>
            <p className="sr-kicker">ZERO CONTENT RETENTION</p>
            <h2>Your routing layer does not need your conversations.</h2>
          </div>
          <div className="sr-v2-privacy-copy">
            <p>
              SwitchRoute keeps the operational metadata needed for routing, health and diagnosis. Prompts, completions, system prompts, tool contents and uploads are not persisted.
            </p>
            <Link href="/docs/security">Read the security model →</Link>
          </div>
        </div>
      </section>

      <section className="sr-v2-final">
        <div className="sr-shell sr-v2-final-inner">
          <p className="sr-kicker">START WITH ONE PROVIDER</p>
          <h2>Build the Route now.<br /><span>Add the rest when you need them.</span></h2>
          <Link className="sr-v2-primary sr-v2-primary-light" href="/login">Open SwitchRoute</Link>
        </div>
      </section>

      <footer className="sr-v2-footer">
        <div className="sr-shell sr-v2-footer-inner">
          <Brand />
          <span>Dawnlight Labs</span>
          <div><Link href="/docs/getting-started">Docs</Link><Link href="/login">Sign in</Link></div>
        </div>
      </footer>
    </main>
  );
}
