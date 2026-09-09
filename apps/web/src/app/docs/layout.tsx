import { DocsShell } from "@/components/docs/docs-shell";
import "./docs.css";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
