import type { Metadata } from "next";
import "@switchroute/design-tokens/tokens.css";
import "./globals.css";
import "./product.css";
import "./refinement.css";

export const metadata: Metadata = {
  title: { default: "SwitchRoute", template: "%s · SwitchRoute" },
  description: "Connect providers, build an ordered Route, and call them through one OpenAI-compatible API.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
