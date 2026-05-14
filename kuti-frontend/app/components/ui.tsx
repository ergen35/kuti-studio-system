import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Button({ className, variant, ...props }: ComponentProps<"button"> & { variant?: "primary" | "danger" | "ghost" | "icon" }) {
  return <button className={clsx("button", variant, className)} {...props} />;
}

export function LinkButton({ className, variant, ...props }: ComponentProps<"a"> & { variant?: "primary" | "danger" | "ghost" | "icon" }) {
  return <a className={clsx("button", variant, className)} {...props} />;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("panel", className)}>{children}</section>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={clsx("card", className)}>{children}</article>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  return <span className={clsx("badge", tone || String(children).toLowerCase())}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {description ? <span className="meta">{description}</span> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="error"><strong>{message}</strong></div>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="empty"><strong>{label}</strong><span className="meta">Waiting for the local backend response.</span></div>;
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

export function toCsv(values: string[] | undefined) {
  return (values || []).join(", ");
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
