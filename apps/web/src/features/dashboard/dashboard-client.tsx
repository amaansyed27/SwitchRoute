"use client";

import { useEffect, useState } from "react";
import { Badge, Panel, StatusDot } from "@switchroute/ui";
import { manageFetch } from "@/lib/gateway/manage";
import type { ActivityRecord, ProviderConnection } from "@/features/shared/types";

type Summary = {
  providers: ProviderConnection[];
  healthy_providers: number;
  active_routes: number;
  requests_24h: number;
  cost_24h_microusd: number;
  recent_activity: ActivityRecord[];
};

export function DashboardClient() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { manageFetch<Summary>("dashboard").then(setData).catch((err) => setError(err.message)); }, []);

  if (error) return <div className="sr-error">{error}</div>;
  if (!data) return <p style={{ color: "var(--sr-muted)" }}>Checking SwitchRoute…</p>;
  const working = data.providers.length > 0 && data.healthy_providers > 0 && data.active_routes > 0;

  return (
    <div className="sr-stack" style={{ gap: 28 }}>
      <div className="sr-page-header"><div><p className="sr-kicker">STATUS</p><h1>Is SwitchRoute working?</h1><p>Provider health, active routing, and the latest metadata-only requests.</p></div><Badge tone={working ? "success" : "warning"}>{working ? "READY" : "SETUP NEEDED"}</Badge></div>
      <div className="metric-line">
        <div className="metric"><span>Providers healthy</span><strong>{data.healthy_providers}/{data.providers.length}</strong></div>
        <div className="metric"><span>Active Routes</span><strong>{data.active_routes}</strong></div>
        <div className="metric"><span>Requests · 24h</span><strong>{data.requests_24h}</strong></div>
        <div className="metric"><span>Est. provider spend · 24h</span><strong>${(data.cost_24h_microusd / 1_000_000).toFixed(3)}</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, .8fr) minmax(0, 1.2fr)", gap: 20 }}>
        <Panel><div className="sr-between"><h2 style={{ margin: 0 }}>Providers</h2><a href="/providers" className="sr-kicker">MANAGE</a></div><div className="sr-stack" style={{ marginTop: 18 }}>{data.providers.length ? data.providers.map((provider) => <div className="sr-between" key={provider.id}><span className="sr-row"><StatusDot status={provider.status} />{provider.display_name}</span><small style={{ color: "var(--sr-muted)" }}>{provider.provider_kind}</small></div>) : <p style={{ color: "var(--sr-muted)" }}>No providers connected.</p>}</div></Panel>
        <Panel><div className="sr-between"><h2 style={{ margin: 0 }}>Recent activity</h2><a href="/activity" className="sr-kicker">VIEW ALL</a></div><div className="sr-stack" style={{ marginTop: 12 }}>{data.recent_activity.length ? data.recent_activity.map((item) => <div className="sr-between" key={item.request_id} style={{ padding: "8px 0", borderBottom: "1px solid #252b36" }}><div><strong>{item.route_name}</strong><br/><small style={{ color: "var(--sr-muted)" }}>{item.provider_kind} / {item.model_id}</small></div><span className="sr-row"><small>{item.latency_ms}ms</small><StatusDot status={item.status} /></span></div>) : <p style={{ color: "var(--sr-muted)" }}>Requests will appear here without prompt or completion content.</p>}</div></Panel>
      </div>
    </div>
  );
}
