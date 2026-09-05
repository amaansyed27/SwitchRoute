import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = (__ENV.SWITCHROUTE_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const apiKey = __ENV.SWITCHROUTE_API_KEY || "sr_test_load";

export const options = {
  scenarios: {
    completions: {
      executor: "constant-vus",
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || "30s",
      exec: "completion",
    },
    models: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.MODEL_RPS || 5),
      timeUnit: "1s",
      duration: __ENV.DURATION || "30s",
      preAllocatedVUs: 5,
      exec: "models",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

export function completion() {
  const response = http.post(
    `${baseUrl}/v1/chat/completions`,
    JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: "load-test" }],
    }),
    { headers, tags: { operation: "chat_completions" } },
  );
  check(response, { "completion status 200": (r) => r.status === 200 });
  sleep(0.05);
}

export function models() {
  const response = http.get(`${baseUrl}/v1/models`, {
    headers,
    tags: { operation: "models" },
  });
  check(response, { "models status 200": (r) => r.status === 200 });
}

export function stream() {
  const response = http.post(
    `${baseUrl}/v1/chat/completions`,
    JSON.stringify({
      model: "auto",
      messages: [{ role: "user", content: "stream-load-test" }],
      stream: true,
    }),
    { headers, tags: { operation: "streaming" }, timeout: "60s" },
  );
  check(response, {
    "stream status 200": (r) => r.status === 200,
    "stream completed": (r) => r.body.includes("[DONE]"),
  });
}
