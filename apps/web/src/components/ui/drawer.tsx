"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";
import { Icon } from "./icon";

export function Drawer({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className={`sr-drawer-panel fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full ${wide ? "max-w-3xl" : "max-w-xl"} border-l border-[var(--border)] bg-[var(--background)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/40`}>
    <div className="min-h-full">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--background)] px-5 py-4">
        <div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>}</div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><Icon name="x" className="size-4"/></Button>
      </header>
      <div className="p-5">{children}</div>
    </div>
  </dialog>;
}
