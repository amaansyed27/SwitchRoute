import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { ProviderConnectForm } from "./provider-connect-form";
import { manageFetch } from "@/lib/gateway/manage";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn() }));
const mocked = vi.mocked(manageFetch);

test("validates before saving a provider", async () => {
  const connected = vi.fn();
  mocked.mockResolvedValueOnce({ models: [{ id: "model-a", name: "Model A", billing_tier: "free_capable" }] } as never)
    .mockResolvedValueOnce({ id: "p1", provider_kind: "openai", display_name: "OpenAI", status: "healthy", metadata: { models: [] }, created_at: new Date().toISOString() } as never);
  render(<ProviderConnectForm onConnected={connected} />);
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk_test" } });
  fireEvent.click(screen.getByRole("button", { name: "Test credential" }));
  await screen.findByText(/Credential validated/);
  fireEvent.click(screen.getByRole("button", { name: "Save connection" }));
  await waitFor(() => expect(connected).toHaveBeenCalledOnce());
  expect(mocked).toHaveBeenNthCalledWith(1, "providers/validate", expect.objectContaining({ method: "POST" }));
  expect(mocked).toHaveBeenNthCalledWith(2, "providers", expect.objectContaining({ method: "POST" }));
});
