import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PROVIDER_CATALOG } from "@/features/providers/catalog";

const targets = [
  { index: "01", provider: "Groq", model: "qwen/qwen3-32b", state: "primary" },
  { index: "02", provider: "Gemini", model: "gemini-2.5-flash", state: "fallback" },
  { index: "03", provider: "OpenRouter", model: "anthropic/claude-sonnet", state: "fallback" },
];

export default function LandingPage() {
  return <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />
        <nav className="flex items-center gap-2 text-sm" aria-label="Primary navigation">
          <div className="hidden sm:block"><ThemeSwitcher compact /></div>
          <Link className="hidden rounded-lg px-3 py-2 text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:block" href="/docs/getting-started">Docs</Link>
          <Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/login">Sign in</Link>
          <Link className={buttonClass({ size: "sm" })} href="/login">Open SwitchRoute</Link>
        </nav>
      </div>
    </header>

    <section className="relative border-b border-[var(--border)]">
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 24% 24%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 32%), radial-gradient(circle at 78% 40%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 28%)" }} />
      <div className="relative mx-auto grid max-w-[1280px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(480px,.9fr)] lg:items-center lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted-foreground)]"><span className="size-1.5 rounded-full bg-emerald-500"/>Multi-provider routing control plane</div>
          <h1 className="text-[clamp(42px,6vw,76px)] font-semibold leading-[.98] tracking-[-.055em]">One endpoint.<br/><span className="text-[var(--muted-foreground)]">Your models in order.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">Connect provider keys once. Build a waterfall of provider/model targets. Your app keeps one OpenAI-compatible client while SwitchRoute handles fallback.</p>
          <div className="mt-7 flex flex-wrap gap-2"><Link className={buttonClass({ size: "lg" })} href="/login">Build a waterfall <Icon name="chevron" className="size-4"/></Link><Link className={buttonClass({ variant: "secondary", size: "lg" })} href="/docs/getting-started">Read the docs</Link></div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--muted-foreground)]"><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Route-bound keys</span><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Ordered fallback</span><span className="flex items-center gap-1.5"><Icon name="check" className="size-3.5 text-emerald-500"/>Zero content retention</span></div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(0,0,0,.10)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><div><p className="text-xs font-medium">production</p><p className="mt-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">waterfall / coding</p></div><span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500"/>healthy</span></div>
          <div className="grid gap-5 p-4 sm:p-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3"><div className="flex items-center gap-2 font-mono text-[11px]"><span className="rounded bg-[var(--surface-strong)] px-1.5 py-1 text-[var(--accent)]">POST</span><span>/v1/chat/completions</span></div><p className="mt-2 font-mono text-[10px] text-[var(--muted-foreground)]">model: &quot;auto&quot; · one SwitchRoute key</p></div>
            <div className="relative ml-3 border-l border-[var(--border)] pl-5"><span className="absolute -left-1.5 top-0 size-3 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]"/><p className="mb-3 text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted-foreground)]">Waterfall order</p><div className="space-y-2">{targets.map((target) => <div key={target.index} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3"><span className="font-mono text-[10px] text-[var(--muted-foreground)]">{target.index}</span><div className="min-w-0"><strong className="block text-xs">{target.provider}</strong><code className="mt-1 block truncate font-mono text-[10px] text-[var(--muted-foreground)]">{target.model}</code></div><span className={`size-2 rounded-full ${target.state === "primary" ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`}/></div>)}</div></div>
            <div className="grid grid-cols-3 divide-x divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] text-center"><div className="p-2.5"><strong className="block text-xs">01</strong><span className="text-[10px] text-[var(--muted-foreground)]">endpoint</span></div><div className="p-2.5"><strong className="block text-xs">03</strong><span className="text-[10px] text-[var(--muted-foreground)]">targets</span></div><div className="p-2.5"><strong className="block text-xs">0</strong><span className="text-[10px] text-[var(--muted-foreground)]">content stored</span></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-[var(--border)] bg-[var(--surface-muted)]"><div className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 lg:px-8"><p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted-foreground)]">Direct provider adapters</p><div className="flex flex-wrap justify-center gap-2">{PROVIDER_CATALOG.map((provider) => <div key={provider.kind} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"><span className="grid size-6 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-[9px] font-semibold">{provider.mark}</span><span className="text-xs font-medium">{provider.name}</span></div>)}</div></div></section>

    <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20"><div className="mb-10 max-w-2xl"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Simple control plane</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Provider logic belongs outside your app.</h2><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">The product is deliberately small: credentials, waterfalls, keys, and sanitized request metadata.</p></div><div className="grid gap-3 md:grid-cols-3">{[["01","Connect","Validate provider keys and discover the models actually available to that account."],["02","Order","Drag provider/model targets into the exact fallback order you want."],["03","Call","Bind one SwitchRoute key to the waterfall and keep your existing OpenAI-compatible client."]].map(([n,title,body]) => <article key={n} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"><span className="font-mono text-[10px] text-[var(--accent)]">{n}</span><h3 className="mt-8 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{body}</p></article>)}</div></section>

    <section className="border-y border-[var(--border)] bg-[var(--surface)]"><div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8 lg:py-20"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">OpenAI-compatible</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Change the base URL.<br/>Keep the client.</h2><p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">Waterfall changes happen in SwitchRoute. Your application does not need a provider-switching patch every time infrastructure changes.</p></div><pre className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[#0d1014] p-5 font-mono text-xs leading-7 text-[#d8dde5]"><code>{`from openai import OpenAI\n\nclient = OpenAI(\n    api_key="sr_live_...",\n    base_url="https://switchroute-gateway.vercel.app/v1"\n)\n\nclient.chat.completions.create(\n    model="auto",\n    messages=[{"role": "user", "content": "Hello"}]\n)`}</code></pre></div></section>

    <section className="mx-auto grid max-w-[1280px] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Privacy boundary</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Routing metadata, not conversations.</h2></div><div className="text-sm leading-7 text-[var(--muted-foreground)]"><p>SwitchRoute keeps the operational metadata needed for health, routing, latency, usage and diagnosis. Prompt text, completions, system prompts, tool contents and uploads are not persisted.</p><Link className="mt-4 inline-flex items-center gap-1 font-medium text-[var(--accent)]" href="/docs/security">Security model <Icon name="chevron" className="size-3.5"/></Link></div></section>

    <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]"><div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6 lg:px-8"><div><h2 className="text-2xl font-semibold tracking-[-.035em]">Build the waterfall. Keep one endpoint.</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Start with any supported provider and add the rest when you need them.</p></div><Link className={buttonClass({ size: "lg" })} href="/login">Open SwitchRoute</Link></div></section>

    <footer className="border-t border-[var(--border)]"><div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-6 text-xs text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><Brand/><span>Dawnlight Labs</span><div className="flex gap-4"><Link href="/docs/getting-started">Docs</Link><Link href="/login">Sign in</Link></div></div></footer>
  </main>;
}
