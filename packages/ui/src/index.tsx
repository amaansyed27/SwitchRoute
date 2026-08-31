import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`sr-button ${className}`.trim()} {...props} />;
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`sr-input ${className}`.trim()} {...props} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label className="sr-label" htmlFor={htmlFor}>{children}</label>;
}

export function Badge({ children, tone = "default" }: PropsWithChildren<{ tone?: "default" | "success" | "warning" | "danger" }>) {
  return <span className={`sr-badge sr-badge-${tone}`}>{children}</span>;
}

export function Panel({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`sr-panel ${className}`.trim()}>{children}</section>;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="sr-empty">
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  const tone = status === "healthy" || status === "success" || status === "active" ? "success" : status === "error" || status === "invalid" || status === "revoked" ? "danger" : "warning";
  return <span className={`sr-status sr-status-${tone}`} aria-label={status} title={status} />;
}
