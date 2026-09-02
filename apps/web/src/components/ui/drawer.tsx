import { Button } from "./button";
import { Icon } from "./icon";

export function Drawer({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`${wide ? "max-w-3xl" : "max-w-xl"} h-full w-full overflow-y-auto border-l border-[var(--border)] bg-[var(--background)] shadow-2xl`}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_94%,transparent)] px-5 py-4 backdrop-blur-xl">
        <div><h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>}</div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><Icon name="x" className="size-4"/></Button>
      </header>
      <div className="p-5">{children}</div>
    </section>
  </div>;
}
