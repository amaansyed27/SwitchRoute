"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import type { ModelOption, ProviderConnection, RouteTarget } from "@/features/shared/types";

const billingLabels = { free: "Free", free_capable: "Account-dependent", paid: "Paid", unknown: "Price unverified" };

function Target({ target, providers, position, total, onChange, onRemove, onMove }: {
  target: RouteTarget; providers: ProviderConnection[]; position: number; total: number;
  onChange: (target: RouteTarget) => void; onRemove: () => void; onMove: (direction: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const provider = providers.find((item) => item.id === target.provider_connection_id);
  const models = provider?.metadata.models ?? [];
  const model = models.find((item) => item.id === target.model_id);
  const matching = models.filter((item) => (tier === "all" || item.billing_tier === tier) && `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name));
  const visible = matching.slice(0, 60);
  if (model && !visible.some((item) => item.id === model.id)) visible.unshift(model);
  function chooseModel(next?: ModelOption) {
    onChange({ ...target, model_id: next?.id ?? "", billing_tier: next?.billing_tier ?? "unknown", routing_state: undefined });
  }
  function chooseProvider(id: string) {
    const next = providers.find((item) => item.id === id)?.metadata.models?.[0];
    setQuery(""); setTier("all");
    onChange({ ...target, provider_connection_id: id, model_id: next?.id ?? "", billing_tier: next?.billing_tier ?? "unknown", routing_state: undefined });
  }
  return <section className="border border-[var(--border)] bg-[var(--surface)]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
      <div className="flex items-center gap-3"><span className="font-mono text-xs text-[var(--accent)]">{String(position).padStart(2,"0")}</span><h3 className="text-sm font-medium">{position === 1 ? "First choice" : `Fallback ${position - 1}`}</h3><Badge tone={model?.billing_tier === "free" ? "success" : "neutral"}>{billingLabels[model?.billing_tier ?? "unknown"]}</Badge></div>
      <div className="flex items-center gap-1"><Button variant="ghost" size="sm" disabled={position === 1} onClick={() => onMove(-1)} aria-label={`Move target ${position} up`}>↑</Button><Button variant="ghost" size="sm" disabled={position === total} onClick={() => onMove(1)} aria-label={`Move target ${position} down`}>↓</Button><Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove target ${position}`}>Remove</Button></div>
    </header>
    <div className="space-y-4 p-4">
      <Field label="Provider account" htmlFor={`provider-${target.id}`}><Select id={`provider-${target.id}`} aria-label="Provider" value={target.provider_connection_id} onChange={(event) => chooseProvider(event.target.value)}>{providers.map((item) => <option key={item.id} value={item.id}>{item.display_name} / {item.provider_kind}</option>)}</Select></Field>
      <div className="grid gap-3 sm:grid-cols-[1fr_190px]"><Input aria-label={`Search models for target ${position}`} placeholder="Find a model by name or ID…" value={query} onChange={(event) => setQuery(event.target.value)}/><Select aria-label={`Billing filter for target ${position}`} value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All billing types</option><option value="free">Free</option><option value="free_capable">Account-dependent</option><option value="paid">Paid</option><option value="unknown">Price unverified</option></Select></div>
      <Field label="Model" htmlFor={`model-${target.id}`}><Select id={`model-${target.id}`} aria-label="Model" value={target.model_id} onChange={(event) => chooseModel(models.find((item) => item.id === event.target.value))}>{!model && <option value="">Choose a model</option>}{visible.map((item) => <option key={item.id} value={item.id}>{item.name} — {billingLabels[item.billing_tier]}</option>)}</Select></Field>
      {(query || tier !== "all") && <p className="text-xs text-[var(--muted-foreground)]" role="status">{matching.length} matching models{matching.length > 60 ? "; showing the first 60. Refine your search." : "."} The current selection stays visible.</p>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted-foreground)]"><code className="break-all">{model?.id ?? "No model selected"}</code><span>{model?.input_price_per_million_usd != null && model.output_price_per_million_usd != null ? `$${model.input_price_per_million_usd} input / $${model.output_price_per_million_usd} output per 1M tokens` : "Token prices not verified"}</span></div>
    </div>
  </section>;
}

export function TargetStack({ targets, providers, onChange }: { targets: RouteTarget[]; providers: ProviderConnection[]; onChange: (targets: RouteTarget[]) => void }) {
  function move(index: number, direction: number) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= targets.length) return;
    const next = [...targets];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }
  return <div className="space-y-4">{targets.map((target,index) => <Target key={target.id} target={target} position={index+1} total={targets.length} providers={providers} onChange={(value) => onChange(targets.map((item,i) => i === index ? value : item))} onRemove={() => onChange(targets.filter((_,i) => i !== index))} onMove={(direction) => move(index,direction)}/>)}</div>;
}
