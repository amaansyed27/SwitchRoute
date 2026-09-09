"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Badge, EmptyState, LoadingBlock, Retry, StatusDot } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/surface";
import type { ActivityRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

function costLabel(value?: number | null) { return value == null ? "Unverified" : `$${(value / 1_000_000).toFixed(value < 10_000 ? 6 : 4)}`; }
function connectionLabel(item: ActivityRecord) { return item.provider_connection_name ?? item.provider_kind ?? "No provider selected"; }

export function ActivityClient() {
  const [activity, setActivity] = useState<ActivityRecord[] | null>(null);
  const [selected, setSelected] = useState<ActivityRecord | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    setRefreshing(true);
    try { setActivity(await manageFetch<ActivityRecord[]>("activity?limit=100")); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : "Activity could not be loaded."); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    manageFetch<ActivityRecord[]>("activity?limit=100").then((result) => { if (!cancelled) setActivity(result); }).catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Activity could not be loaded."); });
    return () => { cancelled = true; };
  }, []);
  const rows = useMemo(() => (activity ?? []).filter((item) => (status === "all" || item.status === status) && `${item.route_name} ${item.provider_kind ?? ""} ${item.provider_connection_name ?? ""} ${item.model_id ?? ""}`.toLowerCase().includes(query.toLowerCase())), [activity, query, status]);
  return <div>
    <PageHeader title="Activity" eyebrow="Activity" description="See where requests went, how long they took, and what happened along the way." action={<Button variant="secondary" onClick={() => void load()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh activity"}</Button>}/>
    {error && <Retry message={error} onRetry={() => void load()}/>}
    <div className="mb-6 flex flex-col gap-3 sm:flex-row"><Input className="sm:max-w-md" aria-label="Filter activity" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a model, provider, or waterfall…"/><Select className="sm:max-w-44" aria-label="Request status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All requests</option><option value="success">Successful</option><option value="error">Failed</option></Select></div>
    {activity === null && !error ? <LoadingBlock label="Loading activity"/> : activity && !rows.length ? <EmptyState title={activity.length ? "No matching requests" : "Your first request starts the story."} description={activity.length ? "Try another search or status filter." : "Call your waterfall with a SwitchRoute key. Its routing details will appear here."}/> : <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="hidden grid-cols-[1.4fr_1fr_100px_100px_80px] gap-4 border-b border-[var(--border)] px-6 py-4 text-xs text-[var(--muted-foreground)] lg:grid"><span>Model / provider</span><span>Waterfall</span><span>Duration</span><span>Est. cost</span><span>Details</span></div>
      <div className="divide-y divide-[var(--border)]">{rows.map((item) => <button key={`${item.request_id}-${item.created_at}`} onClick={() => setSelected(item)} className="grid w-full gap-4 px-5 py-5 text-left transition-colors hover:bg-[var(--surface-muted)] sm:px-6 lg:grid-cols-[1.4fr_1fr_100px_100px_80px] lg:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><StatusDot status={item.status}/><strong className="truncate text-sm font-medium">{item.model_id ?? "Request failed"}</strong></div><p className="mt-1.5 pl-4 text-xs text-[var(--muted-foreground)]">{connectionLabel(item)} · {new Date(item.created_at).toLocaleString()}</p></div><div className="text-sm">{item.route_name}<span className="ml-2 text-xs text-[var(--muted-foreground)] lg:ml-0 lg:mt-1 lg:block">{item.fallback_count ? `${item.fallback_count} fallbacks` : "Direct"}</span></div><span className="text-sm tabular-nums">{item.latency_ms.toLocaleString()} ms</span><span className="text-sm tabular-nums">{costLabel(item.estimated_cost_microusd)}</span><span className="text-sm text-[var(--accent)]">{item.status === "error" ? "Failed" : "Success"} ↗</span></button>)}</div>
    </section>}
    <p className="mt-5 text-xs leading-6 text-[var(--muted-foreground)]">Showing up to 100 recent requests. Routing metadata only; conversation content is never stored.</p>
    {selected && <Drawer title="Request details" description={new Date(selected.created_at).toLocaleString()} onClose={() => setSelected(null)}><div className="mb-6 flex items-center gap-3"><StatusDot status={selected.status}/><h3 className="text-2xl font-medium tracking-tight">{selected.status === "success" ? "Delivered successfully" : "Request failed"}</h3></div><dl>{[["Waterfall", selected.route_name], ["Provider account", connectionLabel(selected)], ["Model", selected.model_id ?? "Unavailable"], ["Duration", `${selected.latency_ms} ms`], ["Time to first token", selected.ttft_ms == null ? "Not recorded" : `${selected.ttft_ms} ms`], ["Tokens", `${selected.input_tokens ?? "?"} input / ${selected.output_tokens ?? "?"} output`], ["Estimated cost", costLabel(selected.estimated_cost_microusd)], ["Billing", selected.paid_routing ? "Paid request" : "No paid usage recorded"], ["Fallbacks", String(selected.fallback_count)], ["Request ID", selected.request_id], ...(selected.error_category ? [["Error", selected.error_category]] : []), ...(selected.routing_decision?.selected?.reason ? [["Selection reason", selected.routing_decision.selected.reason.replaceAll("_", " ")]] : [])].map(([label,value]) => <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-[var(--border)] py-4"><dt className="text-sm text-[var(--muted-foreground)]">{label}</dt><dd className="break-words text-sm">{value}</dd></div>)}</dl>{!!selected.routing_decision?.path?.length && <div className="mt-8"><h3 className="mb-4 text-sm font-medium">Routing path</h3><ol className="space-y-4">{selected.routing_decision.path.map((step,index) => <li key={index} className="border-l-2 border-[var(--accent)] pl-4"><p className="text-sm">{step.provider} / {step.model}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{step.outcome}</p></li>)}</ol></div>}<div className="mt-6"><Badge>Conversation content is not retained</Badge></div></Drawer>}
  </div>;
}
