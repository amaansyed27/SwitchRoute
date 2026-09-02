export type ProviderKind = "openai" | "anthropic" | "gemini" | "groq" | "xai" | "mistral" | "openrouter" | "test";

export type ModelOption = {
  id: string;
  name: string;
  billing_tier: "free" | "free_capable" | "paid" | "unknown";
  capabilities?: string[];
};

export type ProviderConnection = {
  id: string;
  provider_kind: ProviderKind;
  display_name: string;
  status: "healthy" | "degraded" | "invalid" | "unknown";
  metadata: { models?: ModelOption[] };
  last_validated_at?: string | null;
  created_at: string;
};

export type RouteTarget = {
  id?: string;
  provider_connection_id: string;
  model_id: string;
  position?: number;
  billing_tier: ModelOption["billing_tier"];
  enabled: boolean;
};

export type RouteRecord = {
  id: string;
  name: string;
  slug: string;
  strategy: "priority" | "free_first";
  enabled: boolean;
  targets: RouteTarget[];
  created_at: string;
};

export type VirtualKey = {
  id: string;
  name: string;
  prefix: string;
  environment: "live" | "test";
  status: "active" | "revoked";
  route_id: string;
  route_name: string;
  last_used_at?: string | null;
  created_at: string;
  expires_at?: string | null;
};

export type ActivityRecord = {
  request_id: string;
  created_at: string;
  route_name: string;
  provider_kind?: string | null;
  model_id?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  latency_ms: number;
  status: "success" | "error";
  fallback_count: number;
  error_category?: string | null;
};
