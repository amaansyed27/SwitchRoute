"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "light" | "dark" | "system";

const choices: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function resolveTheme(choice: ThemeChoice) {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.themeChoice = choice;
  document.documentElement.dataset.theme = resolveTheme(choice);
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("switchroute-theme");
    const initial: ThemeChoice = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setChoice(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystem = () => {
      const current = window.localStorage.getItem("switchroute-theme") ?? "system";
      if (current === "system") applyTheme("system");
    };
    media.addEventListener("change", syncSystem);
    return () => media.removeEventListener("change", syncSystem);
  }, []);

  function select(next: ThemeChoice) {
    setChoice(next);
    window.localStorage.setItem("switchroute-theme", next);
    applyTheme(next);
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
