import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  redirect("/dashboard");
}
