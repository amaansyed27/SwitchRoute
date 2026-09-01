"use client";

import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@switchroute/ui";
import { createClient } from "@/lib/supabase/client";

const authErrorMessages: Record<string, string> = {
  auth_callback: "That sign-in callback could not create a session. Request a new link or try the provider again.",
  auth_confirm: "That email sign-in link could not be verified. Request a fresh link and try again.",
};

export function AuthForm({ authError }: { authError?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(authError ? (authErrorMessages[authError] ?? "Sign-in could not be completed.") : null);
  const [busy, setBusy] = useState(false);

  async function oauth(provider: "github" | "google") {
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) {
        setMessage(error.message);
        setBusy(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  async function emailSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/onboarding` },
      });
      setMessage(error ? error.message : "Check your email for the secure sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="sr-kicker">ACCESS SWITCHROUTE</p>
      <h1>Sign in or start.</h1>
      <p>New accounts continue directly into provider → Route → API key setup.</p>
      <div className="oauth-grid">
        <Button disabled={busy} onClick={() => oauth("github")}>Continue with GitHub</Button>
        <Button className="sr-button-secondary" disabled={busy} onClick={() => oauth("google")}>Continue with Google</Button>
      </div>
      <div className="auth-divider">or use email</div>
      <form className="sr-form-grid" onSubmit={emailSignIn}>
        <div className="sr-field">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </div>
        <Button disabled={busy || !email} type="submit">{busy ? "Sending link…" : "Continue with email"}</Button>
      </form>
      <p className="auth-footnote">Passwordless email sign-in. Provider credentials are added only after authentication.</p>
      {message && <p className={message.startsWith("Check") ? "sr-success-box" : "sr-error"}>{message}</p>}
    </div>
  );
}
