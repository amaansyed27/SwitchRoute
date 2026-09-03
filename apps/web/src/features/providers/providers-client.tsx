"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge, EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Card, PageHeader, SectionHeader } from "@/components/ui/surface";
import type { ProviderCatalogEntry, ProviderConnection } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { PROVIDER_CATEGORIES, providerMeta } from "./catalog";
import { ProviderConnectForm } from "./provider-connect-form";

export function ProvidersClient() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [providerResult, catalogResult] = await Promise.all([
        manageFetch<ProviderConnection[]>("providers"),
        manageFetch<ProviderCatalogEntry[]>("provider-catalog"),
      ]);
      setProviders(providerResult);
      setCatalog(catalogResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Providers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      manageFetch<ProviderConnection[]>("providers"),
      manageFetch<ProviderCatalogEntry[]>("provider-catalog"),
    ])
      .then(([providerResult, catalogResult]) => {
        if (cancelled) return;
        setProviders(providerResult);
        setCatalog(catalogResult);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Providers could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      catalog.filter((provider) =>
        `${provider.display_name} ${provider.company} ${provider.description}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [catalog, query],
  );
  const selected = selectedKind ? providerMeta(catalog, selectedKind) : undefined;

  async function test(provider: ProviderConnection) {
    setBusyId(provider.id);
    setError(null);
    try {
      await manageFetch(`providers/${provider.id}/test`, { method: "POST", body: "{}" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider test failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(provider: ProviderConnection) {
    if (!window.confirm(`Disconnect ${provider.display_name}? Routes using it must be changed first.`)) return;
    setBusyId(provider.id);
    setError(null);
    try {
      await manageFetch(`providers/${provider.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provider could not be disconnected.");
    } finally {
      setBusyId(null);
    }
  }

  return <div>
    <PageHeader title="Providers" eyebrow="Connections" description="Store hosted provider credentials once, validate them, and use discovered models in any Route." action={<Button disabled={!catalog.length} onClick={() => setSelectedKind(catalog[0]?.id ?? null)}><Icon name="plus" className="size-4"/>Connect provider</Button>} />
    {error && <div className="mb-4"><Retry message={error} onRetry={() => void load()} /></div>}
    <Card className="mb-5 overflow-hidden">
      <SectionHeader title="Provider catalog" description={loading ? "Loading supported providers…" : `${catalog.length} hosted connection types from the gateway catalog.`} action={<div className="relative w-52"><Icon name="search" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[var(--muted-foreground)]"/><Input aria-label="Search providers" className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search providers"/></div>} />
      <div className="border-t border-[var(--border)]">
        {loading ? <div className="p-4"><LoadingBlock label="Loading provider catalog"/></div> : PROVIDER_CATEGORIES.map((category) => {
          const items = filtered.filter((provider) => provider.category === category.id);
          if (!items.length) return null;
          return <section key={category.id} className="border-b border-[var(--border)] last:border-b-0"><div className="flex items-baseline justify-between gap-4 px-4 py-3"><div><strong className="text-xs uppercase tracking-[0.14em]">{category.label}</strong><p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{category.description}</p></div><span className="font-mono text-xs text-[var(--muted-foreground)]">{items.length}</span></div><div className="grid border-t border-[var(--border)] sm:grid-cols-2 xl:grid-cols-3">{items.map((provider) => <button key={provider.id} type="button" onClick={() => setSelectedKind(provider.id)} className="group min-h-32 border-b border-r border-[var(--border)] p-4 text-left transition hover:bg-[var(--surface-hover)]"><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-xs font-semibold">{provider.mark}</span><Icon name="chevron" className="size-4 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5"/></div><strong className="mt-3 block text-sm">{provider.display_name}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">{provider.description}</p></button>)}</div></section>;
        })}
      </div>
    </Card>
    <Card className="overflow-hidden"><SectionHeader title="Connected accounts" description="Credentials are write-only after they are saved." /><div className="border-t border-[var(--border)]">{loading ? <div className="p-4"><LoadingBlock label="Loading providers"/></div> : !providers.length ? <div className="p-4"><EmptyState title="No provider keys yet" description="Choose any provider above and add an API key. You can connect more than one account per provider." /></div> : <div className="divide-y divide-[var(--border)]">{providers.map((provider) => { const meta = providerMeta(catalog, provider.provider_kind); const models = provider.metadata.models ?? []; return <div key={provider.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.4fr)_110px_170px_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-xs font-semibold">{meta?.mark ?? provider.provider_kind.slice(0,2).toUpperCase()}</span><div className="min-w-0"><div className="flex items-center gap-2"><StatusDot status={provider.status}/><strong className="truncate text-sm">{provider.display_name}</strong><Badge tone={provider.status === "healthy" ? "success" : provider.status === "invalid" ? "danger" : "warning"}>{provider.status}</Badge></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{meta?.display_name ?? provider.provider_kind}</p></div></div><div><strong className="block text-sm">{models.length}</strong><span className="text-xs text-[var(--muted-foreground)]">models</span></div><div><strong className="block text-xs font-medium">{provider.last_validated_at ? new Date(provider.last_validated_at).toLocaleDateString() : "Never"}</strong><span className="text-xs text-[var(--muted-foreground)]">last validation</span></div><div className="flex justify-end gap-1.5"><Button variant="secondary" size="sm" disabled={busyId === provider.id} onClick={() => void test(provider)}><Icon name="refresh" className="size-3.5"/>{busyId === provider.id ? "Testing" : "Test"}</Button><Button variant="danger" size="sm" disabled={busyId === provider.id} onClick={() => void disconnect(provider)}><Icon name="trash" className="size-3.5"/></Button></div></div>; })}</div>}</div></Card>
    {selected && <Drawer title={`Connect ${selected.display_name}`} description="Validate the credential and discover models before saving." onClose={() => setSelectedKind(null)}><ProviderConnectForm provider={selected} onConnected={(provider) => { setProviders((current) => [...current, provider]); setSelectedKind(null); }} /></Drawer>}
  </div>;
}
