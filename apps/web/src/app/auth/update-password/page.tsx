import { Brand } from "@/components/brand";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata = { title: "Set password" };

export default function UpdatePasswordPage() {
  return <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6"><div className="mx-auto max-w-[1120px]"><Brand href="/login"/></div><div className="mx-auto grid min-h-[calc(100vh-104px)] max-w-[1120px] place-items-center"><UpdatePasswordForm /></div></main>;
}
