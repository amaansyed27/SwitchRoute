"use client";

import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@switchroute/ui";
import { manageFetch } from "@/lib/gateway/manage";
import type { ModelOption, ProviderConnection } from "@/features/shared/types";

type Kind = "groq" | "gemini" | "openrouter";
const providers: Array<{ kind: Kind; name: string; note: string }> = [
  { kind: "groq", name: "Groq", note: "Fast inference" },
  { kind: "gemini", name: "Gemini", note: "Google AI Studio" },
  { kind: "openrouter", name: "OpenRouter", note: "Broad model catalog" },
];

export function ProviderConnectForm({ onConnected, onCancel }: { onConnected: (provider: ProviderConnection) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<Kind>("groq");
  const [key, setKey] = useState("");
  const [name, setName] = useState("Groq");
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeKind(next: Kind) {
    const provider = providers.find((item) => item.kind === next);
    setKind(next); setName(provider?.name ?? next); setModels(null); setError(null);
  }

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
    <form className="provider-connect" onSubmit={test}>
      <div className="provider-connect-head">
        <div><p className="sr-kicker">NEW CONNECTION</p><h2>Connect a provider</h2><p>Choose the upstream, validate the credential, then save it. The key becomes write-only after this step.</p></div>
        {onCancel && <Button type="button" className="sr-button-secondary" onClick={onCancel}>Close</Button>}
      </div>

      <fieldset className="provider-picker"><legend>Provider</legend>{providers.map((provider) => <button key={provider.kind} type="button" data-selected={kind === provider.kind} onClick={() => changeKind(provider.kind)}><strong>{provider.name}</strong><span>{provider.note}</span></button>)}</fieldset>

      <div className="provider-fields">
        <div className="sr-field"><Label htmlFor="provider-name">Connection name</Label><Input id="provider-name" required value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="sr-field"><Label htmlFor="provider-key">Provider API key</Label><Input id="provider-key" type="password" required autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); setModels(null); }} placeholder="Paste provider key" /><small>Validated before storage. Decrypted credentials are never returned to the browser.</small></div>
      </div>

      {error && <div className="sr-error">{error}</div>}
      {models && <div className="provider-validation"><div><span className="sr-status sr-status-success" /><strong>Connection healthy.</strong><span>{models.length} chat-capable model{models.length === 1 ? "" : "s"} discovered.</span></div><div className="provider-model-preview">{models.slice(0, 5).map((model) => <span key={model.id}>{model.name}</span>)}{models.length > 5 && <span>+{models.length - 5} more</span>}</div></div>}

      <div className="provider-connect-actions"><Button type="submit" className="sr-button-secondary" disabled={busy || key.length < 3}>{busy ? "Testing…" : "Test connection"}</Button><Button type="button" disabled={busy || !models || !name.trim()} onClick={save}>Save provider</Button></div>
    </form>
  );
}
