"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge, EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Card, PageHeader, SectionHeader } from "@/components/ui/surface";
import type { ProviderConnection, ProviderKind } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { PROVIDER_CATALOG, providerMeta } from "./catalog";
import { ProviderConnectForm } from "./provider-connect-form";

type ConnectableKind = Exclude<ProviderKind, "test">;

export function ProvidersClient() {
  const [providers, setProviders] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKind, setSelectedKind] = useState<ConnectableKind | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await manageFetch<ProviderConnection[]>("providers");
      setProviders(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Providers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    manageFetch<ProviderConnection[]>("providers")
      .then((result) => {
        if (cancelled) return;
        setProviders(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Providers could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const catalog = useMemo(() => PROVIDER_CATALOG.filter((provider) => `${provider.name} ${provider.company} ${provider.description}`.toLowerCase().includes(query.toLowerCase())), [query]);

  async function test(provider: ProviderConnection) {
    setBusyId(provider.id); setError(null);
    try { await manageFetch(`providers/${provider.id}/test`, { method: "POST", body: "{}" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Provider test failed."); }
    finally { setBusyId(null); }
  }

  async function disconnect(provider: ProviderConnection) {
    if (!window.confirm(`Disconnect ${provider.display_name}? Waterfalls using it must be changed first.`)) return;
    setBusyId(provider.id); setError(null);
    try { await manageFetch(`providers/${provider.id}`, { method: "DELETE" }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Provider could not be disconnected."); }
    finally { setBusyId(null); }
  }

  return <div>
    <PageHeader title="Providers" eyebrow="Connections" description="Store provider credentials once, validate them, and use discovered models in any waterfall." action={<Button onClick={() => setSelectedKind("openai")}><Icon name="plus" className="size-4"/>Connect provider</Button>} />
    {error && <div className="mb-4"><Retry message={error} onRetry={() => void load()} /></div>}
    <Card className="mb-5 overflow-hidden">
      <SectionHeader title="Provider catalog" description={`${PROVIDER_CATALOG.length} direct adapters available in this build.`} action={<div className="relative w-52"><Icon name="search" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[var(--muted-foreground)]"/><Input aria-label="Search providers" className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search providers"/></div>} />
      <div className="grid border-t border-[var(--border)] sm:grid-cols-2 xl:grid-cols-4">{catalog.map((provider, index) => <button key={provider.kind} type="button" onClick={() => setSelectedKind(provider.kind)} className={`group min-h-36 p-4 text-left transition hover:bg-[var(--surface-hover)] ${index % 4 !== 3 ? "xl:border-r xl:border-[var(--border)]" : ""} border-b border-[var(--border)] sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(odd)]:border-[var(--border)]`}><div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-xs font-semibold">{provider.mark}</span><Icon name="chevron" className="size-4 text-[var(--muted-foreground)] transition group-hover:translate-x-0.5"/></div><strong className="mt-4 block text-sm">{provider.name}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">{provider.description}</p></button>)}</div>
    </Card>
    <Card className="overflow-hidden"><SectionHeader title="Connected accounts" description="Credentials are write-only after they are saved." /><div className="border-t border-[var(--border)]">{loading ? <div className="p-4"><LoadingBlock label="Loading providers"/></div> : !providers.length ? <div className="p-4"><EmptyState title="No provider keys yet" description="Choose any provider above and add an API key. You can connect more than one account per provider." /></div> : <div className="divide-y divide-[var(--border)]">{providers.map((provider) => { const meta = providerMeta(provider.provider_kind); const models = provider.metadata.models ?? []; return <div key={provider.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.4fr)_110px_170px_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-xs font-semibold">{meta?.mark ?? provider.provider_kind.slice(0,2).toUpperCase()}</span><div className="min-w-0"><div className="flex items-center gap-2"><StatusDot status={provider.status}/><strong className="truncate text-sm">{provider.display_name}</strong><Badge tone={provider.status === "healthy" ? "success" : provider.status === "invalid" ? "danger" : "warning"}>{provider.status}</Badge></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{meta?.name ?? provider.provider_kind}</p></div></div><div><strong className="block text-sm">{models.length}</strong><span className="text-xs text-[var(--muted-foreground)]">models</span></div><div><strong className="block text-xs font-medium">{provider.last_validated_at ? new Date(provider.last_validated_at).toLocaleDateString() : "Never"}</strong><span className="text-xs text-[var(--muted-foreground)]">last validation</span></div><div className="flex justify-end gap-1.5"><Button variant="secondary" size="sm" disabled={busyId === provider.id} onClick={() => void test(provider)}><Icon name="refresh" className="size-3.5"/>{busyId === provider.id ? "Testing" : "Test"}</Button><Button variant="danger" size="sm" disabled={busyId === provider.id} onClick={() => void disconnect(provider)}><Icon name="trash" className="size-3.5"/></Button></div></div>; })}</div>}</div></Card>
    {selectedKind && <Drawer title={`Connect ${providerMeta(selectedKind)?.name ?? "provider"}`} description="Validate the key and discover models before saving." onClose={() => setSelectedKind(null)}><ProviderConnectForm initialKind={selectedKind} onConnected={(provider) => { setProviders((current) => [...current, provider]); setSelectedKind(null); }} /></Drawer>}
  </div>;
}
