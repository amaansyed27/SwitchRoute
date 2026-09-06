import OpenAI from "openai";

let called = false;
const client = new OpenAI({
  apiKey: "sr_live_compat",
  baseURL: "https://api.switchroute.dawnlightlabs.com/v1",
  fetch: async (input, init) => {
    called = true;
    const url = typeof input === "string" ? input : input.url;
    if (url !== "https://api.switchroute.dawnlightlabs.com/v1/chat/completions") {
      throw new Error(`unexpected URL: ${url}`);
    }
    const headers = new Headers(init?.headers);
    if (headers.get("authorization") !== "Bearer sr_live_compat") {
      throw new Error("OpenAI JS SDK did not send the SwitchRoute key as bearer auth");
    }
    const body = JSON.parse(String(init?.body));
    if (body.model !== "auto" || body.messages?.[0]?.content !== "Hello") {
      throw new Error("OpenAI JS SDK request payload drifted");
    }
    return new Response(
      JSON.stringify({
        id: "chatcmpl_compat",
        object: "chat.completion",
        created: 1,
        model: "auto",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-switchroute-request-id": "00000000-0000-0000-0000-000000000001",
        },
      },
    );
  },
});

const response = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello" }],
});
if (!called || response.choices[0]?.message?.content !== "ok") {
  throw new Error("OpenAI JS SDK compatibility check failed");
}
console.log("OpenAI JavaScript SDK compatibility: ok");
