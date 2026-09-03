"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const nav = [
  { href: "/dashboard", label: "Overview", icon: "home" as const },
  { href: "/providers", label: "Providers", icon: "providers" as const },
  { href: "/routes", label: "Waterfalls", icon: "waterfall" as const },
  { href: "/api-keys", label: "API keys", icon: "key" as const },
  { href: "/activity", label: "Activity", icon: "activity" as const },
];

export function AppShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] lg:grid lg:grid-cols-[228px_minmax(0,1fr)]">
    <aside className="sticky top-0 z-30 hidden h-screen flex-col border-r border-[var(--border)] bg-[var(--sidebar)] lg:flex">
      <div className="flex h-16 items-center px-4"><Brand href="/dashboard" /></div>
      <nav className="flex-1 space-y-1 px-2 py-3" aria-label="Product navigation">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} data-active={active} className={cn("sr-nav-item group flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium", active ? "bg-[var(--nav-active)] text-[var(--foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]")}><Icon name={item.icon} className="size-4"/><span className="transition-transform duration-150 group-hover:translate-x-0.5">{item.label}</span></Link>;
        })}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-3 min-w-0 px-2"><p className="truncate text-xs font-medium text-[var(--foreground)]">{email ?? "Signed in"}</p><p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">Personal workspace</p></div>
        <div className="flex items-center justify-between gap-2"><ThemeSwitcher compact/><Button variant="ghost" size="sm" onClick={signOut}><Icon name="logout" className="size-3.5"/>Sign out</Button></div>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 backdrop-blur-xl transition-[background-color,border-color] duration-200 lg:px-6">
        <div className="lg:hidden"><Brand href="/dashboard" /></div>
        <div className="hidden text-xs text-[var(--muted-foreground)] lg:block">Control plane</div>
        <div className="flex items-center gap-2"><span className="hidden rounded-md bg-[var(--surface-muted)] px-2 py-1 font-mono text-[10px] text-[var(--muted-foreground)] transition hover:bg-[var(--surface-hover)] sm:inline">zero content retention</span><div className="lg:hidden"><ThemeSwitcher compact/></div></div>
      </header>
      <main className="mx-auto w-full max-w-[1380px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--sidebar)] p-1 lg:hidden" aria-label="Mobile navigation">
        {nav.map((item) => { const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} data-active={active} className={cn("sr-nav-item flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px]", active ? "bg-[var(--nav-active)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]")}><Icon name={item.icon} className="size-4"/><span className="truncate">{item.label}</span></Link>; })}
      </nav>
    </div>
  </div>;
}
