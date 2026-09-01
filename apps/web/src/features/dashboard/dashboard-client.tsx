"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, StatusDot } from "@switchroute/ui";
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
  if (!data) return <div className="dashboard-loading" aria-live="polite"><span className="sr-kicker">SYSTEM CHECK</span><strong>Checking provider health and routes…</strong><div className="loading-line" /></div>;

  const working = data.providers.length > 0 && data.healthy_providers > 0 && data.active_routes > 0;
  const setupHref = data.providers.length === 0 ? "/providers" : data.active_routes === 0 ? "/routes" : "/api-keys";
  const setupLabel = data.providers.length === 0 ? "Connect a provider" : data.active_routes === 0 ? "Create a Route" : "Create an API key";

  return (
    <div className="sr-stack dashboard-page">
      <section className="status-verdict" data-ready={working}>
        <div>
          <p className="sr-kicker">LIVE STATUS</p>
          <h1>{working ? "ROUTING READY." : "SETUP INCOMPLETE."}</h1>
          <p>{working ? "At least one healthy provider and active Route are available for traffic." : "SwitchRoute needs a healthy provider and active Route before it can route requests."}</p>
        </div>
        <div className="status-verdict-mark"><span className={`sr-status ${working ? "sr-status-success" : "sr-status-warning"}`} /><strong>{working ? "ONLINE" : "ACTION NEEDED"}</strong></div>
      </section>

      {!working && <div className="setup-callout"><span>Next required step</span><strong>{setupLabel}</strong><Link className="sr-button" href={setupHref}>Continue setup</Link></div>}

      <div className="metric-line">
        <div className="metric"><span>Providers healthy</span><strong>{data.healthy_providers}/{data.providers.length}</strong></div>
        <div className="metric"><span>Active Routes</span><strong>{data.active_routes}</strong></div>
        <div className="metric"><span>Requests · 24h</span><strong>{data.requests_24h}</strong></div>
        <div className="metric"><span>Provider spend · 24h</span><strong>${(data.cost_24h_microusd / 1_000_000).toFixed(3)}</strong></div>
      </div>

      <div className="dashboard-columns">
        <section className="operational-section">
          <div className="section-bar"><div><span className="sr-kicker">UPSTREAMS</span><h2>Providers</h2></div><Link href="/providers">Manage →</Link></div>
          <div className="operational-list">
            {data.providers.length ? data.providers.map((provider) => <div className="operational-row" key={provider.id}><span className="sr-row"><StatusDot status={provider.status} /><strong>{provider.display_name}</strong></span><span>{provider.provider_kind}</span></div>) : <div className="operational-empty"><span>No providers connected.</span><Link href="/providers">Connect one →</Link></div>}
          </div>
        </section>

        <section className="operational-section">
          <div className="section-bar"><div><span className="sr-kicker">LAST REQUESTS</span><h2>Activity</h2></div><Link href="/activity">View all →</Link></div>
          <div className="operational-list">
            {data.recent_activity.length ? data.recent_activity.map((item) => <div className="activity-row" key={item.request_id}><div><strong>{item.route_name}</strong><span>{item.provider_kind ?? "—"} / {item.model_id ?? "—"}</span></div><div><span>{item.latency_ms}ms</span><StatusDot status={item.status} /></div></div>) : <div className="operational-empty"><span>No requests yet. Prompt and completion content will never appear here.</span><Badge>METADATA ONLY</Badge></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
