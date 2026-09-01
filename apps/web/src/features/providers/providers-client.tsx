"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, StatusDot } from "@switchroute/ui";
import type { ProviderConnection } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { ProviderConnectForm } from "./provider-connect-form";

export function ProvidersClient() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setProviders(await manageFetch<ProviderConnection[]>("providers")); }
    catch (err) { setError(err instanceof Error ? err.message : "Providers could not be loaded."); }
  }, []);

  useEffect(() => {
    let active = true;
    void manageFetch<ProviderConnection[]>("providers")
      .then((data) => { if (active) setProviders(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Providers could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

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
    <div className="sr-stack provider-page">
      <div className="sr-page-header"><div><p className="sr-kicker">02 / UPSTREAM ACCESS</p><h1>Providers</h1><p>Connect credentials once. Validation and model discovery happen before the secret is stored.</p></div><Button onClick={() => setAdding(true)}>Connect provider</Button></div>
      {error && <div className="sr-error">{error}</div>}
      {adding && <ProviderConnectForm onCancel={() => setAdding(false)} onConnected={(provider) => { setProviders((current) => [...current, provider]); setAdding(false); }} />}
      {loading ? <div className="dashboard-loading"><span className="sr-kicker">UPSTREAMS</span><strong>Loading provider health…</strong><div className="loading-line" /></div> : !providers.length && !adding ? <EmptyState title="No providers connected" body="Start with Groq, Gemini, or OpenRouter. One healthy provider is enough to create your first Route." action={<Button onClick={() => setAdding(true)}>Connect your first provider</Button>} /> : (
        <div className="provider-list">
          <div className="list-caption"><span>Connection</span><span>Models</span><span>Last validation</span><span>Actions</span></div>
          {providers.map((provider) => {
            const models = provider.metadata?.models ?? [];
            return <section className="provider-row" key={provider.id}>
              <div className="provider-identity"><StatusDot status={provider.status} /><div><div className="sr-row"><strong>{provider.display_name}</strong><Badge tone={provider.status === "healthy" ? "success" : "warning"}>{provider.status}</Badge></div><span>{provider.provider_kind}</span></div></div>
              <div><strong>{models.length}</strong><span>discovered</span></div>
              <div><strong>{provider.last_validated_at ? new Date(provider.last_validated_at).toLocaleDateString() : "—"}</strong><span>{provider.last_validated_at ? new Date(provider.last_validated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "not tested"}</span></div>
              <div className="provider-actions"><Button className="sr-button-secondary" disabled={busyId === provider.id} onClick={() => test(provider)}>{busyId === provider.id ? "Testing…" : "Test"}</Button><Button className="sr-button-danger" disabled={busyId === provider.id} onClick={() => disconnect(provider)}>Disconnect</Button></div>
            </section>;
          })}
        </div>
      )}
    </div>
  );
}
