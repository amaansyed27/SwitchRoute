import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <label htmlFor={htmlFor} className={cn("mb-1.5 block text-xs font-medium text-[var(--foreground)]", className)}>{children}</label>;
}

const control = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-foreground)] hover:border-[var(--border-strong)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ring)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-9 px-3 text-sm", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-9 px-3 text-sm", className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 resize-y px-3 py-2 text-sm", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0", className)}><Label htmlFor={htmlFor}>{label}</Label>{children}{hint && <p className="mt-1.5 text-xs leading-5 text-[var(--muted-foreground)]">{hint}</p>}</div>;
}
