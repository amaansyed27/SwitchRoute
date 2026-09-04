export type ProviderKind = string;
export type ProviderCategory = "direct" | "inference" | "gateway";
export type BillingTier = "free" | "free_capable" | "paid" | "unknown";
export type MetadataProvenance = "provider" | "litellm" | "curated" | "unknown";
export type RouteStrategy = "priority" | "free_first" | "quota_aware" | "fastest" | "cheapest" | "balanced";
export type PaidFallback = "never" | "after_free" | "allowed";
export type QuotaSource = "exact" | "observed" | "estimated" | "catalog" | "unknown";

export type ProviderCatalogEntry = {
  id: string;
  display_name: string;
  company: string;
  category: ProviderCategory;
  auth_type: "api_key" | "api_key_and_endpoint";
  litellm_mapping: string;
  supports_model_discovery: boolean;
  free_usage_may_exist: boolean | null;
  documentation_slug: string;
  description: string;
  mark: string;
  requires_base_url: boolean;
  supports_manual_model: boolean;
};

export type ModelOption = {
  id: string;
  name: string;
  billing_tier: BillingTier;
  input_price_per_million_usd?: number | null;
  output_price_per_million_usd?: number | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  capabilities?: string[];
  metadata_provenance?: MetadataProvenance;
  discovered_at?: string;
};

export type ProviderConnection = {
  id: string;
  provider_kind: ProviderKind;
  display_name: string;
  status: "healthy" | "degraded" | "invalid" | "unknown";
  metadata: {
    models?: ModelOption[];
    connection?: {
      base_url?: string;
      discover_models?: boolean;
      manual_model_id?: string | null;
    };
  };
  last_validated_at?: string | null;
  created_at: string;
};

export type QuotaMetric = {
  limit?: number | null;
  remaining?: number | null;
  reset_at?: string | null;
  window_seconds?: number | null;
  source: QuotaSource;
  confidence?: number | null;
};

export type TargetRuntime = {
  state_available: boolean;
  health: { circuit_state: "closed" | "open" | "half_open"; consecutive_failures: number; last_error?: string | null };
  quota: Record<"rpm" | "tpm" | "rpd" | "tpd" | "concurrency", QuotaMetric>;
  quota_source: QuotaSource;
  quota_confidence?: number | null;
  latency_ewma_ms?: number | null;
  latency_samples: number;
  latency_confidence: "low" | "medium" | "high";
  ttft_ewma_ms?: number | null;
};

export type RouteTarget = {
  id?: string;
  provider_connection_id: string;
  provider_kind?: string;
  model_id: string;
  position?: number;
  billing_tier: BillingTier;
  enabled: boolean;
  routing_state?: TargetRuntime;
};

export type RouteRecord = {
  id: string;
  name: string;
  slug: string;
  strategy: RouteStrategy;
  enabled: boolean;
  paid_fallback: PaidFallback;
  daily_paid_cap_microusd?: number | null;
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

export type RoutingDecision = {
  strategy?: RouteStrategy;
  effective_strategy?: RouteStrategy | "priority";
  degraded_reason?: string | null;
  selected?: { provider?: string; model?: string; reason?: string };
  fallback_count?: number;
  path?: Array<{ provider: string; model: string; outcome: string }>;
  excluded?: Array<{ provider: string; model: string; reason: string }>;
  quota?: { source?: QuotaSource; confidence?: number | null };
  circuit_state?: string;
  latency_confidence?: string;
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
  ttft_ms?: number | null;
  estimated_cost_microusd?: number | null;
  status: "success" | "error";
  fallback_count: number;
  error_category?: string | null;
  routing_decision?: RoutingDecision;
};
