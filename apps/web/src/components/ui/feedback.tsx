import { cn } from "@/lib/cn";
import { Button } from "./button";

export function Badge({ children, tone = "neutral", className = "" }: { children: React.ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "accent"; className?: string }) {
  const tones = {
    neutral: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    danger: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
    accent: "border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]",
  } as const;
  return <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-semibold uppercase tracking-[.06em]", tones[tone], className)}>{children}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const good = ["healthy", "success", "active"].includes(status);
  const bad = ["invalid", "error", "revoked"].includes(status);
  return <span title={status} aria-label={status} className={cn("inline-block size-2 rounded-full", good ? "bg-emerald-500" : bad ? "bg-red-500" : "bg-amber-500")} />;
}

export function Alert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" | "success" }) {
  const styles = tone === "error" ? "border-red-500/20 bg-red-500/8 text-red-700 dark:text-red-300" : tone === "success" ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)]";
  return <div className={cn("rounded-lg border px-3 py-2.5 text-sm", styles)}>{children}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--surface-muted)]", className)} />;
}

export function LoadingBlock({ label = "Loading" }: { label?: string }) {
  return <div className="grid gap-3 py-2" aria-live="polite"><span className="sr-only">{label}</span><Skeleton className="h-16 w-full"/><Skeleton className="h-16 w-full"/><Skeleton className="h-16 w-4/5"/></div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center"><div className="mb-3 grid size-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--muted-foreground)]">+</div><h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3><p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function Retry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4"><p className="text-sm text-red-700 dark:text-red-300">{message}</p><Button className="mt-3" variant="secondary" size="sm" onClick={onRetry}>Try again</Button></div>;
}
