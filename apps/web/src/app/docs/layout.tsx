import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DocsNav } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="docs-page">
      <header className="docs-header">
        <div className="docs-header-inner">
          <Brand />
          <span className="docs-wordmark">Documentation</span>
          <nav className="docs-header-links" aria-label="Documentation utilities">
            <ThemeSwitcher compact />
            <Link href="/">Home</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link className="docs-signin" href="/login">Sign in</Link>
          </nav>
        </div>
      </header>
      <div className="docs-layout">
        <aside className="docs-sidebar"><DocsNav /></aside>
        <article className="docs-content">{children}</article>
      </div>
    </main>
  );
}
