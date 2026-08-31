import Link from "next/link";
import { Brand } from "@/components/brand";
import { DocsNav } from "@/components/docs/docs-nav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <main><div className="sr-shell marketing-nav"><Brand /><div className="sr-row"><Link href="/dashboard">Dashboard</Link><Link className="sr-button sr-button-secondary" href="/login">Sign in</Link></div></div><div className="docs-shell"><DocsNav /><article className="docs-content">{children}</article></div></main>;
}
