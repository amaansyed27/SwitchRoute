"use client";

import { useEffect, useSyncExternalStore } from "react";

type ThemeChoice = "light" | "dark" | "system";

const choices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function normalizeTheme(value: string | null): ThemeChoice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function resolveTheme(choice: ThemeChoice) {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolveTheme(choice);
}

function getThemeSnapshot() {
  return normalizeTheme(window.localStorage.getItem("switchroute-theme"));
}

function subscribeTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("switchroute-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("switchroute-theme", callback);
  };
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const choice = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "system" as ThemeChoice);

  useEffect(() => {
    applyTheme(choice);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => { if (choice === "system") applyTheme("system"); };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, [choice]);

  function select(next: ThemeChoice) {
    window.localStorage.setItem("switchroute-theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event("switchroute-theme"));
  }

  if (compact) {
    return (
      <label className="theme-select">
        <span className="sr-visually-hidden">Color theme</span>
        <select aria-label="Color theme" value={choice} onChange={(event) => select(event.target.value as ThemeChoice)}>
          {choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    );
  }

  return (
    <div className="theme-switcher" role="group" aria-label="Color theme">
      {choices.map((item) => (
        <button key={item.value} type="button" aria-pressed={choice === item.value} onClick={() => select(item.value)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}
