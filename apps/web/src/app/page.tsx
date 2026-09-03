import type { CSSProperties } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { PROVIDER_CATALOG } from "@/features/providers/catalog";

const targets = [
  { index: "01", provider: "Groq", model: "qwen/qwen3-32b", primary: true, note: "fast path" },
  { index: "02", provider: "Gemini", model: "gemini-2.5-flash", primary: false, note: "fallback" },
  { index: "03", provider: "OpenRouter", model: "anthropic/claude-sonnet", primary: false, note: "fallback" },
];

const features = [
  ["01", "Connect", "Validate provider keys once and discover the models actually available to that account."],
  ["02", "Order", "Drag provider/model targets into the exact waterfall order your application should use."],
  ["03", "Call", "Bind one SwitchRoute key to the waterfall and keep the same OpenAI-compatible client."],
];

const navLinks = [
  ["01", "Product", "#product"],
  ["02", "Routing", "#routing"],
  ["03", "Providers", "#providers"],
  ["04", "Docs", "/docs/getting-started"],
];

function delay(ms: number): CSSProperties {
  return { "--reveal-delay": `${ms}ms` } as CSSProperties;
}

export default function LandingPage() {
  return <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
    <LandingExperience />

    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_94%,transparent)] backdrop-blur-xl">
      <div className="mx-auto grid h-[72px] max-w-[1280px] grid-cols-[auto_1fr_auto] items-stretch px-4 sm:px-6 lg:px-8">
        <div className="flex items-center pr-4 md:border-r md:border-[var(--border)] md:pr-6"><Brand /></div>
        <nav className="hidden items-stretch md:flex" aria-label="Primary navigation">
          {navLinks.map(([index, label, href]) => <Link key={label} className="sr-topnav-link" href={href}><span>{label}</span><span className="sr-topnav-index">{index}</span></Link>)}
        </nav>
        <div className="flex items-center justify-end gap-2 pl-3 md:border-l md:border-[var(--border)] md:pl-5">
          <ThemeSwitcher compact />
          <Link className="sr-motion-control hidden px-2 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] lg:inline-flex" href="/login">Sign in</Link>
          <Link className={buttonClass({ size: "sm" })} href="/login">Console <Icon name="chevron" className="size-3.5"/></Link>
        </div>
      </div>
    </header>

    <section className="relative min-h-[calc(100vh-72px)] overflow-hidden border-b border-[var(--border)]">
      <div className="sr-hero-grid pointer-events-none absolute inset-0 opacity-65" />
      <div className="sr-pointer-glow pointer-events-none absolute inset-0" />
      <div className="sr-morph-orb sr-morph-orb-a pointer-events-none" data-parallax="36" />
      <div className="sr-morph-orb sr-morph-orb-b pointer-events-none" data-parallax="-22" />

      <div className="relative mx-auto grid min-h-[calc(100vh-72px)] max-w-[1280px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(470px,.92fr)] lg:items-center lg:px-8 lg:py-24">
        <div className="max-w-2xl" data-reveal="left">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] px-3 py-1.5 text-xs text-[var(--muted-foreground)] backdrop-blur-lg">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-50"/><span className="relative inline-flex size-2 rounded-full bg-emerald-500"/></span>
            Multi-provider routing control plane
          </div>
          <h1 className="text-[clamp(44px,6.2vw,80px)] font-semibold leading-[.96] tracking-[-.06em]">One endpoint.<br/><span className="text-[var(--muted-foreground)]">A whole waterfall behind it.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">Connect provider keys once. Arrange models in priority order. SwitchRoute moves requests through your waterfall while your application keeps one client.</p>
          <div className="mt-7 flex flex-wrap gap-2"><Link className={buttonClass({ size: "lg" })} href="/login">Build a waterfall <Icon name="chevron" className="size-4"/></Link><Link className={buttonClass({ variant: "secondary", size: "lg" })} href="/docs/getting-started">Read the docs</Link></div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted-foreground)]"><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Route-bound keys</span><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Ordered fallback</span><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Zero content retention</span></div>
        </div>

        <div className="relative" data-reveal="right" style={delay(120)} data-parallax="18">
          <div className="absolute -inset-8 rounded-[2.2rem] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] blur-3xl" />
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] shadow-[0_30px_100px_rgba(0,0,0,.13)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><p className="text-xs font-medium">production / coding</p><p className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">priority waterfall</p></div><span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500"/>healthy</span></div>
            <div className="grid gap-5 p-4 sm:p-5">
              <div className="sr-signal-line rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"><div className="flex items-center gap-2 font-mono text-[11px]"><span className="rounded bg-[var(--surface-strong)] px-1.5 py-1 text-[var(--accent)]">POST</span><span>/v1/chat/completions</span></div><p className="mt-2 font-mono text-[10px] text-[var(--muted-foreground)]">model: &quot;auto&quot; · sr_live_••••••</p></div>
              <div className="sr-waterfall-rail space-y-2 pl-10">{targets.map((target) => <div key={target.index} data-primary={target.primary} className="sr-route-target grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3"><span className="font-mono text-[10px] text-[var(--muted-foreground)]">{target.index}</span><div className="min-w-0"><strong className="block text-xs">{target.provider}</strong><code className="mt-1 block truncate font-mono text-[10px] text-[var(--muted-foreground)]">{target.model}</code></div><span className="rounded-md border border-[var(--border)] px-2 py-1 text-[9px] text-[var(--muted-foreground)]">{target.note}</span></div>)}</div>
              <div className="grid grid-cols-3 divide-x divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-center"><div className="p-2.5"><strong className="block text-xs">01</strong><span className="text-[10px] text-[var(--muted-foreground)]">endpoint</span></div><div className="p-2.5"><strong className="block text-xs">03</strong><span className="text-[10px] text-[var(--muted-foreground)]">targets</span></div><div className="p-2.5"><strong className="block text-xs">0</strong><span className="text-[10px] text-[var(--muted-foreground)]">content stored</span></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="providers" className="scroll-mt-20 border-b border-[var(--border)] bg-[var(--surface-muted)]">
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8" data-reveal>
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Direct provider adapters</p>
        <div className="flex flex-wrap justify-center gap-2">{PROVIDER_CATALOG.map((provider, index) => <div key={provider.kind} className="sr-provider-chip flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" data-reveal="scale" style={delay(index * 45)}><span className="grid size-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-[9px] font-semibold">{provider.mark}</span><span className="text-xs font-medium">{provider.name}</span></div>)}</div>
      </div>
    </section>

    <section id="product" className="relative mx-auto scroll-mt-20 max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
      <div className="mb-12 grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div data-reveal="left"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Small control plane</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-5xl">Provider logic belongs outside your app.</h2></div><p data-reveal="right" className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">No onboarding maze and no provider-specific conditionals in your codebase. Connect credentials, arrange the waterfall, issue a key, and route.</p></div>
      <div className="grid gap-3 md:grid-cols-3">{features.map(([n,title,body], index) => <article key={n} data-reveal="scale" style={delay(index * 90)} className="sr-motion-card sr-feature-card min-h-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><span className="font-mono text-[10px] text-[var(--accent)]">{n}</span><div className="mt-20"><h3 className="text-lg font-semibold tracking-[-.02em]">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{body}</p></div></article>)}</div>
    </section>

    <section id="routing" className="scroll-mt-20 border-y border-[var(--border)] bg-[#0d1014] text-[#e8ebef]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:px-8 lg:py-28">
        <div data-reveal="left"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[#38bdf8]">Routing in motion</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-5xl">The waterfall changes.<br/>Your endpoint does not.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#949ba5]">Promote a new model, move a free target above a paid one, or remove an unhealthy provider. The application keeps calling the same endpoint.</p></div>
        <div data-reveal="right" data-parallax="22" className="relative rounded-2xl border border-white/10 bg-white/[.035] p-5 shadow-[0_30px_100px_rgba(0,0,0,.28)]">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-medium">coding</p><p className="mt-1 font-mono text-[10px] text-[#7f8791]">live configuration</p></div><span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[9px] text-[#9da4ae]">drag to reorder</span></div>
          <div className="space-y-2">{[["01","OpenAI","gpt-5-mini"],["02","Groq","openai/gpt-oss-120b"],["03","Anthropic","claude-sonnet-4"],["04","OpenRouter","qwen/qwen3-coder"]].map(([n,p,m], index) => <div key={n} className="group grid grid-cols-[34px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[.045] px-3 py-3 transition duration-300 hover:translate-x-1 hover:border-white/20 hover:bg-white/[.07]" style={{ transform: `translateX(${index % 2 ? 5 : 0}px)` }}><span className="font-mono text-[10px] text-[#69717d]">{n}</span><div><strong className="block text-xs font-medium">{p}</strong><code className="mt-1 block font-mono text-[10px] text-[#808894]">{m}</code></div><span className={`size-2 rounded-full ${index === 0 ? "bg-[#38bdf8] shadow-[0_0_18px_#38bdf8]" : "bg-[#3d434d]"}`}/></div>)}</div>
          <div className="sr-signal-line mt-5 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[10px] text-[#8d95a0]">request → target 01 → response</div>
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-8 lg:py-28">
      <div data-reveal="left"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">OpenAI-compatible</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Change the base URL.<br/>Keep the client.</h2><p className="mt-4 max-w-md text-sm leading-7 text-[var(--muted-foreground)]">Waterfall changes happen in SwitchRoute. Your application does not need a provider-switching patch every time infrastructure changes.</p></div>
      <pre data-reveal="right" data-parallax="14" className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[#0d1014] p-5 font-mono text-xs leading-7 text-[#d8dde5] shadow-[0_24px_70px_rgba(0,0,0,.15)]"><code>{`from openai import OpenAI\n\nclient = OpenAI(\n    api_key="sr_live_...",\n    base_url="https://switchroute-gateway.vercel.app/v1"\n)\n\nclient.chat.completions.create(\n    model="auto",\n    messages=[{"role": "user", "content": "Hello"}]\n)`}</code></pre>
    </section>

    <section className="border-y border-[var(--border)] bg-[var(--surface)]"><div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-18 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24"><div data-reveal="left"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Privacy boundary</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Routing metadata, not conversations.</h2></div><div data-reveal="right" className="text-sm leading-7 text-[var(--muted-foreground)]"><p>SwitchRoute keeps the operational metadata needed for health, routing, latency, usage and diagnosis. Prompt text, completions, system prompts, tool contents and uploads are not persisted.</p><Link className="sr-motion-control mt-4 inline-flex items-center gap-1 font-medium text-[var(--accent)]" href="/docs/security">Security model <Icon name="chevron" className="size-3.5"/></Link></div></div></section>

    <section className="relative overflow-hidden bg-[var(--surface-muted)]"><div className="sr-morph-orb sr-morph-orb-a pointer-events-none opacity-50" data-parallax="25"/><div className="relative mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6 lg:px-8 lg:py-20" data-reveal><div><h2 className="text-2xl font-semibold tracking-[-.035em] sm:text-3xl">Build the waterfall. Keep one endpoint.</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Start with one provider. Add the rest when the route needs them.</p></div><Link className={buttonClass({ size: "lg" })} href="/login">Open SwitchRoute</Link></div></section>

    <footer className="border-t border-[var(--border)]"><div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><Brand/><span>Dawnlight Labs</span><div className="flex gap-4"><Link className="hover:text-[var(--foreground)]" href="/docs/getting-started">Docs</Link><Link className="hover:text-[var(--foreground)]" href="/login">Sign in</Link></div></div></footer>
  </main>;
}