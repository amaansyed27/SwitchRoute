"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, Input, Label } from "@switchroute/ui";
import type { RouteRecord, VirtualKey } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

type CreatedKey = VirtualKey & { key: string; shown_once: boolean };

export function KeysClient() {
  const [keys, setKeys] = useState<VirtualKey[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [name, setName] = useState("Default");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyData = useCallback((keyData: VirtualKey[], routeData: RouteRecord[]) => { const activeRoutes = routeData.filter((route) => route.enabled); setKeys(keyData); setRoutes(activeRoutes); setRouteId((current) => current || activeRoutes[0]?.id || ""); }, []);
  const load = useCallback(async () => { const [keyData, routeData] = await Promise.all([manageFetch<VirtualKey[]>("keys"), manageFetch<RouteRecord[]>("routes")]); applyData(keyData, routeData); }, [applyData]);

  useEffect(() => {
    let active = true;
    void Promise.all([manageFetch<VirtualKey[]>("keys"), manageFetch<RouteRecord[]>("routes")])
      .then(([keyData, routeData]) => { if (active) applyData(keyData, routeData); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "API keys could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyData]);

  async function create(event: FormEvent) { event.preventDefault(); setError(null); try { const result = await manageFetch<CreatedKey>("keys", { method: "POST", body: JSON.stringify({ route_id: routeId, environment, name }) }); setCreated(result); setAdding(false); await load(); } catch (err) { setError(err instanceof Error ? err.message : "API key could not be created."); } }
  async function revoke(key: VirtualKey) { if (!window.confirm(`Revoke ${key.name}? Requests using it will stop immediately.`)) return; try { await manageFetch(`keys/${key.id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "API key could not be revoked."); } }

  return (
    <div className="sr-stack key-page">
      <div className="sr-page-header"><div><p className="sr-kicker">04 / ROUTE-BOUND ACCESS</p><h1>API Keys</h1><p>Every SwitchRoute key belongs to one Route and one environment. Full secrets are displayed exactly once.</p></div><Button disabled={loading || !routes.length} onClick={() => setAdding(true)}>Create API key</Button></div>
      {error && <div className="sr-error">{error}</div>}
      {created && <section className="secret-reveal"><div><p className="sr-kicker">COPY ONCE</p><h2>Your new key will disappear when you leave this state.</h2><p>Store it in your application secret manager now. SwitchRoute cannot recover it later.</p></div><div className="key-secret"><code>{created.key}</code><Button onClick={() => navigator.clipboard.writeText(created.key)}>Copy key</Button></div><Button className="sr-button-secondary secret-dismiss" onClick={() => setCreated(null)}>I saved it</Button></section>}
      {adding && <form className="key-create-form" onSubmit={create}><div className="provider-connect-head"><div><p className="sr-kicker">NEW KEY</p><h2>Bind access to a Route</h2><p>Choose where requests should go and whether this credential is for live or test traffic.</p></div><Button type="button" className="sr-button-secondary" onClick={() => setAdding(false)}>Close</Button></div><div className="key-form-grid"><div className="sr-field"><Label htmlFor="key-name">Name</Label><Input id="key-name" required value={name} onChange={(event) => setName(event.target.value)} /></div><div className="sr-field"><Label htmlFor="key-route">Route</Label><select id="key-route" className="sr-select" value={routeId} onChange={(event) => setRouteId(event.target.value)}>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></div><div className="sr-field"><Label htmlFor="key-env">Environment</Label><select id="key-env" className="sr-select" value={environment} onChange={(event) => setEnvironment(event.target.value as "live" | "test")}><option value="live">Live · sr_live_…</option><option value="test">Test · sr_test_…</option></select></div></div><Button disabled={!routeId || !name.trim()}>Generate key</Button></form>}
      {loading ? <div className="dashboard-loading"><span className="sr-kicker">CREDENTIALS</span><strong>Loading route-bound keys…</strong><div className="loading-line" /></div> : !keys.length && !adding ? <EmptyState title="No SwitchRoute keys" body="Create a key after you have an active Route." action={<Button disabled={!routes.length} onClick={() => setAdding(true)}>Create first key</Button>} /> : <div className="key-list"><div className="list-caption key-caption"><span>Key</span><span>Route</span><span>Last used</span><span>Action</span></div>{keys.map((key) => <section className="key-row" key={key.id}><div><div className="sr-row"><strong>{key.name}</strong><Badge tone={key.status === "active" ? "success" : "danger"}>{key.status}</Badge><Badge>{key.environment}</Badge></div><span className="sr-mono">{key.prefix}••••••••</span></div><div><strong>{key.route_name}</strong><span>bound route</span></div><div><strong>{key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}</strong><span>{key.last_used_at ? new Date(key.last_used_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "no traffic"}</span></div><div>{key.status === "active" && <Button className="sr-button-danger" onClick={() => revoke(key)}>Revoke</Button>}</div></section>)}</div>}
    </div>
  );
}
