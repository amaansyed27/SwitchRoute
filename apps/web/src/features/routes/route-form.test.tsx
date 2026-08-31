import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { RouteForm } from "./route-form";
import { manageFetch } from "@/lib/gateway/manage";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn() }));
const mocked = vi.mocked(manageFetch);
const providers = [{ id: "p1", provider_kind: "groq" as const, display_name: "Groq", status: "healthy" as const, metadata: { models: [{ id: "model-a", name: "Model A", billing_tier: "free_capable" as const }] }, created_at: new Date().toISOString() }];

test("creates a route from a real target stack", async () => {
  mocked.mockResolvedValue({ id: "r1" } as never);
  const saved = vi.fn();
  render(<RouteForm providers={providers} onSaved={saved} onCancel={() => {}} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Coding" } });
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save Route" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(mocked).toHaveBeenCalledWith("routes", expect.objectContaining({ method: "POST", body: expect.stringContaining("model-a") }));
});
