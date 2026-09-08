import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthForm } from "./auth-form";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  cleanup(); mockedCreateClient.mockReset();
  mockedCreateClient.mockReturnValue({ auth: { signInWithOtp: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn() } } as never);
});

test("uses a generic message for a rejected password sign-in", async () => {
  const signInWithPassword = vi.fn().mockResolvedValue({ error: { message: "invalid login credentials" } });
  mockedCreateClient.mockReturnValue({ auth: { signInWithPassword } } as never);
  render(<AuthForm />);
  fireEvent.click(screen.getByRole("button", { name: "Use a password" }));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "user@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: "user@example.com", password: "password1" }));
  expect(screen.getByText("Email or password is incorrect.")).toBeVisible();
});

test("keeps magic links available", async () => {
  const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
  mockedCreateClient.mockReturnValue({ auth: { signInWithOtp } } as never);
  render(<AuthForm />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "user@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
  await waitFor(() => expect(signInWithOtp).toHaveBeenCalledOnce());
  expect(screen.getByText("Check your email for the secure sign-in link.")).toBeVisible();
});

test("emails an existing user a password setup link", async () => {
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
  mockedCreateClient.mockReturnValue({ auth: { resetPasswordForEmail } } as never);
  render(<AuthForm />);
  fireEvent.click(screen.getByRole("button", { name: "Use a password" }));
  fireEvent.click(screen.getByRole("button", { name: "Set or reset password" }));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "user@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Email password link" }));
  await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", expect.objectContaining({ redirectTo: expect.stringContaining("/auth/update-password") })));
});
