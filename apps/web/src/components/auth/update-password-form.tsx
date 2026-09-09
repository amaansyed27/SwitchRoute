"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(null);
    if (password !== confirmation) { setMessage("Passwords do not match."); return; }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setMessage("This password link is no longer valid. Request a new one.");
      else router.replace("/dashboard");
    } catch { setMessage("Password could not be updated. Request a new link."); }
    finally { setBusy(false); }
  }

  return <section className="w-full max-w-md p-6"><p className="text-xs font-medium text-[var(--accent)]">Account security</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Set your password</h1><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">Choose a password with at least 8 characters.</p><form onSubmit={submit} className="mt-6 space-y-4"><Field label="New password" htmlFor="password"><Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} autoFocus/></Field><Field label="Confirm password" htmlFor="confirmation"><Input id="confirmation" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></Field><Button className="w-full" type="submit" disabled={busy || password.length < 8 || confirmation.length < 8}>{busy ? "Saving password…" : "Save password"}</Button></form>{message && <div className="mt-4"><Alert>{message}</Alert></div>}</section>;
}
