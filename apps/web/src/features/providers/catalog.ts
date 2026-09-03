import type { ProviderKind } from "@/features/shared/types";

export type ProviderMeta = {
  kind: Exclude<ProviderKind, "test">;
  name: string;
  company: string;
  description: string;
  mark: string;
};

export const PROVIDER_CATALOG: ProviderMeta[] = [
  { kind: "openai", name: "OpenAI", company: "OpenAI", description: "GPT and reasoning models through the direct API.", mark: "OA" },
  { kind: "anthropic", name: "Anthropic", company: "Anthropic", description: "Claude models through the direct Anthropic API.", mark: "AN" },
  { kind: "gemini", name: "Gemini", company: "Google", description: "Gemini models from Google AI Studio.", mark: "G" },
  { kind: "groq", name: "Groq", company: "Groq", description: "Low-latency hosted inference and free-capable models.", mark: "GQ" },
  { kind: "xai", name: "xAI", company: "xAI", description: "Grok language models through the direct xAI API.", mark: "x" },
  { kind: "mistral", name: "Mistral", company: "Mistral AI", description: "Mistral and Codestral-family models through La Plateforme.", mark: "M" },
  { kind: "openrouter", name: "OpenRouter", company: "OpenRouter", description: "A broad catalog across many model vendors, including free variants.", mark: "OR" },
];

export function providerMeta(kind: string) {
  return PROVIDER_CATALOG.find((provider) => provider.kind === kind);
}
