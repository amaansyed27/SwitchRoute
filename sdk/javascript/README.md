# @switchroute/sdk

Thin TypeScript client for SwitchRoute. It calls the same OpenAI-compatible `/v1` API used by the standard OpenAI SDK; it does not replace or wrap the OpenAI SDK.

```bash
npm install @switchroute/sdk
```

```ts
import { SwitchRoute } from "@switchroute/sdk";

const client = new SwitchRoute({ apiKey: process.env.SWITCHROUTE_API_KEY! });
const response = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});
```

Streaming returns an async iterable:

```ts
const stream = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
  stream: true,
});
for await (const chunk of stream) console.log(chunk);
```

## Browser boundary

Server-side use is the default. A browser bundle would expose the SwitchRoute API key to every user, so construction in a browser is blocked unless `dangerouslyAllowBrowser: true` is explicitly set. Do not enable that for a normal `sr_live_` key.

No open-source software license has been selected for SwitchRoute. See the repository for the current distribution terms/status.
