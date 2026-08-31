import type { Metadata } from "next";
import "@switchroute/design-tokens/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SwitchRoute", template: "%s · SwitchRoute" },
  description: "One API for every AI model you already have access to.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
