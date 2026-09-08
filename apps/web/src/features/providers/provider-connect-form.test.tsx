import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi, test, expect } from "vitest";
import { ProviderConnectForm } from "./provider-connect-form";
import { manageFetch } from "@/lib/gateway/manage";
import type { ProviderCatalogEntry } from "@/features/shared/types";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn() }));
const mocked = vi.mocked(manageFetch);

beforeEach(() => {
  cleanup();
  mocked.mockReset();
});

const openai: ProviderCatalogEntry = {
  id: "openai",
  display_name: "OpenAI",
  company: "OpenAI",
  category: "direct",
  auth_type: "api_key",
  litellm_mapping: "openai",
  supports_model_discovery: true,
  free_usage_may_exist: false,
  documentation_slug: "openai",
  description: "Direct API",
  mark: "OA",
  requires_base_url: false,
  supports_manual_model: false,
};

const custom: ProviderCatalogEntry = {
  id: "custom_openai",
  display_name: "Custom OpenAI-compatible",
  company: "Custom",
  category: "gateway",
  auth_type: "api_key_and_endpoint",
  litellm_mapping: "openai",
  supports_model_discovery: true,
  free_usage_may_exist: null,
  documentation_slug: "custom-openai",
  description: "Custom API",
  mark: "<>",
  requires_base_url: true,
  supports_manual_model: true,
};

test("validates before saving a provider", async () => {
  const connected = vi.fn();
  mocked
    .mockResolvedValueOnce({
      models: [{ id: "model-a", name: "Model A", billing_tier: "free_capable" }],
    } as never)
    .mockResolvedValueOnce({
      id: "p1",
      provider_kind: "openai",
      display_name: "OpenAI",
      status: "healthy",
      metadata: { models: [] },
      created_at: new Date().toISOString(),
    } as never);
  render(<ProviderConnectForm provider={openai} onConnected={connected} />);
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk_test" } });
  fireEvent.click(screen.getByRole("button", { name: "Test credential" }));
  await screen.findByText(/Credential validated/);
  fireEvent.click(screen.getByRole("button", { name: "Save connection" }));
  await waitFor(() => expect(connected).toHaveBeenCalledOnce());
  expect(mocked).toHaveBeenNthCalledWith(
    1,
    "providers/validate",
    expect.objectContaining({ method: "POST" }),
  );
  expect(mocked).toHaveBeenNthCalledWith(
    2,
    "providers",
    expect.objectContaining({ method: "POST" }),
  );
});

test("sends public endpoint configuration for custom OpenAI connections", async () => {
  mocked.mockResolvedValueOnce({
    models: [{ id: "custom-model", name: "custom-model", billing_tier: "unknown" }],
  } as never);
  render(<ProviderConnectForm provider={custom} onConnected={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Base URL"), {
    target: { value: "https://models.example/v1" },
  });
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: "secret-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Test credential" }));
  await screen.findByText(/Credential validated/);
  const [, request] = mocked.mock.calls.at(-1)!;
  const payload = JSON.parse(String(request?.body));
  expect(payload.connection).toEqual(
    expect.objectContaining({
      base_url: "https://models.example/v1",
      discover_models: true,
    }),
  );
});
