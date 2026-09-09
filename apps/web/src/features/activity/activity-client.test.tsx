import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ActivityClient } from "./activity-client";
import { manageFetch } from "@/lib/gateway/manage";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn() }));
afterEach(cleanup);

test("filters requests by outcome and explains empty search results", async () => {
  vi.mocked(manageFetch).mockResolvedValue([
    { request_id: "one", created_at: "2026-09-09T00:00:00Z", model_id: "primary-model", route_name: "Production", status: "success", latency_ms: 240, fallback_count: 0 },
    { request_id: "two", created_at: "2026-09-09T00:01:00Z", model_id: "backup-model", route_name: "Production", status: "error", latency_ms: 500, fallback_count: 1 },
  ]);
  render(<ActivityClient/>);
  expect(await screen.findByText("primary-model")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Request status"), { target: { value: "error" } });
  expect(screen.queryByText("primary-model")).not.toBeInTheDocument();
  expect(screen.getByText("backup-model")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Filter activity"), { target: { value: "absent" } });
  expect(screen.getByText("No matching requests")).toBeVisible();
});
