const providers = [
  { order: "01", name: "Groq", model: "qwen/qwen3-32b", note: "free tier", state: "ready" },
  { order: "02", name: "Gemini", model: "gemini-2.5-flash", note: "free tier", state: "ready" },
  { order: "03", name: "OpenRouter", model: "fallback", note: "paid", state: "standby" },
] as const;

export function RouterVisual() {
  return (
    <div className="sr-demo" aria-label="SwitchRoute routing preview">
      <div className="sr-demo-topbar">
        <div className="sr-demo-dots" aria-hidden="true"><span /><span /><span /></div>
        <div className="sr-demo-title"><span>Route</span><strong>coding</strong></div>
        <div className="sr-demo-health"><i /> healthy</div>
      </div>

      <div className="sr-demo-canvas">
        <div className="sr-demo-source">
          <p className="sr-demo-label">YOUR APP</p>
          <div className="sr-demo-request">
            <span>POST</span>
            <strong>/v1/chat/completions</strong>
            <code>model: "auto"</code>
          </div>
        </div>

        <div className="sr-demo-router" aria-hidden="true">
          <div className="sr-demo-router-core">
            <span>SR</span>
            <i className="sr-demo-pulse" />
          </div>
          <div className="sr-demo-wire sr-demo-wire-in"><i /></div>
          <div className="sr-demo-wire sr-demo-wire-out"><i /></div>
        </div>

        <div className="sr-demo-targets">
          <p className="sr-demo-label">ROUTE ORDER</p>
          {providers.map((provider) => (
            <div className={`sr-demo-provider sr-demo-provider-${provider.state}`} key={provider.order}>
              <span>{provider.order}</span>
              <div>
                <strong>{provider.name}</strong>
                <small>{provider.model}</small>
              </div>
              <em>{provider.note}</em>
              <i aria-hidden="true" />
            </div>
          ))}
        </div>
      </div>

      <div className="sr-demo-footer">
        <span>One endpoint</span>
        <span>Ordered fallback</span>
        <span>Zero content retention</span>
      </div>
    </div>
  );
}
