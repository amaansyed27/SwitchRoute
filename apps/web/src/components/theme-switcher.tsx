"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ThemeChoice = "light" | "dark" | "system";
const choices: Array<{ value: ThemeChoice; label: string; icon: "sun" | "moon" | "system" }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "system" },
];

function applyTheme(choice: ThemeChoice) {
  const resolved = choice === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolved;
  localStorage.setItem("switchroute-theme", choice);
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    const saved = localStorage.getItem("switchroute-theme");
    const initial: ThemeChoice = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setChoice(initial);
    applyTheme(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if ((localStorage.getItem("switchroute-theme") ?? "system") === "system") applyTheme("system"); };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  return <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5" aria-label="Color theme">
    {choices.map((item) => <button key={item.value} type="button" title={item.label} aria-label={`${item.label} theme`} aria-pressed={choice === item.value} className={cn("grid h-7 rounded-md text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]", compact ? "w-7 place-items-center" : "grid-cols-[16px_auto] items-center gap-1.5 px-2 text-xs", choice === item.value && "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm")} onClick={() => { setChoice(item.value); applyTheme(item.value); }}><Icon name={item.icon} className="size-3.5"/>{!compact && <span>{item.label}</span>}</button>)}
  </div>;
}
