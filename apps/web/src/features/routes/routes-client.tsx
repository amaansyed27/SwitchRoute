"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/surface";
import type { ProviderConnection, RouteRecord } from "@/features/shared/types";
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

  return <div>
    <PageHeader title="Waterfalls" description="An ordered set of models behind one endpoint. Each waterfall has its own spending rules." action={<Button disabled={loading || !canCreate} onClick={() => setEditing("new")}><Icon name="plus" className="size-4"/>New waterfall</Button>}/>
    {error && <div className="mb-6"><Retry message={error} onRetry={() => void load()}/></div>}
    {loading ? <LoadingBlock label="Loading waterfalls"/> : !canCreate ? <EmptyState title="Start with a provider" description="Connect a provider account to choose the models for your first waterfall." action={<Link href="/providers" className={buttonClass()}>Connect provider</Link>}/> : !routes.length ? <EmptyState title="Create your first waterfall" description="Choose a model, add a backup, and set your spending permissions." action={<Button onClick={() => setEditing("new")}>New waterfall</Button>}/> : <div className="space-y-5">{routes.map((route) => <section key={route.id} className="border border-[var(--border)] bg-[var(--surface)]">
      <header className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6"><div><div className="flex items-center gap-3"><StatusDot status={route.enabled ? "active" : "revoked"}/><h2 className="text-lg font-semibold tracking-tight">{route.name}</h2><span className="text-xs text-[var(--muted-foreground)]">{route.enabled ? "Enabled" : "Paused"}</span></div><p className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">{route.slug}</p></div><div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => setEditing(route)}>Edit waterfall</Button><Button variant="ghost" size="sm" aria-label={`Delete ${route.name}`} onClick={() => void remove(route)}>Delete</Button></div></header>
      <ol className="grid divide-y divide-[var(--border)] border-y border-[var(--border)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">{[...route.targets].sort((a,b) => (a.position ?? 0) - (b.position ?? 0)).map((target,index) => { const provider = providers.find((item) => item.id === target.provider_connection_id); return <li key={target.id ?? index} className="flex min-w-0 gap-4 px-5 py-5"><span className="pt-1 font-mono text-xs text-[var(--muted-foreground)]">{String(index+1).padStart(2,"0")}</span><div className="min-w-0"><p className="text-xs text-[var(--muted-foreground)]">{provider?.display_name ?? "Unavailable account"}</p><p className="mt-1 break-all text-sm font-medium">{target.model_id}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">{target.billing_tier === "free_capable" ? "Account-dependent" : target.billing_tier === "unknown" ? "Price unverified" : target.billing_tier === "free" ? "Free" : "Paid"}</p></div></li>; })}</ol>
      <footer className="flex flex-wrap justify-between gap-3 bg-[var(--surface-muted)] px-5 py-3 text-xs"><span className="capitalize">{route.strategy.replaceAll("_", " ")} strategy</span><span className="text-[var(--muted-foreground)]">{route.paid_fallback === "never" ? "Paid requests blocked" : route.paid_fallback === "after_free" ? "Paid fallback after free capacity" : "Paid requests allowed"}{route.daily_paid_cap_microusd != null ? ` · $${route.daily_paid_cap_microusd / 1_000_000} daily cap` : ""}</span></footer>
    </section>)}</div>}
    {editing && <Drawer wide title={editing === "new" ? "New waterfall" : `Edit ${editing.name}`} description="Choose models and decide how requests move between them." onClose={() => setEditing(null)}><RouteForm providers={providers} route={editing === "new" ? undefined : editing} onSaved={async () => { setEditing(null); await load(); }}/></Drawer>}
  </div>;
}
