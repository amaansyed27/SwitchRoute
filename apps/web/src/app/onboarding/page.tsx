import { Brand } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { OnboardingClient } from "@/features/onboarding/onboarding-client";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  return (
    <main>
      <div className="sr-shell marketing-nav onboarding-nav">
        <Brand />
        <ThemeSwitcher />
      </div>
      <div className="sr-shell onboarding-shell"><OnboardingClient /></div>
    </main>
  );
}
