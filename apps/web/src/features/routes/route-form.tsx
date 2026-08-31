"use client";

import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@switchroute/ui";
import type { ProviderConnection, RouteRecord, RouteTarget } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { TargetStack } from "./target-stack";

function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64); }
function preparedTargets(targets: RouteTarget[]) {
  return targets.map((target) => ({
    provider_connection_id: target.provider_connection_id,
    model_id: target.model_id,
    billing_tier: target.billing_tier,
    enabled: target.enabled,
  }));
}

export function RouteForm({ providers, route, onSaved, onCancel }: { providers: ProviderConnection[]; route?: RouteRecord; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(route?.name ?? "");
  const [slug, setSlug] = useState(route?.slug ?? "");
  const [strategy, setStrategy] = useState<RouteRecord["strategy"]>(route?.strategy ?? "priority");
  const [enabled, setEnabled] = useState(route?.enabled ?? true);
  const [targets, setTargets] = useState<RouteTarget[]>(() => (route?.targets ?? []).map((item) => ({ ...item, id: item.id ?? crypto.randomUUID() })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function addTarget() {
    const provider = providers[0]; const model = provider?.metadata.models?.[0];
    if (!provider || !model) return;
    setTargets((current) => [...current, { id: crypto.randomUUID(), provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    const body = { name, slug, strategy, enabled, targets: preparedTargets(targets) };
    try {
      await manageFetch(route ? `routes/${route.id}` : "routes", { method: route ? "PUT" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Route could not be saved."); }
    finally { setBusy(false); }
  }

  return (
    <form className="sr-panel sr-form-grid" onSubmit={submit}>
      <div className="sr-between"><div><p className="sr-kicker">{route ? "EDIT ROUTE" : "NEW ROUTE"}</p><h2 style={{ margin: 0 }}>{route ? route.name : "Build a priority stack"}</h2></div><Button type="button" className="sr-button-secondary" onClick={onCancel}>Close</Button></div>
      <div className="route-form-grid"><div className="sr-field"><Label htmlFor="route-name">Name</Label><Input id="route-name" required value={name} onChange={(event) => { setName(event.target.value); if (!route) setSlug(slugify(event.target.value)); }} placeholder="Coding" /></div><div className="sr-field"><Label htmlFor="route-slug">Slug</Label><Input id="route-slug" required value={slug} onChange={(event) => setSlug(slugify(event.target.value))} placeholder="coding" /></div><div className="sr-field"><Label htmlFor="strategy">Strategy</Label><select id="strategy" className="sr-select" value={strategy} onChange={(event) => setStrategy(event.target.value as RouteRecord["strategy"])}><option value="priority">Priority</option><option value="free_first">Free First</option></select></div></div>
      <label className="sr-row" style={{ fontSize: 13 }}><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Route enabled</label>
      <div className="sr-between"><div><strong>Targets</strong><p style={{ color: "var(--sr-muted)", margin: "4px 0 0", fontSize: 13 }}>Drag to reorder. SwitchRoute chooses one target for each request.</p></div><Button type="button" className="sr-button-secondary" disabled={!providers.some((item) => item.metadata.models?.length)} onClick={addTarget}>+ Add model</Button></div>
      <TargetStack targets={targets} providers={providers} onChange={setTargets} />
      {!targets.length && <div className="sr-error">A Route needs at least one model target.</div>}
      {error && <div className="sr-error">{error}</div>}
      <div className="sr-row"><Button disabled={busy || !name || !slug || !targets.length}>{busy ? "Saving…" : "Save Route"}</Button><Button type="button" className="sr-button-secondary" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}
