"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import type { PaidFallback, ProviderConnection, RouteRecord, RouteStrategy, RouteTarget } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { cn } from "@/lib/cn";
import { TargetStack } from "./target-stack";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64); }
function preparedTargets(targets: RouteTarget[]) { return targets.map((target) => ({ provider_connection_id: target.provider_connection_id, model_id: target.model_id, billing_tier: target.billing_tier, enabled: target.enabled })); }

const strategies: Array<{ id: RouteStrategy; title: string; body: string }> = [
  { id: "priority", title: "Priority", body: "Respect target order after health, capability and policy checks." },
  { id: "free_first", title: "Free First", body: "Use known free capacity first and spend only when policy permits." },
  { id: "quota_aware", title: "Quota Aware", body: "Prefer targets with the most usable known capacity." },
  { id: "fastest", title: "Fastest", body: "Use rolling observed latency; cold targets never look magically fast." },
  { id: "cheapest", title: "Cheapest", body: "Rank only known prices. Unknown cost is never treated as free." },
  { id: "balanced", title: "Balanced", body: "Combine health, quota, latency and price without a quality score." },
];

export function RouteForm({ providers, route, onSaved }: { providers: ProviderConnection[]; route?: RouteRecord; onSaved: () => void }) {
  const [name, setName] = useState(route?.name ?? "");
  const [slug, setSlug] = useState(route?.slug ?? "");
  const [strategy, setStrategy] = useState<RouteStrategy>(route?.strategy ?? "priority");
  const [enabled, setEnabled] = useState(route?.enabled ?? true);
  const [paidFallback, setPaidFallback] = useState<PaidFallback>(route?.paid_fallback ?? "after_free");
  const [dailyCap, setDailyCap] = useState(route?.daily_paid_cap_microusd == null ? "" : String(route.daily_paid_cap_microusd / 1_000_000));
  const [targets, setTargets] = useState<RouteTarget[]>(() => (route?.targets ?? []).map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addTarget() { const provider = providers.find((item) => item.metadata.models?.length); const model = provider?.metadata.models?.[0]; if (!provider || !model) return; setTargets((current) => [...current, { id: crypto.randomUUID(), provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }]); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const parsedCap = dailyCap.trim() === "" ? null : Number(dailyCap);
    if (parsedCap != null && (!Number.isFinite(parsedCap) || parsedCap < 0)) { setError("Daily paid cap must be a non-negative dollar amount."); setBusy(false); return; }
    try {
      await manageFetch(route ? `routes/${route.id}` : "routes", {
        method: route ? "PUT" : "POST",
        body: JSON.stringify({
          name, slug, strategy, enabled,
          paid_fallback: paidFallback,
          daily_paid_cap_microusd: parsedCap == null ? null : Math.round(parsedCap * 1_000_000),
          targets: preparedTargets(targets),
        }),
      });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Waterfall could not be saved."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Name" htmlFor="route-name"><Input id="route-name" required value={name} onChange={(event) => { setName(event.target.value); if (!route) setSlug(slugify(event.target.value)); }} placeholder="Production"/></Field><Field label="Slug" htmlFor="route-slug"><Input id="route-slug" required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="production"/></Field></div>
    <div><p className="mb-2 text-xs font-medium">Routing strategy</p><div className="grid gap-2 sm:grid-cols-2">{strategies.map((item) => <button key={item.id} type="button" aria-pressed={strategy === item.id} onClick={() => setStrategy(item.id)} className={cn("rounded-xl border p-3 text-left transition", strategy === item.id ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]")}><strong className="text-sm">{item.title}</strong><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.body}</p></button>)}</div></div>
    <details className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"><summary className="cursor-pointer px-3 py-3 text-sm font-medium">Paid fallback & budget</summary><div className="grid gap-4 border-t border-[var(--border)] p-3 sm:grid-cols-2"><Field label="Paid fallback" htmlFor="paid-fallback"><Select id="paid-fallback" value={paidFallback} onChange={(event) => setPaidFallback(event.target.value as PaidFallback)}><option value="never">Never use paid</option><option value="after_free">After free capacity</option><option value="allowed">Paid allowed</option></Select></Field><Field label="Daily paid cap (USD)" htmlFor="daily-cap"><Input id="daily-cap" inputMode="decimal" min="0" step="0.01" value={dailyCap} onChange={(event) => setDailyCap(event.target.value)} placeholder="No cap"/></Field><p className="text-xs leading-5 text-[var(--muted-foreground)] sm:col-span-2">Enforced by the gateway. Unknown-priced targets cannot run under a spend cap because their cost cannot be bounded safely.</p></div></details>
    <label className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><div><strong className="text-sm">Enabled</strong><p className="text-xs text-[var(--muted-foreground)]">Allow new requests to use this waterfall.</p></div><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-[var(--accent)]"/></label>
    <div><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-medium">Targets</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Drag to set priority. Smart strategies may reorder eligible targets at request time.</p></div><Button variant="secondary" size="sm" type="button" disabled={!providers.some((item) => item.metadata.models?.length)} onClick={addTarget}><Icon name="plus" className="size-3.5"/>Add model</Button></div><TargetStack targets={targets} providers={providers} onChange={setTargets}/>{!targets.length && <div className="mt-3"><Alert tone="info">Add at least one provider/model target.</Alert></div>}</div>
    {error && <Alert>{error}</Alert>}
    <div className="flex justify-end border-t border-[var(--border)] pt-4"><Button type="submit" disabled={busy || !name.trim() || !slug || !targets.length}>{busy ? "Saving…" : route ? "Save changes" : "Create waterfall"}</Button></div>
  </form>;
}
