import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi, test, expect } from "vitest";
import { RouteForm } from "./route-form";
import { manageFetch } from "@/lib/gateway/manage";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn() }));
const mocked = vi.mocked(manageFetch);
const createdAt = new Date().toISOString();
const providers = [
  { id: "p1", provider_kind: "groq" as const, display_name: "Groq primary", status: "healthy" as const, metadata: { models: [{ id: "model-a", name: "Model A", billing_tier: "free_capable" as const }] }, created_at: createdAt },
  { id: "p2", provider_kind: "groq" as const, display_name: "Groq backup", status: "healthy" as const, metadata: { models: [{ id: "model-a", name: "Model A", billing_tier: "free_capable" as const }] }, created_at: createdAt },
];

beforeEach(() => {
  cleanup();
  mocked.mockReset();
});

test("creates a waterfall from a real target stack", async () => {
  mocked.mockResolvedValue({ id: "r1" } as never);
  const saved = vi.fn();
  render(<RouteForm providers={providers} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Coding" } });
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  fireEvent.click(screen.getByRole("button", { name: "Create waterfall" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(mocked).toHaveBeenCalledWith("routes", expect.objectContaining({ method: "POST", body: expect.stringContaining("model-a") }));
});

test("allows two API-key connections from the same provider in one waterfall", async () => {
  mocked.mockResolvedValue({ id: "r2" } as never);
  const saved = vi.fn();
  render(<RouteForm providers={providers} onSaved={saved} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Groq rollover" } });
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));

  const providerSelectors = screen.getAllByLabelText("Provider");
  expect(providerSelectors).toHaveLength(2);
  fireEvent.change(providerSelectors[1], { target: { value: "p2" } });

  fireEvent.click(screen.getByRole("button", { name: "Create waterfall" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());

  const [, request] = mocked.mock.calls.at(-1)!;
  const payload = JSON.parse(String(request?.body));
  expect(payload.targets.map((target: { provider_connection_id: string }) => target.provider_connection_id)).toEqual(["p1", "p2"]);
});


test("new waterfalls require an explicit choice before allowing paid fallback", async () => {
  mocked.mockResolvedValue({ id: "safe" } as never);
  render(<RouteForm providers={providers} onSaved={vi.fn()} />);
  expect(screen.getByLabelText("Paid fallback")).toHaveValue("never");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Safe" } });
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  expect(screen.getByRole("option", { name: /Model A.*Account-dependent/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create waterfall" }));
  await waitFor(() => expect(mocked).toHaveBeenCalled());
  expect(JSON.parse(mocked.mock.calls[0][1]!.body as string).paid_fallback).toBe("never");
});


test("moves fallback accounts without changing their models", async () => {
  mocked.mockResolvedValue({ id: "ordered" } as never);
  render(<RouteForm providers={providers} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ordered" } });
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  fireEvent.click(screen.getByRole("button", { name: /Add model/ }));
  fireEvent.change(screen.getAllByLabelText("Provider")[1], { target: { value: "p2" } });
  fireEvent.click(screen.getByRole("button", { name: "Move target 2 up" }));
  fireEvent.click(screen.getByRole("button", { name: "Create waterfall" }));
  await waitFor(() => expect(mocked).toHaveBeenCalled());
  const payload = JSON.parse(String(mocked.mock.calls[0][1]?.body));
  expect(payload.targets.map((target: {provider_connection_id: string}) => target.provider_connection_id)).toEqual(["p2", "p1"]);
});
