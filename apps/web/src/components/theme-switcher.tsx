"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ThemeChoice = "light" | "dark" | "system";
const choices: Array<{ value: ThemeChoice; label: string; icon: "sun" | "moon" | "system" }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "system" },
];

function normalizeTheme(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function resolveTheme(choice: ThemeChoice) {
  return choice === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice;
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolveTheme(choice);
}

function snapshot() {
  return normalizeTheme(window.localStorage.getItem("switchroute-theme"));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("switchroute-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("switchroute-theme", callback);
  };
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const choice = useSyncExternalStore(subscribe, snapshot, () => "system" as ThemeChoice);

  useEffect(() => {
    applyTheme(choice);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => { if (choice === "system") applyTheme("system"); };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [choice]);

  function select(next: ThemeChoice) {
    window.localStorage.setItem("switchroute-theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("switchroute-theme"));
  }

  return <div className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5" aria-label="Color theme">
    {choices.map((item) => <button key={item.value} type="button" title={item.label} aria-label={`${item.label} theme`} aria-pressed={choice === item.value} className={cn("grid h-7 rounded-md text-[var(--muted-foreground)] transition hover:text-[var(--foreground)]", compact ? "w-7 place-items-center" : "grid-cols-[16px_auto] items-center gap-1.5 px-2 text-xs", choice === item.value && "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm")} onClick={() => select(item.value)}><Icon name={item.icon} className="size-3.5"/>{!compact && <span>{item.label}</span>}</button>)}
  </div>;
}
