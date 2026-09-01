import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authError = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="auth-wrap">
      <aside className="auth-aside">
        <Brand />
        <div>
          <p className="sr-kicker">ONE CONNECTION LAYER</p>
          <h2>Your app should not care which provider answered.</h2>
          <p className="sr-subtitle">Sign in, connect one provider, create a Route, and make your first OpenAI-compatible request.</p>
        </div>
        <small>Dawnlight Labs · prompts and completions are not retained.</small>
      </aside>
      <section className="auth-card-wrap"><AuthForm authError={authError} /></section>
    </main>
  );
}
