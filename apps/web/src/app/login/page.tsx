import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <aside className="auth-aside">
        <Brand />
        <div>
          <p className="sr-kicker">ONE CONNECTION LAYER</p>
          <h2 style={{ fontSize: 46, lineHeight: 1, letterSpacing: "-.045em", maxWidth: 540 }}>Your app should not care which provider answered.</h2>
          <p className="sr-subtitle">Sign in, connect one provider, create a Route, and make your first OpenAI-compatible request.</p>
        </div>
        <small style={{ color: "var(--sr-muted)" }}>Dawnlight Labs · prompts and completions are not retained.</small>
      </aside>
      <section className="auth-card-wrap"><AuthForm /></section>
    </main>
  );
}
