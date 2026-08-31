"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, StatusDot } from "@switchroute/ui";
import type { ActivityRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

export function ActivityClient() {
  const [activity, setActivity] = useState<ActivityRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { manageFetch<ActivityRecord[]>("activity?limit=100").then(setActivity).catch((err) => setError(err.message)); }, []);
  if (error) return <div className="sr-error">{error}</div>;
  return (
    <div className="sr-stack" style={{ gap: 26 }}>
      <div className="sr-page-header"><div><p className="sr-kicker">METADATA ONLY</p><h1>Activity</h1><p>Operational request metadata for routing and diagnosis. Prompt and completion content is never available here.</p></div><Badge>ZERO PROMPT RETENTION</Badge></div>
      {activity === null ? <p style={{ color: "var(--sr-muted)" }}>Loading activity…</p> : !activity.length ? <EmptyState title="No requests yet" body="Your first successful or failed routed request will appear here without content." /> : <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Time</th><th>Route</th><th>Provider / model</th><th>Tokens</th><th>Latency</th><th>Fallbacks</th><th>Status</th></tr></thead><tbody>{activity.map((item) => <tr key={item.request_id}><td>{new Date(item.created_at).toLocaleString()}</td><td>{item.route_name}</td><td>{item.provider_kind ?? "—"}<br/><small style={{ color: "var(--sr-muted)" }}>{item.model_id ?? "—"}</small></td><td>{item.input_tokens ?? "?"} → {item.output_tokens ?? "?"}</td><td>{item.latency_ms}ms</td><td>{item.fallback_count}</td><td><span className="sr-row"><StatusDot status={item.status} />{item.status}</span>{item.error_category && <small style={{ color: "var(--sr-muted)" }}>{item.error_category}</small>}</td></tr>)}</tbody></table></div>}
    </div>
  );
}
