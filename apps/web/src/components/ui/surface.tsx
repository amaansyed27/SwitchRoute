import { cn } from "@/lib/cn";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-[var(--border)] bg-[var(--surface)]", className)}>{children}</section>;
}

export function PageHeader({ title, description, action, eyebrow }: { title: string; description?: string; action?: React.ReactNode; eyebrow?: string }) {
  return <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <p className="sr-only text-xs text-[var(--muted-foreground)]">{eyebrow}</p>}
      <h1 className="text-[28px] font-semibold tracking-[-.035em] text-[var(--foreground)]">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}
    </div>
    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col items-start justify-between gap-4 px-4 sm:flex-row py-3.5 sm:px-5"><div><h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>}</div>{action}</div>;
}

export function Stat({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return <div className="border-l border-[var(--border)] px-5 py-2 first:border-l-0"><p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p><div className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--foreground)] transition-transform duration-200 group-hover:translate-x-0.5">{value}</div>{detail && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>}</div>;
}
