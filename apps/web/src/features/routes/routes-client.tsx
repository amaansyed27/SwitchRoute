"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, StatusDot } from "@switchroute/ui";
import type { ProviderConnection, RouteRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { RouteForm } from "./route-form";

export function RoutesClient() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RouteRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyData = useCallback((routeData: RouteRecord[], providerData: ProviderConnection[]) => { setRoutes(routeData); setProviders(providerData); }, []);
  const load = useCallback(async () => { const [routeData, providerData] = await Promise.all([manageFetch<RouteRecord[]>("routes"), manageFetch<ProviderConnection[]>("providers")]); applyData(routeData, providerData); }, [applyData]);

  useEffect(() => {
    let active = true;
    void Promise.all([manageFetch<RouteRecord[]>("routes"), manageFetch<ProviderConnection[]>("providers")])
      .then(([routeData, providerData]) => { if (active) applyData(routeData, providerData); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Routes could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyData]);

  async function remove(route: RouteRecord) {
    if (!window.confirm(`Delete Route ${route.name}? Revoke keys bound to it first.`)) return;
    try { await manageFetch(`routes/${route.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Route could not be deleted."); }
  }

  return (
    <div className="sr-stack route-page">
      <div className="sr-page-header"><div><p className="sr-kicker">03 / REQUEST SELECTION</p><h1>Routes</h1><p>An ordered provider/model priority stack. One request goes to one target; fallback moves downward only when needed.</p></div><Button disabled={loading || !providers.length} onClick={() => setEditing("new")}>Create Route</Button></div>
      {error && <div className="sr-error">{error}</div>}
      {loading ? <div className="dashboard-loading"><span className="sr-kicker">ROUTING TABLE</span><strong>Loading Routes and available models…</strong><div className="loading-line" /></div> : <>
        {!providers.length && <div className="inline-guidance"><span>Before a Route can exist</span><strong>Connect and validate a provider.</strong></div>}
        {editing && <RouteForm providers={providers} route={editing === "new" ? undefined : editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
        {!routes.length && !editing ? <EmptyState title="No Routes yet" body="Create a short priority stack from your connected provider models." action={<Button disabled={!providers.length} onClick={() => setEditing("new")}>Create first Route</Button>} /> : <div className="route-list">{routes.map((route) => <section className="route-record" key={route.id}><div className="route-record-head"><div><div className="sr-row"><StatusDot status={route.enabled ? "active" : "revoked"} /><h2>{route.name}</h2><Badge>{route.strategy === "free_first" ? "FREE FIRST" : "PRIORITY"}</Badge></div><p><span className="sr-mono">/{route.slug}</span> · {route.targets.length} target{route.targets.length === 1 ? "" : "s"}</p></div><div className="sr-row"><Button className="sr-button-secondary" onClick={() => setEditing(route)}>Edit</Button><Button className="sr-button-danger" onClick={() => remove(route)}>Delete</Button></div></div><ol className="route-preview">{[...route.targets].sort((a,b) => (a.position ?? 0) - (b.position ?? 0)).map((target) => { const provider = providers.find((item) => item.id === target.provider_connection_id); return <li key={target.id ?? `${target.provider_connection_id}-${target.model_id}`}><span>{provider?.display_name ?? "Provider"} / {target.model_id}</span><Badge tone={target.billing_tier === "paid" ? "warning" : "success"}>{target.billing_tier.replace("_", " ")}</Badge></li>; })}</ol></section>)}</div>}
      </>}
    </div>
  );
}
