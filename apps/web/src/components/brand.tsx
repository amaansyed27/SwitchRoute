import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-[-.02em] text-[var(--foreground)]" aria-label="SwitchRoute home"><span className="relative grid size-7 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-sm"><span className="h-px w-3.5 bg-[var(--accent)]"/><span className="absolute size-1.5 rounded-full bg-[var(--accent)]"/></span><span>SwitchRoute</span></Link>;
}
