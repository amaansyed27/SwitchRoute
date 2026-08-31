import { render, screen } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { OnboardingClient } from "./onboarding-client";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn().mockResolvedValue({ providers: [], routes: [], keys: [], onboarding_complete: false }) }));

test("starts with the guided use and provider step", async () => {
  render(<OnboardingClient />);
  expect(await screen.findByText("What will SwitchRoute handle?")).toBeInTheDocument();
  expect(screen.getByText("Connect your first provider.", { exact: false })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
});
