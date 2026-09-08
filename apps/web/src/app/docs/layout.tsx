import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { DocsNav } from "@/components/docs/docs-nav";
import { buttonClass } from "@/components/ui/button";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl"><div className="mx-auto flex h-14 max-w-[1380px] items-center justify-between px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Brand/><span className="hidden border-l border-[var(--border)] pl-3 text-xs text-[var(--muted-foreground)] sm:inline">Docs</span></div><div className="flex items-center gap-2"><ThemeSwitcher compact/><Link className="hidden rounded-lg px-2.5 py-2 text-xs text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] sm:block" href="/">Home</Link><Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/dashboard">Dashboard</Link></div></div></header>
    <div className="mx-auto grid max-w-[1380px] lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="hidden min-h-[calc(100vh-57px)] border-r border-[var(--border)] p-4 lg:block"><div className="sticky top-20"><DocsNav/></div></aside>
      <main className="min-w-0"><article className="docs-prose mx-auto max-w-3xl px-5 py-10 sm:px-8 lg:py-14">{children}</article></main>
    </div>
  </div>;
}
