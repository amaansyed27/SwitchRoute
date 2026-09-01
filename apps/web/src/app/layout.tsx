import type { Metadata } from "next";
import { Orbitron, Space_Mono } from "next/font/google";
import "@switchroute/design-tokens/tokens.css";
import "./globals.css";
import "./product.css";
import "./refinement.css";
import "./live-review.css";
import "./landing-v2.css";
import "./landing-v2-review.css";

const display = Orbitron({
  subsets: ["latin"],
  variable: "--font-dawnlight-display",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dawnlight-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SwitchRoute", template: "%s · SwitchRoute" },
  description: "Connect providers, build an ordered Route, and call them through one OpenAI-compatible API.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
