import { errorFromResponse, RequestTimeoutError, SwitchRouteError } from "./errors.js";
import { decodeSSE } from "./sse.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ClientOptions,
  ModelList,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.switchroute.dawnlightlabs.com/v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.document !== "undefined";
}

export class SwitchRoute {
  readonly chat: { completions: ChatCompletions };
  readonly models: Models;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: ClientOptions) {
    if (!options.apiKey) throw new SwitchRouteError("apiKey is required.", { code: "configuration_error" });
    if (isBrowser() && !options.dangerouslyAllowBrowser) {
      throw new SwitchRouteError(
        "Browser use is disabled by default because it exposes your SwitchRoute key. Set dangerouslyAllowBrowser only for an intentionally public/restricted key.",
        { code: "configuration_error" },
      );
    }
    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new SwitchRouteError("No fetch implementation is available.", { code: "configuration_error" });
    this.chat = { completions: new ChatCompletions(this) };
    this.models = new Models(this);
  }

  async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseURL}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "switchroute-js/0.4.0",
          ...init.headers,
        },
      });
      if (!response.ok) throw await errorFromResponse(response);
      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RequestTimeoutError("SwitchRoute request timed out.", { code: "timeout" });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream<T>(path: string, body: unknown): AsyncGenerator<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(`${this.baseURL}${path}`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "User-Agent": "switchroute-js/0.4.0",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await errorFromResponse(response);
      if (!response.body) throw new SwitchRouteError("Streaming response had no body.", { code: "malformed_upstream_response" });
      yield* decodeSSE<T>(response.body);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RequestTimeoutError("SwitchRoute stream timed out.", { code: "timeout" });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

class ChatCompletions {
  constructor(private readonly client: SwitchRoute) {}

  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>> {
    const payload = { model: "auto", ...params };
    if (payload.stream === true) {
      return this.client.stream<ChatCompletionChunk>("/chat/completions", payload);
    }
    return this.client.json<ChatCompletion>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

class Models {
  constructor(private readonly client: SwitchRoute) {}
  list(): Promise<ModelList> {
    return this.client.json<ModelList>("/models", { method: "GET" });
  }
}
