export type ChatRole = "system" | "developer" | "user" | "assistant" | "tool" | string;

export interface ChatMessage {
  role: ChatRole;
  content: unknown;
  [key: string]: unknown;
}

export interface ChatCompletionCreateParams {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: unknown[];
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: unknown[];
  [key: string]: unknown;
}

export interface Model {
  id: string;
  object: "model" | string;
  created: number;
  owned_by: string;
  [key: string]: unknown;
}

export interface ModelList {
  object: "list" | string;
  data: Model[];
}

export interface ClientOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  dangerouslyAllowBrowser?: boolean;
  fetch?: typeof globalThis.fetch;
}
