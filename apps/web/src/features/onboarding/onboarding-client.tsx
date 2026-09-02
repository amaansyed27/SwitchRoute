"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@switchroute/ui";
import type { ProviderConnection, RouteRecord } from "@/features/shared/types";
import { manageFetch } from "@/lib/gateway/manage";
import { ProviderConnectForm } from "@/features/providers/provider-connect-form";

type Bootstrap = { providers: ProviderConnection[]; routes: RouteRecord[]; keys: unknown[]; onboarding_complete: boolean };
type Goal = "general" | "coding" | "fast";
const presets: Record<Goal, { name: string; description: string; strategy: "priority" | "free_first" }> = {
  general: { name: "General", description: "A reliable default Route for application traffic.", strategy: "free_first" },
  coding: { name: "Coding", description: "A Route for coding tools and developer workloads.", strategy: "free_first" },
  fast: { name: "Fast", description: "Keep your fastest connected target at the top.", strategy: "priority" },
};

function publicGatewayBase() {
  return process.env.NEXT_PUBLIC_GATEWAY_URL
    ?? (process.env.NODE_ENV === "production" ? "https://switchroute-gateway.vercel.app/v1" : "http://localhost:8000/v1");
}

function snippets(key: string) {
  const base = publicGatewayBase();
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

  useEffect(() => {
    manageFetch<Bootstrap>("bootstrap")
      .then((data) => { setBootstrap(data); setProvider(data.providers[0] ?? null); setRoute(data.routes[0] ?? null); })
      .catch((err) => setError(err.message));
  }, []);

  const code = useMemo(() => key ? snippets(key) : null, [key]);
  const stage = key ? 4 : route ? 3 : provider ? 2 : 1;

  async function createRoute() {
    const model = provider?.metadata.models?.[0];
    if (!provider || !model) return;
    setError(null);
    try {
      const preset = presets[goal];
      const result = await manageFetch<RouteRecord>("routes", {
        method: "POST",
        body: JSON.stringify({ name: preset.name, slug: preset.name.toLowerCase(), strategy: preset.strategy, enabled: true, targets: [{ provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }] }),
      });
      setRoute({ ...result, targets: [{ provider_connection_id: provider.id, model_id: model.id, billing_tier: model.billing_tier, enabled: true }] });
    } catch (err) { setError(err instanceof Error ? err.message : "Route creation failed."); }
  }

  async function createKey() {
    if (!route) return;
    setError(null);
    try {
      const result = await manageFetch<{ key: string }>("keys", { method: "POST", body: JSON.stringify({ route_id: route.id, environment: "live", name: "Onboarding" }) });
      setKey(result.key);
    } catch (err) { setError(err instanceof Error ? err.message : "API key creation failed."); }
  }

  async function testConnection() {
    if (!key) return;
    setTestState("testing");
    try {
      const response = await fetch(`${publicGatewayBase()}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "auto", messages: [{ role: "user", content: "Reply with exactly: SwitchRoute connected" }], max_tokens: 20 }),
      });
      if (!response.ok) throw new Error("Request failed");
      await response.json();
      setTestState("success");
    } catch { setTestState("error"); }
  }

  if (error && !bootstrap) return <div className="sr-error">{error}</div>;
  if (!bootstrap) return <div className="dashboard-loading"><span className="sr-kicker">WORKSPACE SETUP</span><strong>Preparing your SwitchRoute workspace…</strong><div className="loading-line" /></div>;
  if (bootstrap.onboarding_complete && !key) return <section className="onboarding-complete"><p className="sr-kicker">SETUP COMPLETE</p><h1>Your routing layer is ready.</h1><p>Existing API-key secrets cannot be recovered. Create another key if you need a new value to copy.</p><Link className="sr-button" href="/dashboard">Open dashboard</Link></section>;

  const headings = ["Connect your first provider", "Review your first Route", "Create your API key", "Test the Route"];
  const descriptions = [
    "Choose a starting preset, add one provider key, and validate it. You can change everything later.",
    "SwitchRoute has enough information to create a useful first Route. Review it before saving.",
    "Generate one live Route-bound key. The full secret is shown only once.",
    "Run one real OpenAI-compatible request and confirm the Route is ready for your application.",
  ];

  return (
    <div className="onboarding-grid">
      <aside className="onboarding-progress">
        <div>
          <p className="sr-kicker">QUICK SETUP</p>
          <h2>Four steps to your first routed request.</h2>
        </div>
        <div className="onboarding-steps">
          {["Provider", "Route", "API key", "Test + ship"].map((label, index) => (
            <div key={label} className={stage >= index + 1 ? "onboarding-step active" : "onboarding-step"}>
              <span>{index + 1}</span>{label}
            </div>
          ))}
        </div>
      </aside>

      <div className="onboarding-work">
        <header className="onboarding-stage-head">
          <div><p className="sr-kicker">SETUP {stage} / 4</p><h1>{headings[stage - 1]}</h1><p>{descriptions[stage - 1]}</p></div>
          <span className="onboarding-stage-index">0{stage}</span>
        </header>

        {stage === 1 && <section className="onboarding-stage">
          <div className="onboarding-preset-block">
            <div className="onboarding-block-head"><strong>Route preset</strong><span>Pick the closest starting point.</span></div>
            <div className="onboarding-preset-grid">
              {(Object.keys(presets) as Goal[]).map((item) => (
                <button className={`onboarding-choice ${goal === item ? "selected" : ""}`} key={item} aria-pressed={goal === item} onClick={() => setGoal(item)}>
                  <strong>{presets[item].name}</strong><span>{presets[item].description}</span>
                </button>
              ))}
            </div>
          </div>
          <div id="provider-connect" className="onboarding-provider-block"><ProviderConnectForm onConnected={setProvider} /></div>
        </section>}

        {stage === 2 && <section className="onboarding-summary"><div className="summary-label"><span>Suggested Route</span><strong>{presets[goal].name}</strong></div><div className="summary-target"><span>01</span><div><strong>{provider?.display_name}</strong><small>{provider?.metadata.models?.[0]?.name ?? "Discovered model"}</small></div><span>{presets[goal].strategy === "free_first" ? "FREE FIRST" : "PRIORITY"}</span></div><div className="onboarding-action-row"><Button onClick={createRoute}>Create this Route</Button></div></section>}

        {stage === 3 && <section className="onboarding-summary"><div className="summary-label"><span>Route ready</span><strong>{route?.name}</strong></div><p className="onboarding-summary-copy">Generate a live Route-bound key. You will only see its full value once.</p><div className="onboarding-action-row"><Button onClick={createKey}>Generate sr_live_ key</Button></div></section>}

        {stage === 4 && key && code && <section className="onboarding-final">
          <div className="secret-reveal onboarding-secret"><div><p className="sr-kicker">COPY THIS NOW</p><h2>Save the key before you continue.</h2></div><div className="key-secret"><code>{key}</code><Button onClick={() => navigator.clipboard.writeText(key)}>Copy key</Button></div></div>
          <div className="code-tabs">{(["Python", "JavaScript", "cURL"] as const).map((name) => <Button key={name} className={tab === name ? "" : "sr-button-secondary"} onClick={() => setTab(name)}>{name}</Button>)}</div>
          <pre className="sr-code"><code>{code[tab]}</code></pre>
          <div className="onboarding-test-row"><div>{testState === "success" && <span className="sr-success-box">Connected. Your routed request succeeded.</span>}{testState === "error" && <span className="sr-error">The request failed. Check provider health and try again.</span>}</div><div className="sr-row"><Button className="sr-button-secondary" disabled={testState === "testing"} onClick={testConnection}>{testState === "testing" ? "Testing…" : "Test connection"}</Button>{testState === "success" && <Link className="sr-button" href="/dashboard">Open dashboard</Link>}</div></div>
        </section>}

        {error && <div className="sr-error">{error}</div>}
      </div>
    </div>
  );
}
