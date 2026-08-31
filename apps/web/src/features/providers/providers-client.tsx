"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, StatusDot } from "@switchroute/ui";
import type { ProviderConnection } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { ProviderConnectForm } from "./provider-connect-form";

export function ProvidersClient() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => manageFetch<ProviderConnection[]>("providers").then(setProviders).catch((err) => setError(err.message)), []);
  useEffect(() => { load(); }, [load]);

  async function test(provider: ProviderConnection) {
    setBusyId(provider.id); setError(null);
    try { await manageFetch(`providers/${provider.id}/test`, { method: "POST", body: "{}" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Provider test failed."); }
    finally { setBusyId(null); }
  }

  async function disconnect(provider: ProviderConnection) {
    if (!window.confirm(`Disconnect ${provider.display_name}? Routes using it must be changed first.`)) return;
    setBusyId(provider.id); setError(null);
    try { await manageFetch(`providers/${provider.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Provider could not be disconnected."); }
    finally { setBusyId(null); }
  }

  return (
    <div className="sr-stack" style={{ gap: 26 }}>
      <div className="sr-page-header"><div><p className="sr-kicker">UPSTREAM ACCESS</p><h1>Providers</h1><p>Connect credentials once. Keys are validated before storage and behave as write-only secrets afterward.</p></div><Button onClick={() => setAdding(true)}>Connect provider</Button></div>
      {error && <div className="sr-error">{error}</div>}
      {adding && <ProviderConnectForm onCancel={() => setAdding(false)} onConnected={(provider) => { setProviders((current) => [...current, provider]); setAdding(false); }} />}
      {!providers.length && !adding ? <EmptyState title="No providers connected" body="Start with Groq, Gemini, or OpenRouter. You can add more later." action={<Button onClick={() => setAdding(true)}>Connect your first provider</Button>} /> : (
        <div className="sr-stack">
          {providers.map((provider) => {
            const models = provider.metadata?.models ?? [];
            return <section className="sr-panel" key={provider.id}>
              <div className="sr-between"><div><div className="sr-row"><StatusDot status={provider.status} /><h2 style={{ margin: 0, fontSize: 20 }}>{provider.display_name}</h2><Badge tone={provider.status === "healthy" ? "success" : "warning"}>{provider.status}</Badge></div><p style={{ margin: "7px 0 0", color: "var(--sr-muted)", fontSize: 13 }}>{provider.provider_kind} · {models.length} discovered models {provider.last_validated_at ? `· tested ${new Date(provider.last_validated_at).toLocaleString()}` : ""}</p></div><div className="sr-row"><Button className="sr-button-secondary" disabled={busyId === provider.id} onClick={() => test(provider)}>{busyId === provider.id ? "Testing…" : "Test"}</Button><Button className="sr-button-danger" disabled={busyId === provider.id} onClick={() => disconnect(provider)}>Disconnect</Button></div></div>
            </section>;
          })}
        </div>
      )}
    </div>
  );
}
