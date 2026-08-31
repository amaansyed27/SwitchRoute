"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Input, Label } from "@switchroute/ui";
import type { RouteRecord, VirtualKey } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

type CreatedKey = VirtualKey & { key: string; shown_once: boolean };

export function KeysClient() {
  const [keys, setKeys] = useState<VirtualKey[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("Default");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyData = useCallback((keyData: VirtualKey[], routeData: RouteRecord[]) => {
    const activeRoutes = routeData.filter((route) => route.enabled);
    setKeys(keyData);
    setRoutes(activeRoutes);
    setRouteId((current) => current || activeRoutes[0]?.id || "");
  }, []);

  const load = useCallback(async () => {
    const [keyData, routeData] = await Promise.all([
      manageFetch<VirtualKey[]>("keys"),
      manageFetch<RouteRecord[]>("routes"),
    ]);
    applyData(keyData, routeData);
  }, [applyData]);

  useEffect(() => {
    let active = true;
    void Promise.all([manageFetch<VirtualKey[]>("keys"), manageFetch<RouteRecord[]>("routes")])
      .then(([keyData, routeData]) => { if (active) applyData(keyData, routeData); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "API keys could not be loaded."); });
    return () => { active = false; };
  }, [applyData]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError(null);
    try {
      const result = await manageFetch<CreatedKey>("keys", { method: "POST", body: JSON.stringify({ route_id: routeId, environment, name }) });
      setCreated(result); setAdding(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "API key could not be created."); }
  }

  async function revoke(key: VirtualKey) {
    if (!window.confirm(`Revoke ${key.name}? Requests using it will stop immediately.`)) return;
    try { await manageFetch(`keys/${key.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "API key could not be revoked."); }
  }

  return (
    <div className="sr-stack" style={{ gap: 26 }}>
      <div className="sr-page-header"><div><p className="sr-kicker">ROUTE-BOUND ACCESS</p><h1>API Keys</h1><p>Each SwitchRoute key is attached to one Route. The full secret is shown once and is never recoverable afterward.</p></div><Button disabled={!routes.length} onClick={() => setAdding(true)}>Create API key</Button></div>
      {error && <div className="sr-error">{error}</div>}
      {created && <section className="sr-panel sr-panel-paper"><p className="sr-kicker">COPY THIS NOW</p><h2 style={{ marginTop: 0 }}>Your key will not be shown again.</h2><div className="key-secret"><code>{created.key}</code><Button onClick={() => navigator.clipboard.writeText(created.key)}>Copy</Button></div><Button className="sr-button-secondary" style={{ color: "var(--sr-ink)", borderColor: "#b9b2a4", marginTop: 12 }} onClick={() => setCreated(null)}>I saved it</Button></section>}
      {adding && <form className="sr-panel sr-form-grid" onSubmit={create}><div className="sr-between"><h2 style={{ margin: 0 }}>Create a route-bound key</h2><Button type="button" className="sr-button-secondary" onClick={() => setAdding(false)}>Close</Button></div><div className="sr-field"><Label htmlFor="key-name">Name</Label><Input id="key-name" required value={name} onChange={(event) => setName(event.target.value)} /></div><div className="sr-field"><Label htmlFor="key-route">Route</Label><select id="key-route" className="sr-select" value={routeId} onChange={(event) => setRouteId(event.target.value)}>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></div><div className="sr-field"><Label htmlFor="key-env">Environment</Label><select id="key-env" className="sr-select" value={environment} onChange={(event) => setEnvironment(event.target.value as "live" | "test")}><option value="live">Live · sr_live_…</option><option value="test">Test · sr_test_…</option></select></div><Button disabled={!routeId || !name.trim()}>Generate key</Button></form>}
      {!keys.length && !adding ? <EmptyState title="No SwitchRoute keys" body="Create a key after you have an active Route." action={<Button disabled={!routes.length} onClick={() => setAdding(true)}>Create first key</Button>} /> : <div className="sr-stack">{keys.map((key) => <section className="sr-panel" key={key.id}><div className="sr-between"><div><div className="sr-row"><h2 style={{ margin: 0, fontSize: 19 }}>{key.name}</h2><Badge tone={key.status === "active" ? "success" : "danger"}>{key.status}</Badge><Badge>{key.environment}</Badge></div><p className="sr-mono" style={{ color: "var(--sr-muted)", fontSize: 13 }}>{key.prefix}••••••••</p><small style={{ color: "var(--sr-muted)" }}>{key.route_name} · last used {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never"}</small></div>{key.status === "active" && <Button className="sr-button-danger" onClick={() => revoke(key)}>Revoke</Button>}</div></section>)}</div>}
    </div>
  );
}
