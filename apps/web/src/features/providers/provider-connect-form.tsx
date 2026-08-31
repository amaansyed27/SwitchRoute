"use client";

import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@switchroute/ui";
import { manageFetch } from "@/lib/gateway/manage";
import type { ModelOption, ProviderConnection } from "@/features/shared/types";

type Kind = "groq" | "gemini" | "openrouter";
const names: Record<Kind, string> = { groq: "Groq", gemini: "Gemini", openrouter: "OpenRouter" };

export function ProviderConnectForm({ onConnected, onCancel }: { onConnected: (provider: ProviderConnection) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<Kind>("groq");
  const [key, setKey] = useState("");
  const [name, setName] = useState("Groq");
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeKind(next: Kind) { setKind(next); setName(names[next]); setModels(null); setError(null); }

  async function test(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setModels(null);
    try {
      const result = await manageFetch<{ models: ModelOption[] }>("providers/validate", { method: "POST", body: JSON.stringify({ provider_kind: kind, api_key: key }) });
      setModels(result.models);
    } catch (err) { setError(err instanceof Error ? err.message : "Connection test failed."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!models) return;
    setBusy(true); setError(null);
    try {
      const provider = await manageFetch<ProviderConnection>("providers", { method: "POST", body: JSON.stringify({ provider_kind: kind, display_name: name.trim(), api_key: key }) });
      setKey(""); onConnected(provider);
    } catch (err) { setError(err instanceof Error ? err.message : "Provider could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <form className="sr-panel sr-form-grid" onSubmit={test}>
      <div className="sr-between"><div><p className="sr-kicker">NEW CONNECTION</p><h2 style={{ margin: 0 }}>Connect a provider</h2></div>{onCancel && <Button type="button" className="sr-button-secondary" onClick={onCancel}>Close</Button>}</div>
      <div className="sr-field"><Label htmlFor="provider-kind">Provider</Label><select id="provider-kind" className="sr-select" value={kind} onChange={(event) => changeKind(event.target.value as Kind)}><option value="groq">Groq</option><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option></select></div>
      <div className="sr-field"><Label htmlFor="provider-name">Connection name</Label><Input id="provider-name" required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="sr-field"><Label htmlFor="provider-key">Provider API key</Label><Input id="provider-key" type="password" required autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); setModels(null); }} placeholder="Write-only after save" /><small style={{ color: "var(--sr-muted)" }}>SwitchRoute validates this key before saving it. The decrypted value is never returned to the browser.</small></div>
      {error && <div className="sr-error">{error}</div>}
      {models && <div className="sr-success-box"><strong>Connection healthy.</strong> {models.length} chat-capable model{models.length === 1 ? "" : "s"} discovered.</div>}
      <div className="sr-row"><Button type="submit" className="sr-button-secondary" disabled={busy || key.length < 3}>{busy ? "Testing…" : "Test connection"}</Button><Button type="button" disabled={busy || !models || !name.trim()} onClick={save}>Save provider</Button></div>
    </form>
  );
}
