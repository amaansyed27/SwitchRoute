"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Card, PageHeader, SectionHeader, Stat } from "@/components/ui/surface";
import { manageFetch } from "@/lib/gateway/manage";
import type { ActivityRecord, ProviderConnection } from "@/features/shared/types";
import { providerMeta } from "@/features/providers/catalog";

type Summary = { providers: ProviderConnection[]; healthy_providers: number; active_routes: number; requests_24h: number; cost_24h_microusd: number; recent_activity: ActivityRecord[]; };

export function DashboardClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const result = await manageFetch<Summary>("dashboard");
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Overview could not be loaded.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <div>
    <PageHeader title="Overview" eyebrow="Workspace" description="Provider health, active waterfalls, and request activity at a glance." action={<div className="flex gap-2"><Link className={buttonClass({ variant: "secondary", size: "sm" })} href="/providers"><Icon name="plus" className="size-3.5"/>Provider</Link><Link className={buttonClass({ size: "sm" })} href="/routes"><Icon name="waterfall" className="size-3.5"/>New waterfall</Link></div>} />
    {error && <Retry message={error} onRetry={() => void load()} />}
    {!data && !error ? <LoadingBlock label="Loading overview"/> : data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Healthy providers" value={`${data.healthy_providers}/${data.providers.length}`} detail="validated upstream connections"/><Stat label="Active waterfalls" value={data.active_routes} detail="available for routing"/><Stat label="Requests · 24h" value={data.requests_24h} detail="metadata-only request count"/><Stat label="Provider spend · 24h" value={`$${(data.cost_24h_microusd / 1_000_000).toFixed(3)}`} detail="reported provider cost"/></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden"><SectionHeader title="Providers" description="Current upstream health." action={<Link href="/providers" className="text-xs font-medium text-[var(--accent)]">Manage</Link>}/><div className="border-t border-[var(--border)]">{!data.providers.length ? <div className="p-4"><EmptyState title="No providers connected" description="Add a provider API key to start building waterfalls." action={<Link className={buttonClass({ size: "sm" })} href="/providers">Add provider</Link>}/></div> : <div className="divide-y divide-[var(--border)]">{data.providers.slice(0,6).map((provider) => <div key={provider.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] font-mono text-[10px] font-semibold">{providerMeta(provider.provider_kind)?.mark ?? "AI"}</span><div className="min-w-0"><strong className="block truncate text-sm">{provider.display_name}</strong><span className="text-xs text-[var(--muted-foreground)]">{providerMeta(provider.provider_kind)?.name ?? provider.provider_kind}</span></div></div><div className="flex items-center gap-2"><StatusDot status={provider.status}/><span className="text-xs capitalize text-[var(--muted-foreground)]">{provider.status}</span></div></div>)}</div>}</div></Card>
        <Card className="overflow-hidden"><SectionHeader title="Recent activity" description="No prompts or completions are stored." action={<Link href="/activity" className="text-xs font-medium text-[var(--accent)]">View all</Link>}/><div className="border-t border-[var(--border)]">{!data.recent_activity.length ? <div className="p-4"><EmptyState title="No requests yet" description="Requests will appear here after a SwitchRoute key starts sending traffic." /></div> : <div className="divide-y divide-[var(--border)]">{data.recent_activity.slice(0,7).map((item) => <div key={item.request_id} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><strong className="truncate text-sm">{item.route_name}</strong><Badge tone={item.status === "success" ? "success" : "danger"}>{item.status}</Badge></div><p className="mt-1 truncate font-mono text-[11px] text-[var(--muted-foreground)]">{item.provider_kind ?? "—"} / {item.model_id ?? "—"}</p></div><div className="text-right"><strong className="block text-xs">{item.latency_ms} ms</strong><span className="text-[11px] text-[var(--muted-foreground)]">{item.fallback_count ? `${item.fallback_count} fallback` : "direct"}</span></div></div>)}</div>}</div></Card>
      </div>
    </>}
  </div>;
}
