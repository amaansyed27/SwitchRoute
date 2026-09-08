"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Card } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/client";

const authErrorMessages: Record<string, string> = {
  auth_callback: "That sign-in callback could not create a session. Request a new link and try again.",
  auth_confirm: "That email sign-in link could not be verified. Request a fresh link and try again.",
};

type AuthMethod = "link" | "password" | "sign-up" | "reset";

const authCopy: Record<AuthMethod, { title: string; description: string; submit: string }> = {
  link: { title: "Sign in to SwitchRoute", description: "Use a secure sign-in link, or choose a password below.", submit: "Continue with email" },
  password: { title: "Sign in with password", description: "Use the password for your SwitchRoute account.", submit: "Sign in" },
  "sign-up": { title: "Create an account", description: "Set a password, then confirm your email before signing in.", submit: "Create account" },
  reset: { title: "Set or reset password", description: "We’ll email a secure link to set a password for this account.", submit: "Email password link" },
};

export function AuthForm({ authError }: { authError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<AuthMethod>("link");
  const [message, setMessage] = useState<string | null>(authError ? (authErrorMessages[authError] ?? "Sign-in could not be completed.") : null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const passwordMode = method === "password" || method === "sign-up";
  const copy = authCopy[method];

  function redirectToConfirm() {
    return `${window.location.origin}/auth/confirm?next=/dashboard`;
  }

  function switchMethod(next: AuthMethod) {
    setMethod(next); setMessage(null); setSuccess(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setSuccess(false);
    const supabase = createClient();
    try {
      if (method === "link") {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectToConfirm() } });
        if (error) setMessage(error.message); else { setMessage("Check your email for the secure sign-in link."); setSuccess(true); }
      } else if (method === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage("Email or password is incorrect."); else router.replace("/dashboard");
      } else if (method === "sign-up") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectToConfirm() } });
        if (error) setMessage("Account could not be created. Check your details and try again.");
        else if (data.session) router.replace("/dashboard");
        else { setMessage("Check your email to confirm the account, then sign in with your password."); setSuccess(true); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/confirm?next=/auth/update-password` });
        if (error) setMessage("Password link could not be sent. Try again."); else { setMessage("If this account can use a password, check your email for a secure setup link."); setSuccess(true); }
      }
    } catch { setMessage("Sign-in could not be completed. Try again."); }
    finally { setBusy(false); }
  }

  return <Card className="w-full p-5 shadow-[0_18px_60px_rgba(0,0,0,.08)] sm:p-6"><div className="mb-6"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--accent)]">Access</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{copy.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{copy.description}</p></div><form onSubmit={submit} className="space-y-4"><Field label="Email address" htmlFor="email"><Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoFocus/></Field>{passwordMode && <Field label="Password" htmlFor="password" hint={method === "sign-up" ? "Use at least 8 characters." : undefined}><Input id="password" type="password" autoComplete={method === "sign-up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/></Field>}<Button className="w-full" type="submit" disabled={busy || !email || (passwordMode && password.length < 8)}>{busy ? "Working…" : copy.submit}</Button></form><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs"><button type="button" className="text-[var(--accent)] underline-offset-4 hover:underline focus-visible:underline" onClick={() => switchMethod(method === "link" ? "password" : "link")}>{method === "link" ? "Use a password" : "Use a secure link"}</button>{method !== "sign-up" && <button type="button" className="text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline focus-visible:underline" onClick={() => switchMethod("sign-up")}>Create account</button>}{method === "password" && <button type="button" className="text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline focus-visible:underline" onClick={() => switchMethod("reset")}>Set or reset password</button>}</div>{message && <div className="mt-4"><Alert tone={success ? "success" : "error"}>{message}</Alert></div>}<p className="mt-5 border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted-foreground)]">No provider credential is requested until after authentication.</p></Card>;
}
