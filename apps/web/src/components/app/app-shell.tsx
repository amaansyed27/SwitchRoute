"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@switchroute/ui";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

const nav = [
  ["/dashboard", "Dashboard"],
  ["/providers", "Providers"],
  ["/routes", "Routes"],
  ["/api-keys", "API Keys"],
  ["/activity", "Activity"],
  ["/docs/getting-started", "Docs"],
] as const;

export function AppShell({ children, email }: { children: React.ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Brand href="/dashboard" />
        <nav className="app-nav" aria-label="Product navigation">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} data-active={pathname === href || pathname.startsWith(`${href}/`)}>{label}</Link>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <div style={{ color: "var(--sr-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          <Button className="sr-button-secondary" style={{ width: "100%", marginTop: 10 }} onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar"><span>Personal workspace</span><span className="sr-kicker">CLOUD CORE</span></header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
