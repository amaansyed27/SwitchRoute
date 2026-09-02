import { cn } from "@/lib/cn";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,.04)]", className)}>{children}</section>;
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: React.ReactNode; eyebrow?: string }) {
  return <div className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[.12em] text-[var(--muted-foreground)]">{eyebrow}</p>}
      <h1 className="text-2xl font-semibold tracking-[-.03em] text-[var(--foreground)] sm:text-[28px]">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5"><div><h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>}</div>{action}</div>;
}

export function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return <Card className="p-4"><p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p><div className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--foreground)]">{value}</div>{detail && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>}</Card>;
}
