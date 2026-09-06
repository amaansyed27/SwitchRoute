import assert from "node:assert/strict";
import test from "node:test";
import { AuthenticationError, SwitchRoute } from "../dist/index.js";

test("chat completions use the OpenAI-compatible path", async () => {
  let seen;
  const client = new SwitchRoute({
    apiKey: "sr_test_example",
    baseURL: "https://example.test/v1",
    fetch: async (url, init) => {
      seen = { url, init };
      return Response.json({ id: "chat_1", object: "chat.completion", created: 1, model: "auto", choices: [] });
    },
  });
  const result = await client.chat.completions.create({ messages: [{ role: "user", content: "hello" }] });
  assert.equal(result.id, "chat_1");
  assert.equal(seen.url, "https://example.test/v1/chat/completions");
  assert.equal(seen.init.headers.Authorization, "Bearer sr_test_example");
  assert.equal(JSON.parse(seen.init.body).model, "auto");
});

test("streaming decodes SSE and stops at DONE", async () => {
  const payload = 'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"auto","choices":[]}\n\ndata: [DONE]\n\n';
  const client = new SwitchRoute({
    apiKey: "sr_test_example",
    fetch: async () => new Response(payload, { headers: { "content-type": "text/event-stream" } }),
  });
  const stream = await client.chat.completions.create({ messages: [], stream: true });
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].id, "c1");
});

test("normalized auth errors are typed without surfacing raw bodies", async () => {
  const client = new SwitchRoute({
    apiKey: "bad",
    fetch: async () => Response.json({ error: { code: "authentication_error", message: "Invalid SwitchRoute key." } }, { status: 401 }),
  });
  await assert.rejects(() => client.models.list(), AuthenticationError);
});
