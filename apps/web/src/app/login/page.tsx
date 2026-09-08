import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AuthForm } from "@/components/auth/auth-form";
import { Icon } from "@/components/ui/icon";

export const metadata = { title: "Sign in" };

type LoginPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;
  return <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <header className="border-b border-[var(--border)]"><div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 sm:px-6"><Brand/><div className="flex items-center gap-2"><ThemeSwitcher compact/><Link href="/docs/getting-started" className="rounded-lg px-3 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">Docs</Link></div></div></header>
    <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1120px] items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="hidden max-w-xl lg:block"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">SwitchRoute control plane</p><h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-[-.055em]">Keys in one place.<br/><span className="text-[var(--muted-foreground)]">Waterfalls behind one API.</span></h1><p className="mt-5 text-base leading-7 text-[var(--muted-foreground)]">Sign in to connect provider credentials, arrange model fallbacks, create route-bound keys, and inspect sanitized request metadata.</p><div className="mt-8 grid gap-3 text-sm">{["Provider keys are encrypted and write-only after save.","SwitchRoute keys are route-bound and shown once.","Prompt and completion content is not retained."].map((item) => <div key={item} className="flex items-start gap-2 text-[var(--muted-foreground)]"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-emerald-500"/><span>{item}</span></div>)}</div></section>
      <AuthForm authError={authError}/>
    </div>
  </main>;
}
