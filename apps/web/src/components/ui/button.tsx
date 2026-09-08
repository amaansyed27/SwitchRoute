import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-foreground)] border-[var(--accent)] hover:brightness-95 hover:shadow-[0_6px_18px_color-mix(in_srgb,var(--accent)_20%,transparent)] dark:hover:brightness-110",
  secondary: "bg-[var(--surface)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
  ghost: "bg-transparent text-[var(--muted-foreground)] border-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
  danger: "bg-transparent text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

export function buttonClass({ variant = "primary", size = "md", className = "" }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "sr-motion-control inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-medium outline-none disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
    variants[variant], sizes[size], className,
  );
}

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
