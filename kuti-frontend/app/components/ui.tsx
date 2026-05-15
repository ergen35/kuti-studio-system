import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

const buttonBase = "inline-flex min-h-9 items-center justify-center gap-2 rounded-[7px] border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent compact:min-h-8 compact:px-2.5 compact:py-1.5";
const buttonVariants = {
  default: "border-line bg-surface text-ink hover:bg-surface-2",
  primary: "border-accent bg-accent text-accent-ink hover:brightness-95",
  danger: "border-danger/50 bg-surface text-danger hover:bg-danger/10",
  ghost: "border-transparent bg-transparent text-ink hover:border-line hover:bg-surface-2",
  icon: "h-9 w-9 border-line bg-surface p-0 text-ink hover:bg-surface-2 compact:h-8 compact:w-8",
};

export const linkButtonClass = clsx(buttonBase, buttonVariants.default);

export function Button({ className, variant, ...props }: ComponentProps<"button"> & { variant?: "primary" | "danger" | "ghost" | "icon" }) {
  return <button className={clsx(buttonBase, buttonVariants[variant ?? "default"], className)} {...props} />;
}

export function LinkButton({ className, variant, ...props }: ComponentProps<"a"> & { variant?: "primary" | "danger" | "ghost" | "icon" }) {
  return <a className={clsx(buttonBase, buttonVariants[variant ?? "default"], className)} {...props} />;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx("rounded-[7px] border border-line bg-surface p-3.5 shadow-card compact:p-2.5", className)}>{children}</section>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={clsx("rounded-[7px] border border-line bg-surface p-3.5 shadow-card", className)}>{children}</article>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4 max-lg:grid">
      <div className="min-w-0">
        <h1 className="m-0 text-[clamp(25px,3vw,38px)] font-bold leading-[1.06] text-ink">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 truncate text-[15px] font-semibold text-ink">{title}</h2>
        {meta ? <span className="text-xs text-muted">{meta}</span> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 [&_input]:min-h-9 [&_input]:w-full [&_input]:rounded-[7px] [&_input]:border [&_input]:border-line [&_input]:bg-surface [&_input]:px-2.5 [&_input]:py-2 [&_input]:text-ink [&_input]:outline-none [&_input]:transition-colors [&_input]:focus:border-accent [&_select]:min-h-9 [&_select]:w-full [&_select]:rounded-[7px] [&_select]:border [&_select]:border-line [&_select]:bg-surface [&_select]:px-2.5 [&_select]:py-2 [&_select]:text-ink [&_select]:outline-none [&_select]:focus:border-accent [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[7px] [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-surface [&_textarea]:px-2.5 [&_textarea]:py-2 [&_textarea]:leading-6 [&_textarea]:text-ink [&_textarea]:outline-none [&_textarea]:focus:border-accent">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}

const toneClasses: Record<string, string> = {
  active: "border-success/45 text-success",
  ok: "border-success/45 text-success",
  ready: "border-success/45 text-success",
  validated: "border-success/45 text-success",
  resolved: "border-success/45 text-success",
  draft: "border-draft/45 text-draft",
  pending: "border-draft/45 text-draft",
  open: "border-draft/45 text-draft",
  critical: "border-danger/45 text-danger",
  failed: "border-danger/45 text-danger",
  danger: "border-danger/45 text-danger",
  warning: "border-warning/45 text-warning",
  running: "border-warning/45 text-warning",
  info: "border-accent/45 text-accent",
};

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = (tone || String(children)).toLowerCase();
  return <span className={clsx("inline-flex min-h-5 w-fit items-center rounded-full border border-line px-2 py-0.5 text-xs leading-tight text-muted", toneClasses[key], className)}>{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-start gap-2.5 rounded-[7px] border border-dashed border-line bg-surface/70 p-5">
      <strong className="text-sm text-ink">{title}</strong>
      {description ? <span className="text-xs leading-5 text-muted">{description}</span> : null}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-[7px] border border-danger/45 bg-danger/10 p-4 text-danger"><strong className="text-sm">{message}</strong></div>;
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <div className="grid place-items-start gap-2.5 rounded-[7px] border border-dashed border-line bg-surface/70 p-5"><strong className="text-sm text-ink">{label}</strong><span className="text-xs text-muted">Waiting for the local backend response.</span></div>;
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return <div className="rounded-[7px] border border-line bg-surface p-3.5"><b className="block text-2xl leading-none text-ink">{value}</b><span className="mt-2 block text-xs text-muted">{label}</span></div>;
}

export function toCsv(values: string[] | undefined) {
  return (values || []).join(", ");
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
