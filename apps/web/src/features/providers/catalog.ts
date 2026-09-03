import type { ProviderCatalogEntry, ProviderCategory } from "@/features/shared/types";

export const PROVIDER_CATEGORIES: { id: ProviderCategory; label: string; description: string }[] = [
  { id: "direct", label: "Direct", description: "Model vendors and first-party APIs." },
  { id: "inference", label: "Inference", description: "Hosted inference platforms for open and partner models." },
  { id: "gateway", label: "Gateways", description: "Multi-provider routers and compatible hosted endpoints." },
];

export const PROVIDER_CATALOG: { kind: ProviderCategory; name: string; mark: string }[] =
  PROVIDER_CATEGORIES.map((category) => ({
    kind: category.id,
    name: category.label,
    mark: category.id === "direct" ? "D" : category.id === "inference" ? "I" : "G",
  }));

type DisplayProviderMeta = ProviderCatalogEntry & { kind: string; name: string };

function decorate(provider: ProviderCatalogEntry): DisplayProviderMeta {
  return { ...provider, kind: provider.id, name: provider.display_name };
}

function humanizeProviderKind(kind: string): DisplayProviderMeta {
  const displayName = kind
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    id: kind,
    kind,
    name: displayName || kind,
    display_name: displayName || kind,
    company: "",
    category: "gateway",
    auth_type: "api_key",
    litellm_mapping: "",
    supports_model_discovery: false,
    free_usage_may_exist: null,
    documentation_slug: kind.replace(/_/g, "-"),
    description: "",
    mark: kind.slice(0, 2).toUpperCase(),
    requires_base_url: false,
    supports_manual_model: false,
  };
}

export function providerMeta(catalog: ProviderCatalogEntry[], kind: string): DisplayProviderMeta | undefined;
export function providerMeta(kind: string): DisplayProviderMeta;
export function providerMeta(
  catalogOrKind: ProviderCatalogEntry[] | string,
  maybeKind?: string,
): DisplayProviderMeta | undefined {
  if (typeof catalogOrKind === "string") return humanizeProviderKind(catalogOrKind);
  const provider = catalogOrKind.find((entry) => entry.id === maybeKind);
  return provider ? decorate(provider) : undefined;
}
