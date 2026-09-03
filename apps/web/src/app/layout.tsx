import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-switchroute-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-switchroute-mono", display: "swap" });

const themeBootstrap = `(() => { try { const saved = localStorage.getItem("switchroute-theme"); const choice = saved === "light" || saved === "dark" || saved === "system" ? saved : "system"; const resolved = choice === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : choice; document.documentElement.dataset.themeChoice = choice; document.documentElement.dataset.theme = resolved; } catch {} })();`;

export const metadata: Metadata = {
  title: { default: "SwitchRoute", template: "%s · SwitchRoute" },
  description: "One OpenAI-compatible endpoint for ordered multi-provider waterfalls.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}><head><script dangerouslySetInnerHTML={{ __html: themeBootstrap }} /></head><body>{children}</body></html>;
}
