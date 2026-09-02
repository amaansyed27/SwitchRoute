"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@switchroute/ui";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Overview", index: "01" },
  { href: "/providers", label: "Providers", index: "02" },
  { href: "/routes", label: "Routes", index: "03" },
  { href: "/api-keys", label: "API Keys", index: "04" },
  { href: "/activity", label: "Activity", index: "05" },
  { href: "/docs/getting-started", label: "Docs", index: "06" },
] as const;

export function AppShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand-block">
          <Brand href="/dashboard" />
          <span className="app-workspace-label">Personal workspace</span>
        </div>
        <nav className="app-nav" aria-label="Product navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            >
              <span className="app-nav-index">{item.index}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <div className="app-account">
            <span className="sr-status sr-status-success" aria-hidden="true" />
            <div>
              <span>Signed in</span>
              <strong title={email}>{email ?? "SwitchRoute user"}</strong>
            </div>
          </div>
          <Button className="sr-button-secondary app-signout" onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="app-location">
            <span className="sr-kicker">CONTROL PLANE</span>
            <span>{current?.label ?? "SwitchRoute"}</span>
          </div>
          <div className="app-topbar-actions">
            <ThemeSwitcher />
            <span className="app-retention">Zero content retention</span>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
