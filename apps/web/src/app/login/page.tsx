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
  return <main className="auth-layout">
    <section className="auth-story"><Brand/><div className="my-auto py-16"><p className="mb-8 text-sm text-white/60">SWITCHROUTE / WORKSPACE</p><h1 className="max-w-xl text-5xl font-medium leading-[1.06] tracking-[-.05em] xl:text-7xl">Your providers.<br/>Connected.</h1><p className="mt-8 max-w-sm text-base leading-8 text-white/60">Connect accounts, arrange your models, and keep your applications moving.</p></div><div className="flex items-center gap-3 border-t border-white/20 pt-6 text-sm text-white/60"><Icon name="check" className="size-4"/>Provider keys encrypted. Conversations not retained.</div></section>
    <section className="flex min-h-dvh flex-col bg-[var(--surface)]"><header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 sm:px-10"><div className="lg:hidden"><Brand/></div><Link href="/" className="hidden text-sm text-[var(--muted-foreground)] lg:block">← Back to home</Link><div className="flex items-center gap-4"><Link href="/docs" className="text-sm text-[var(--muted-foreground)]">Help</Link><ThemeSwitcher compact/></div></header><div className="m-auto w-full max-w-md px-6 py-12"><AuthForm authError={authError} initialMethod={params.mode === "sign-up" ? "sign-up" : "link"}/></div><p className="px-6 py-6 text-center text-xs text-[var(--muted-foreground)]">SwitchRoute · Dawnlight Labs</p></section>
  </main>;
}
