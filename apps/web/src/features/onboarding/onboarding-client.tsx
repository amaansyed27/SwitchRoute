"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Panel } from "@switchroute/ui";
import type { ProviderConnection, RouteRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { ProviderConnectForm } from "@/features/providers/provider-connect-form";

type Bootstrap = { providers: ProviderConnection[]; routes: RouteRecord[]; keys: unknown[]; onboarding_complete: boolean };
type Goal = "general" | "coding" | "fast";
const presets: Record<Goal, { name: string; description: string; strategy: "priority" | "free_first" }> = {
  general: { name: "General", description: "A reliable default Route for application traffic.", strategy: "free_first" },
  coding: { name: "Coding", description: "A Route you can bind to coding and developer tools.", strategy: "free_first" },
  fast: { name: "Fast", description: "Keep your fastest connected target at the top.", strategy: "priority" },
};

function snippets(key: string) {
  const base = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://api.switchroute.dawnlightlabs.com/v1";
  return {
    Python: `from openai import OpenAI\n\nclient = OpenAI(api_key="${key}", base_url="${base}/")\nresponse = client.chat.completions.create(model="auto", messages=[{"role":"user","content":"Hello"}])`,
    JavaScript: `import OpenAI from "openai";\n\nconst client = new OpenAI({ apiKey: "${key}", baseURL: "${base}" });\nconst response = await client.chat.completions.create({ model: "auto", messages: [{ role: "user", content: "Hello" }] });`,
    cURL: `curl ${base}/chat/completions -H "Authorization: Bearer ${key}" -H "Content-Type: application/json" -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
  };
}

export function OnboardingClient() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [goal, setGoal] = useState<Goal>("general");
  const [provider, setProvider] = useState<ProviderConnection | null>(null);
  const [route, setRoute] = useState<RouteRecord | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"Python" | "JavaScript" | "cURL">("Python");
  const [testState, setTestState] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { manageFetch<Bootstrap>("bootstrap").then((data) => { setBootstrap(data); setProvider(data.providers[0] ?? null); setRoute(data.routes[0] ?? null); }).catch((err) => setError(err.message)); }, []);
  const code = useMemo(() => key ? snippets(key) : null, [key]);
  const step = key ? 5 : route ? 4 : provider ? 3 : 2;

  async function createRoute() {
    const model = provider?.metadata.models?.[0]; if (!provider || !model) return;
    setError(null);
    try {
      const preset = presets[goal];
      const result = await manageFetch<RouteRecord>("routes", { method: "POST", body: JSON.stringify({ name: preset.name, slug: preset.name.toLowerCase(), strategy: preset.strategy, enabled: true, targets: [{ provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }] }) });
      setRoute({ ...result, targets: [{ provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }] });
    } catch (err) { setError(err instanceof Error ? err.message : "Route creation failed."); }
  }

  async function createKey() {
    if (!route) return; setError(null);
    try { const result = await manageFetch<{ key: string }>("keys", { method: "POST", body: JSON.stringify({ route_id: route.id, environment: "live", name: "Onboarding" }) }); setKey(result.key); }
    catch (err) { setError(err instanceof Error ? err.message : "API key creation failed."); }
  }

  async function testConnection() {
    if (!key) return; setTestState("testing");
    const base = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8000/v1";
    try {
      const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "auto", messages: [{ role: "user", content: "Reply with exactly: SwitchRoute connected" }], max_tokens: 20 }) });
      if (!response.ok) throw new Error("Request failed");
      await response.json(); setTestState("success");
    } catch { setTestState("error"); }
  }

  if (error && !bootstrap) return <div className="sr-error">{error}</div>;
  if (!bootstrap) return <p style={{ color: "var(--sr-muted)" }}>Preparing your workspace…</p>;
  if (bootstrap.onboarding_complete && !key) return <Panel><p className="sr-kicker">SETUP COMPLETE</p><h1>Your workspace is already ready.</h1><p style={{ color: "var(--sr-muted)" }}>Existing API keys cannot be recovered. Create another from API Keys if you need to copy a secret again.</p><Link className="sr-button" href="/dashboard">Open dashboard</Link></Panel>;

  return (
    <div className="onboarding-grid">
      <aside className="onboarding-progress"><p className="sr-kicker">GET STARTED</p><h2>First request, without reading docs.</h2>{["Choose a use", "Connect provider", "Create Route", "Generate key", "Test request"].map((label, index) => <div key={label} className={step >= index + 1 ? "onboarding-step active" : "onboarding-step"}><span>{index + 1}</span>{label}</div>)}</aside>
      <div className="onboarding-work">
        <div><p className="sr-kicker">STEP {step} / 5</p><h1 style={{ fontSize: 42, letterSpacing: "-.045em", margin: "0 0 10px" }}>{step === 2 ? "What will SwitchRoute handle?" : step === 3 ? "Connect your first provider." : step === 4 ? "Create your first Route." : "Your key is ready."}</h1></div>
        {step === 2 && <div className="sr-stack">{(Object.keys(presets) as Goal[]).map((item) => <button className={`onboarding-choice ${goal === item ? "selected" : ""}`} key={item} onClick={() => setGoal(item)}><strong>{presets[item].name}</strong><span>{presets[item].description}</span></button>)}<Button onClick={() => document.getElementById("provider-connect")?.scrollIntoView({ behavior: "smooth" })}>Continue</Button><div id="provider-connect"><ProviderConnectForm onCancel={() => {}} onConnected={setProvider} /></div></div>}
        {step === 3 && <Panel><p className="sr-kicker">SUGGESTED ROUTE</p><h2>{presets[goal].name}</h2><p style={{ color: "var(--sr-muted)" }}>{provider?.display_name} / {provider?.metadata.models?.[0]?.name}</p><Badge>{presets[goal].strategy === "free_first" ? "FREE FIRST" : "PRIORITY"}</Badge><div style={{ marginTop: 18 }}><Button onClick={createRoute}>Create this Route</Button></div></Panel>}
        {step === 4 && <Panel><p className="sr-kicker">ROUTE-BOUND ACCESS</p><h2>{route?.name} is ready.</h2><p style={{ color: "var(--sr-muted)" }}>Generate a live key. You will see the full value once.</p><Button onClick={createKey}>Generate sr_live_ key</Button></Panel>}
        {step === 5 && key && code && <div className="sr-stack"><Panel className="sr-panel-paper"><p className="sr-kicker">COPY THIS KEY NOW</p><div className="key-secret"><code>{key}</code><Button onClick={() => navigator.clipboard.writeText(key)}>Copy</Button></div></Panel><div className="sr-row">{(["Python","JavaScript","cURL"] as const).map((name) => <Button key={name} className={tab === name ? "" : "sr-button-secondary"} onClick={() => setTab(name)}>{name}</Button>)}</div><pre className="sr-code"><code>{code[tab]}</code></pre><div className="sr-between"><div>{testState === "success" && <span className="sr-success-box">Connected. Your routed request succeeded.</span>}{testState === "error" && <span className="sr-error">The test request failed. Check provider health and try again.</span>}</div><div className="sr-row"><Button className="sr-button-secondary" disabled={testState === "testing"} onClick={testConnection}>{testState === "testing" ? "Testing…" : "Test connection"}</Button>{testState === "success" && <Link className="sr-button" href="/dashboard">Open dashboard</Link>}</div></div></div>}
        {error && <div className="sr-error">{error}</div>}
      </div>
    </div>
  );
}
