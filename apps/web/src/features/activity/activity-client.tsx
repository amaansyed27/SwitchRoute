"use client";

import { useEffect, useState } from "react";
import { Badge, Button, EmptyState, StatusDot } from "@switchroute/ui";
import type { ActivityRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";

export function ActivityClient() {
  const [activity, setActivity] = useState<ActivityRecord[] | null>(null);
  const [selected, setSelected] = useState<ActivityRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { manageFetch<ActivityRecord[]>("activity?limit=100").then(setActivity).catch((err) => setError(err.message)); }, []);
  if (error) return <div className="sr-error">{error}</div>;

  return (
    <div className="sr-stack activity-page">
      <div className="sr-page-header"><div><p className="sr-kicker">05 / METADATA ONLY</p><h1>Activity</h1><p>Routing diagnostics without prompt, completion, system-prompt, tool or upload content.</p></div><Badge>ZERO CONTENT RETENTION</Badge></div>
      {activity === null ? <div className="dashboard-loading"><span className="sr-kicker">REQUEST LOG</span><strong>Loading sanitized request metadata…</strong><div className="loading-line" /></div> : !activity.length ? <EmptyState title="No requests yet" body="Your first successful or failed routed request will appear here without content." /> : <div className="activity-layout"><div className="activity-table-wrap"><table className="data-table activity-table"><thead><tr><th>Time</th><th>Provider / model</th><th>Route</th><th>Latency</th><th>Tokens</th><th>Fallback</th><th>Status</th><th /></tr></thead><tbody>{activity.map((item) => <tr key={item.request_id} data-selected={selected?.request_id === item.request_id}><td>{new Date(item.created_at).toLocaleString()}</td><td><strong>{item.provider_kind ?? "—"}</strong><br/><small>{item.model_id ?? "—"}</small></td><td>{item.route_name}</td><td>{item.latency_ms}ms</td><td>{item.input_tokens ?? "?"} → {item.output_tokens ?? "?"}</td><td>{item.fallback_count ? `${item.fallback_count}×` : "—"}</td><td><span className="sr-row"><StatusDot status={item.status} />{item.status}</span></td><td><Button className="sr-button-secondary table-action" onClick={() => setSelected(item)}>Details</Button></td></tr>)}</tbody></table></div>{selected && <aside className="request-detail"><div className="request-detail-head"><div><p className="sr-kicker">REQUEST DETAIL</p><h2>{selected.status === "success" ? "Completed" : "Failed"}</h2></div><Button className="sr-button-secondary" onClick={() => setSelected(null)}>Close</Button></div><dl><div><dt>Request ID</dt><dd className="sr-mono">{selected.request_id}</dd></div><div><dt>Route</dt><dd>{selected.route_name}</dd></div><div><dt>Provider</dt><dd>{selected.provider_kind ?? "Unavailable"}</dd></div><div><dt>Model</dt><dd className="sr-mono">{selected.model_id ?? "Unavailable"}</dd></div><div><dt>Latency</dt><dd>{selected.latency_ms} ms</dd></div><div><dt>Tokens</dt><dd>{selected.input_tokens ?? "?"} in / {selected.output_tokens ?? "?"} out</dd></div><div><dt>Fallbacks</dt><dd>{selected.fallback_count}</dd></div>{selected.error_category && <div><dt>Error category</dt><dd>{selected.error_category}</dd></div>}</dl><p className="request-detail-note">Request and response content is intentionally unavailable.</p></aside>}</div>}
    </div>
  );
}
