"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DocsNav } from "./docs-nav";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const sdk = ["/docs/python", "/docs/javascript", "/docs/openai-sdk"].includes(pathname);
  const api = pathname.startsWith("/docs/api") && pathname !== "/docs/api-keys";
  return <div className="docs-shell">
    <a href="#docs-content" className="docs-skip">Skip to content</a>
    <aside className="docs-sidebar"><div className="docs-brand"><Brand/><span>Documentation</span></div><div className="docs-sidebar-scroll"><DocsNav/></div><div className="docs-sidebar-footer"><Link href="/dashboard">Open workspace <span aria-hidden="true">↗</span></Link><ThemeSwitcher compact/></div></aside>
    <div className="docs-body"><header className="docs-topbar"><nav aria-label="Documentation sections"><Link href="/docs" aria-current={!sdk && !api ? "true" : undefined}>Guides</Link><Link href="/docs/api" aria-current={api ? "true" : undefined}>API reference</Link><Link href="/docs/openai-sdk" aria-current={sdk ? "true" : undefined}>SDKs</Link></nav><Link href="/" className="docs-home-link">SwitchRoute ↗</Link></header>
      <details className="docs-mobile-menu" ref={menu}><summary>Documentation <span aria-hidden="true">⌄</span></summary><div><DocsNav onNavigate={() => { if (menu.current) menu.current.open = false; }}/><div className="docs-mobile-tools"><Link href="/dashboard">Open workspace ↗</Link><ThemeSwitcher compact/></div></div></details>
      <main id="docs-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
