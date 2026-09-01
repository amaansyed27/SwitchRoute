const code = `from openai import OpenAI

client = OpenAI(
    api_key="sr_live_...",
    base_url="https://api.switchroute.dawnlightlabs.com/v1"
)

client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Ship it"}]
)`;

export function IntegrationPanel() {
  return (
    <div className="sr-integration-panel">
      <div className="sr-integration-copy">
        <p className="sr-kicker">OPENAI-COMPATIBLE</p>
        <h2>Change the endpoint.<br />Keep your client.</h2>
        <p>
          Provider keys and fallback logic live in SwitchRoute. Your application keeps one familiar API shape.
        </p>
        <div className="sr-integration-facts">
          <span><strong>01</strong> Route-bound keys</span>
          <span><strong>02</strong> Ordered provider fallback</span>
          <span><strong>03</strong> No prompt/completion storage</span>
        </div>
      </div>

      <div className="sr-code-card">
        <div className="sr-code-card-head">
          <span>Python</span>
          <span>app.py</span>
        </div>
        <pre><code>{code}</code></pre>
        <div className="sr-code-card-foot">
          <span>POST /v1/chat/completions</span>
          <strong>200 · Groq / qwen3-32b</strong>
        </div>
      </div>
    </div>
  );
}
