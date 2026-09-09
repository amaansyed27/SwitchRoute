import Link from "next/link";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonClass } from "@/components/ui/button";

export default function Home() {
  return <div className="site">
    <LandingExperience/>
    <header className="site-nav"><Brand/><nav aria-label="Main navigation"><Link href="/docs">Documentation</Link><Link href="/login">Sign in</Link><ThemeSwitcher compact/></nav></header>
    <main>
      <section className="site-hero">
        <div className="hero-caption"><span className="square-mark"/> INDEPENDENT AI ROUTING <span className="hidden sm:inline">/ CLOUD + LOCAL</span></div>
        <h1>Many models.<br/>One <span className="hero-underline">way in.</span></h1>
        <div className="hero-bottom"><p>Connect your AI providers. Put fallback, budgets, and model selection in one place. Keep your application code simple.</p><div className="hero-actions"><Link href="/login?mode=sign-up" className={buttonClass({size:"lg"})}>Create a workspace <span aria-hidden="true">↗</span></Link><Link href="/docs/getting-started" className="text-sm underline underline-offset-4">Start with the docs</Link></div></div>
      </section>
      <section data-reveal className="route-specimen" aria-label="Illustration of an ordered model waterfall">
        <div className="specimen-caption"><span>ONE REQUEST. MORE THAN ONE OPTION.</span><span>ILLUSTRATIVE ROUTE</span></div>
        <div className="specimen-flow"><div className="specimen-input"><span className="specimen-number">IN</span><h2>Your application</h2><code>POST /v1/chat/completions</code></div><span className="flow-arrow" aria-hidden="true">→</span><div className="specimen-router"><span className="specimen-number">SR</span><h2>SwitchRoute</h2><p>Your order.<br/>Your spending rules.</p></div><span className="flow-arrow" aria-hidden="true">→</span><ol className="specimen-targets"><li><span>01</span><strong>Primary model</strong><small>Try first</small></li><li><span>02</span><strong>Backup model</strong><small>If unavailable</small></li><li><span>03</span><strong>Final fallback</strong><small>If permitted</small></li></ol></div>
        <p className="specimen-note">Switch providers before an answer starts. Never combine output from different models into one stream.</p>
      </section>
      <section data-reveal className="site-section"><div className="section-index">01 / THE WORKSPACE</div><div><h2>Provider plumbing.<br/>Taken off your plate.</h2><div className="feature-lines">{[
        ["Connect", "Your existing provider accounts", "Validate credentials and discover available models. Keys stay encrypted and are never shown again."],
        ["Arrange", "A fallback order you can read", "Choose the first model, then the next. Search by name, compare billing types, and set explicit spending permissions."],
        ["Observe", "The details that matter", "See the selected model, duration, cost estimates, and fallback path. Conversation content stays out of storage."],
      ].map(([label,title,body]) => <article key={label}><span>{label}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></section>
      <section data-reveal className="site-section integration-section"><div className="section-index">02 / THE INTEGRATION</div><div><h2>A familiar API.<br/>A different base URL.</h2><p className="section-lede">Use an OpenAI client with a SwitchRoute key and the gateway URL from your workspace. Change the providers behind it whenever you need to.</p><pre><code>{`from openai import OpenAI

client = OpenAI(
    api_key=SWITCHROUTE_KEY,
    base_url=GATEWAY_URL + "/v1",
)

response = client.chat.completions.create(
    model="auto",
    messages=messages,
)`}</code></pre><Link href="/docs/openai-sdk" className="text-sm underline underline-offset-4">Read the integration guide ↗</Link></div></section>
      <section data-reveal className="site-section"><div className="section-index">03 / YOUR BOUNDARIES</div><div><h2>Your keys.<br/>Your call.</h2><div className="privacy-columns"><article><h3>Spending is a choice.</h3><p>New waterfalls block paid requests by default. Account-dependent or unknown pricing is never presented as guaranteed free access.</p><Link href="/docs/routes">Routing & budgets ↗</Link></article><article><h3>Content is transient.</h3><p>SwitchRoute retains routing metadata, not prompts or completions. The provider you select still applies its own data policy.</p><Link href="/docs/security">Security & privacy ↗</Link></article></div></div></section>
      <section data-reveal className="site-outro"><h2>Build the app.<br/>We’ll route the request.</h2><Link href="/login?mode=sign-up" className={buttonClass({size:"lg"})}>Get started ↗</Link></section>
    </main>
    <footer className="site-footer"><Brand/><span>A Dawnlight Labs project</span><div><Link href="/docs">Docs</Link><Link href="/login">Sign in</Link></div></footer>
  </div>;
}
