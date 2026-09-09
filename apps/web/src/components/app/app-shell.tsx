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
    const { error } = await createClient().auth.signOut();
    if (error) { window.alert("Sign out failed. Please try again."); return; }
    router.replace("/login");
    router.refresh();
  }
  return <div className="workspace-shell">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-[var(--surface)] focus:p-4">Skip to content</a>
    <aside className="workspace-sidebar">
      <div className="px-6 py-8"><Brand href="/dashboard"/></div>
      <div className="mx-4 mb-8 border-y border-[var(--border)] px-3 py-4"><p className="text-sm font-medium">Personal workspace</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Cloud routing</p></div>
      <nav aria-label="Product navigation" className="flex-1 space-y-1 px-3">{nav.map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="workspace-link"><Icon name={item.icon} className="size-4"/>{item.label}{active && <span className="ml-auto size-1.5 rounded-full bg-[var(--accent)]"/>}</Link>;
      })}</nav>
      <div className="m-4 border-t border-[var(--border)] pt-5"><Link href="/docs/getting-started" className="block px-3 py-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Documentation ↗</Link><div className="mt-4 flex items-center gap-3 px-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-hover)] text-xs">{email?.[0]?.toUpperCase() ?? "W"}</span><span className="truncate text-xs text-[var(--muted-foreground)]">{email ?? "Signed in"}</span><button aria-label="Sign out" onClick={signOut} className="ml-auto grid size-10 shrink-0 place-items-center rounded-md hover:bg-[var(--surface-hover)]"><Icon name="logout" className="size-4"/></button></div></div>
    </aside>
    <div className="min-w-0"><header className="workspace-header"><div className="lg:hidden"><Brand href="/dashboard"/></div><p className="hidden text-sm text-[var(--muted-foreground)] lg:block">Workspace <span className="mx-3 text-[var(--border-strong)]">/</span> <span className="text-[var(--foreground)]">{nav.find((item) => item.href === pathname)?.label ?? "Overview"}</span></p><div className="flex items-center gap-3"><Link href="/docs" className="hidden text-sm text-[var(--muted-foreground)] sm:block">Help & docs</Link><ThemeSwitcher compact/><Button className="lg:hidden" variant="ghost" size="sm" onClick={signOut} aria-label="Sign out"><Icon name="logout" className="size-4"/></Button></div></header>
      <main id="workspace-content" className="workspace-content">{children}</main>
      <nav className="workspace-mobile-nav" aria-label="Mobile navigation">{nav.map((item) => <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[11px]", pathname === item.href ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]")}><Icon name={item.icon} className="size-5"/>{item.label}</Link>)}</nav>
    </div>
  </div>;
}
