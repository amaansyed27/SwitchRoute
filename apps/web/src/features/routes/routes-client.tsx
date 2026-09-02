"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge, EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Card, PageHeader } from "@/components/ui/surface";
import type { ProviderConnection, RouteRecord } from "@/features/shared/types";
import { providerMeta } from "@/features/providers/catalog";
import { manageFetch } from "@/lib/gateway/manage";
import { RouteForm } from "./route-form";

export function RoutesClient() {
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RouteRecord | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [routeData, providerData] = await Promise.all([manageFetch<RouteRecord[]>("routes"), manageFetch<ProviderConnection[]>("providers")]);
      setRoutes(routeData); setProviders(providerData); setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Waterfalls could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([manageFetch<RouteRecord[]>("routes"), manageFetch<ProviderConnection[]>("providers")])
      .then(([routeData, providerData]) => {
        if (cancelled) return;
        setRoutes(routeData);
        setProviders(providerData);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Waterfalls could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);
  async function remove(route: RouteRecord) { if (!window.confirm(`Delete ${route.name}? Revoke keys bound to it first.`)) return; try { await manageFetch(`routes/${route.id}`, { method: "DELETE" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Waterfall could not be deleted."); } }
  const canCreate = providers.some((provider) => provider.metadata.models?.length);

  return <div><PageHeader title="Waterfalls" eyebrow="Routing" description="Order provider/model targets once. Requests move down the waterfall only when a higher target is unavailable or ineligible." action={<Button disabled={loading || !canCreate} onClick={() => setEditing("new")}><Icon name="plus" className="size-4"/>New waterfall</Button>}/>{error && <div className="mb-4"><Retry message={error} onRetry={() => void load()}/></div>}{loading ? <LoadingBlock label="Loading waterfalls"/> : !canCreate ? <EmptyState title="Connect a provider first" description="A waterfall needs at least one validated provider with discovered models." action={<Link className={buttonClass({ size: "sm" })} href="/providers">Open providers</Link>}/> : !routes.length ? <EmptyState title="No waterfalls yet" description="Create a waterfall and drag provider/model targets into the fallback order you want." action={<Button size="sm" onClick={() => setEditing("new")}>Create waterfall</Button>}/> : <div className="grid gap-3 xl:grid-cols-2">{routes.map((route) => <Card key={route.id} className="overflow-hidden"><div className="flex items-start justify-between gap-4 p-4"><div className="min-w-0"><div className="flex items-center gap-2"><StatusDot status={route.enabled ? "active" : "revoked"}/><h2 className="truncate text-sm font-semibold">{route.name}</h2><Badge tone={route.strategy === "free_first" ? "success" : "neutral"}>{route.strategy === "free_first" ? "free first" : "priority"}</Badge></div><p className="mt-1 font-mono text-[11px] text-[var(--muted-foreground)]">/{route.slug} · {route.targets.length} target{route.targets.length === 1 ? "" : "s"}</p></div><div className="flex gap-1"><Button variant="secondary" size="sm" onClick={() => setEditing(route)}>Edit</Button><Button variant="danger" size="sm" onClick={() => void remove(route)}><Icon name="trash" className="size-3.5"/></Button></div></div><ol className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{[...route.targets].sort((a,b) => (a.position ?? 0) - (b.position ?? 0)).map((target, index) => { const provider = providers.find((item) => item.id === target.provider_connection_id); return <li key={target.id ?? `${target.provider_connection_id}-${target.model_id}`} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"><span className="font-mono text-[10px] text-[var(--muted-foreground)]">{String(index + 1).padStart(2,"0")}</span><div className="min-w-0"><strong className="block truncate text-xs font-medium">{providerMeta(provider?.provider_kind ?? "")?.name ?? provider?.display_name ?? "Provider"}</strong><span className="block truncate font-mono text-[11px] text-[var(--muted-foreground)]">{target.model_id}</span></div><Badge tone={target.billing_tier === "paid" ? "warning" : "success"}>{target.billing_tier.replace("_"," ")}</Badge></li>; })}</ol></Card>)}</div>}{editing && <Drawer wide title={editing === "new" ? "New waterfall" : `Edit ${editing.name}`} description="Configure routing order and fallback behavior." onClose={() => setEditing(null)}><RouteForm providers={providers} route={editing === "new" ? undefined : editing} onSaved={async () => { setEditing(null); await load(); }}/></Drawer>}</div>;
}
