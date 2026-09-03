export type ProviderKind = string;
export type ProviderCategory = "direct" | "inference" | "gateway";
export type BillingTier = "free" | "free_capable" | "paid" | "unknown";
export type MetadataProvenance = "provider" | "litellm" | "curated" | "unknown";

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

export type RouteTarget = {
  id?: string;
  provider_connection_id: string;
  model_id: string;
  position?: number;
  billing_tier: BillingTier;
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
