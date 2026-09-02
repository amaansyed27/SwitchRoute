"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import type { ModelOption, ProviderConnection, ProviderKind } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { cn } from "@/lib/cn";
import { PROVIDER_CATALOG } from "./catalog";

type ConnectableKind = Exclude<ProviderKind, "test">;

export function ProviderConnectForm({ initialKind = "openai", onConnected }: { initialKind?: ConnectableKind; onConnected: (provider: ProviderConnection) => void }) {
  const [kind, setKind] = useState<ConnectableKind>(initialKind);
  const selected = useMemo(() => PROVIDER_CATALOG.find((item) => item.kind === kind) ?? PROVIDER_CATALOG[0], [kind]);
  const [key, setKey] = useState("");
  const [name, setName] = useState(selected.name);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeKind(next: ConnectableKind) {
    const provider = PROVIDER_CATALOG.find((item) => item.kind === next)!;
    setKind(next); setName(provider.name); setModels(null); setError(null); setKey("");
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

  return <form onSubmit={test} className="space-y-6">
    <div>
      <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Provider</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PROVIDER_CATALOG.map((provider) => <button key={provider.kind} type="button" aria-pressed={kind === provider.kind} onClick={() => changeKind(provider.kind)} className={cn("rounded-xl border p-3 text-left transition", kind === provider.kind ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]")}><span className="mb-2 grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-[11px] font-semibold">{provider.mark}</span><strong className="block text-sm">{provider.name}</strong><span className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">{provider.company}</span></button>)}
      </div>
    </div>

    <div className="grid gap-4">
      <Field label="Connection name" htmlFor="provider-name"><Input id="provider-name" required value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="API key" htmlFor="provider-key" hint="The key is validated first, then encrypted. It is never returned to the browser after save."><Input id="provider-key" type="password" required autoComplete="off" value={key} onChange={(event) => { setKey(event.target.value); setModels(null); }} placeholder={`Paste ${selected.name} API key`} /></Field>
    </div>

    {error && <Alert>{error}</Alert>}
    {models && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/7 p-4"><div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><Icon name="check" className="size-4"/>Credential validated · {models.length} model{models.length === 1 ? "" : "s"}</div><div className="mt-3 flex flex-wrap gap-1.5">{models.slice(0, 8).map((model) => <Badge key={model.id}>{model.name}</Badge>)}{models.length > 8 && <Badge>+{models.length - 8}</Badge>}</div></div>}

    <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4"><Button type="submit" variant="secondary" disabled={busy || key.length < 3}>{busy && !models ? "Testing…" : "Test credential"}</Button><Button type="button" disabled={busy || !models || !name.trim()} onClick={save}>{busy && models ? "Saving…" : "Save connection"}</Button></div>
  </form>;
}
