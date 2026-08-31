import { render, screen } from "@testing-library/react";
import { vi, test, expect } from "vitest";
import { OnboardingClient } from "./onboarding-client";

vi.mock("@/lib/gateway/manage", () => ({ manageFetch: vi.fn().mockResolvedValue({ providers: [], routes: [], keys: [], onboarding_complete: false }) }));

test("starts with the guided use and provider connection step", async () => {
  render(<OnboardingClient />);
  expect(await screen.findByText("What will SwitchRoute handle?")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Connect a provider" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
});
