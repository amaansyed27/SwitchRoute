import { AppShell } from "@/components/app/app-shell";
import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const claims = await requireUser();
  return <AppShell email={typeof claims.email === "string" ? claims.email : undefined}>{children}</AppShell>;
}
