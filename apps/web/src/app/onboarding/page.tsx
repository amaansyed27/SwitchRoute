import { Brand } from "@/components/brand";
import { OnboardingClient } from "@/features/onboarding/onboarding-client";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  return <main><div className="sr-shell marketing-nav"><Brand /></div><div className="sr-shell" style={{ padding: "42px 0 80px" }}><OnboardingClient /></div></main>;
}
