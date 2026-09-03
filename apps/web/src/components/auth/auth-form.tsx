"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Card } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/client";

const authErrorMessages: Record<string, string> = {
  auth_callback: "That sign-in callback could not create a session. Request a new link and try again.",
  auth_confirm: "That email sign-in link could not be verified. Request a fresh link and try again.",
};

export function AuthForm({ authError }: { authError?: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(authError ? (authErrorMessages[authError] ?? "Sign-in could not be completed.") : null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function emailSignIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setSuccess(false);
    try {
      const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` } });
      if (error) setMessage(error.message); else { setMessage("Check your email for the secure sign-in link."); setSuccess(true); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }

  return <Card className="w-full p-5 shadow-[0_18px_60px_rgba(0,0,0,.08)] sm:p-6"><div className="mb-6"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Access</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Sign in to SwitchRoute</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">We are using passwordless Supabase email auth for this build.</p></div><form onSubmit={emailSignIn} className="space-y-4"><Field label="Email address" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoFocus/></Field><Button className="w-full" type="submit" disabled={busy || !email}>{busy ? "Sending secure link…" : "Continue with email"}</Button></form>{message && <div className="mt-4"><Alert tone={success ? "success" : "error"}>{message}</Alert></div>}<p className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted-foreground)]">No provider credential is requested until after authentication.</p></Card>;
}
