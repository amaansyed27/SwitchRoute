import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { UpdatePasswordForm } from "./update-password-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

test("does not submit mismatched passwords", () => {
  const updateUser = vi.fn();
  vi.mocked(createClient).mockReturnValue({ auth: { updateUser } } as never);
  render(<UpdatePasswordForm />);
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password1" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password2" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
  expect(screen.getByText("Passwords do not match.")).toBeVisible();
  expect(updateUser).not.toHaveBeenCalled();
});
