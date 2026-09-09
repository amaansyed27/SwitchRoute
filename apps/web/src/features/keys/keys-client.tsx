"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Alert, Badge, EmptyState, LoadingBlock, Retry } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Card, PageHeader, SectionHeader } from "@/components/ui/surface";
import type { RouteRecord, VirtualKey } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

type CreatedKey = VirtualKey & { key: string; shown_once: boolean };

export function KeysClient() {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keys, setKeys] = useState<VirtualKey[]>([]); const [routes, setRoutes] = useState<RouteRecord[]>([]); const [loading, setLoading] = useState(true); const [adding, setAdding] = useState(false); const [routeId, setRouteId] = useState(""); const [name, setName] = useState("Production"); const [environment, setEnvironment] = useState<"live" | "test">("live"); const [created, setCreated] = useState<CreatedKey | null>(null); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [keyData, routeData] = await Promise.all([manageFetch<VirtualKey[]>("keys"), manageFetch<RouteRecord[]>("routes")]);
      const active = routeData.filter((route) => route.enabled);
      setKeys(keyData); setRoutes(active); setRouteId((current) => current || active[0]?.id || ""); setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API keys could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([manageFetch<VirtualKey[]>("keys"), manageFetch<RouteRecord[]>("routes")])
      .then(([keyData, routeData]) => {
        if (cancelled) return;
        const active = routeData.filter((route) => route.enabled);
        setKeys(keyData);
        setRoutes(active);
        setRouteId((current) => current || active[0]?.id || "");
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "API keys could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  async function create(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(null); try { const result = await manageFetch<CreatedKey>("keys", { method: "POST", body: JSON.stringify({ route_id: routeId, environment, name }) }); setCreated(result); setCopied(false); setAdding(false); await load(); } catch (err) { setError(err instanceof Error ? err.message : "API key could not be created."); } finally { setBusy(false); } }
  async function revoke(key: VirtualKey) { if (!window.confirm(`Revoke ${key.name}? Requests using it will stop immediately.`)) return; try { await manageFetch(`keys/${key.id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "API key could not be revoked."); } }
  return <div><PageHeader title="API keys" eyebrow="API keys" description="Give each application its own key, bound to the waterfall it should use." action={<Button disabled={loading || !routes.length} onClick={() => setAdding(true)}><Icon name="plus" className="size-4"/>Create key</Button>}/>{error && <div className="mb-4"><Retry message={error} onRetry={() => void load()}/></div>}{created && <Card className="mb-5 overflow-hidden border-[color-mix(in_srgb,var(--accent)_35%,var(--border))]"><div className="p-4"><Badge tone="accent">Copy now</Badge><h2 className="mt-3 text-base font-semibold">New key created</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">SwitchRoute cannot recover this secret after you dismiss it.</p><div className="mt-4 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all px-2 font-mono text-xs">{created.key}</code><Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(created.key); setCopied(true); } catch { setError("Clipboard unavailable. Select and copy the key manually."); } }}><Icon name="copy" className="size-3.5"/>{copied ? "Copied" : "Copy"}</Button></div><div className="mt-3 flex justify-end"><Button variant="ghost" size="sm" onClick={() => setCreated(null)}>I saved it</Button></div></div></Card>}{loading ? <LoadingBlock label="Loading API keys"/> : !routes.length ? <EmptyState title="Create a waterfall first" description="Every SwitchRoute API key is bound to one active waterfall." action={<Link href="/routes" className={buttonClass({ size: "sm" })}>Open waterfalls</Link>}/> : !keys.length ? <EmptyState title="No API keys" description="Create a live or test key and bind it to one waterfall." action={<Button size="sm" onClick={() => setAdding(true)}>Create key</Button>}/> : <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"><SectionHeader title="Your keys" description={`${keys.filter((key) => key.status === "active").length} active. Revoke a key any time to stop its requests.`}/><div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{keys.map((key) => <article key={key.id} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center"><div className="flex min-w-0 items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--surface-muted)]"><Icon name="key" className="size-5"/></span><div className="min-w-0"><h2 className="truncate text-base font-medium">{key.name}</h2><code className="mt-1 block text-xs text-[var(--muted-foreground)]">{key.prefix}••••••••</code></div></div><div><p className="text-sm">{key.route_name} <span className="ml-2 text-xs text-[var(--muted-foreground)]">/ {key.environment}</span></p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleString()}` : "Not used yet"}</p></div><div className="flex items-center gap-4"><Badge tone={key.status === "active" ? "success" : "neutral"}>{key.status}</Badge>{key.status === "active" && <Button variant="ghost" size="sm" aria-label={`Revoke ${key.name}`} onClick={() => void revoke(key)}>Revoke</Button>}</div></article>)}</div></section>}{adding && <Drawer title="Create API key" description="Bind this credential to one waterfall and environment." onClose={() => setAdding(false)}><form onSubmit={create} className="space-y-5"><Field label="Key name" htmlFor="key-name"><Input id="key-name" required value={name} onChange={(event) => setName(event.target.value)}/></Field><Field label="Waterfall" htmlFor="key-route"><Select id="key-route" value={routeId} onChange={(event) => setRouteId(event.target.value)}>{routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</Select></Field><Field label="Environment" htmlFor="key-env" hint={environment === "live" ? "Creates an sr_live_… credential." : "Creates an sr_test_… credential."}><Select id="key-env" value={environment} onChange={(event) => setEnvironment(event.target.value as "live" | "test")}><option value="live">Live</option><option value="test">Test</option></Select></Field>{error && <Alert>{error}</Alert>}<div className="flex justify-end border-t border-[var(--border)] pt-4"><Button type="submit" disabled={busy || !routeId || !name.trim()}>{busy ? "Generating…" : "Generate key"}</Button></div></form></Drawer>}</div>;
}
