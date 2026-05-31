import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "~/components/ui/alert";
import { Badge as ShadcnBadge } from "~/components/ui/badge";
import { Button as ShadcnButton } from "~/components/ui/button";
import {
  Card as ShadcnCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

type LegacyButtonVariant = "primary" | "danger" | "ghost" | "icon" | "secondary";

function mapButtonVariant(variant?: LegacyButtonVariant) {
  if (variant === "primary") return "default";
  if (variant === "danger") return "destructive";
  if (variant === "secondary") return "secondary";
  if (variant === "ghost" || variant === "icon") return "ghost";
  return "outline";
}

function mapButtonSize(variant?: LegacyButtonVariant) {
  return variant === "icon" ? "icon" : "default";
}

export function Button({ className, variant, ...props }: ComponentProps<"button"> & { variant?: LegacyButtonVariant }) {
  return (
    <ShadcnButton
      className={className}
      variant={mapButtonVariant(variant)}
      size={mapButtonSize(variant)}
      {...props}
    />
  );
}

export function LinkButton({ className, variant, href = "#", ...props }: ComponentProps<"a"> & { variant?: LegacyButtonVariant }) {
  return (
    <ShadcnButton asChild variant={mapButtonVariant(variant)} size={mapButtonSize(variant)} className={className}>
      <a href={href} {...props} />
    </ShadcnButton>
  );
}

export const linkButtonClass = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:border-primary/35 hover:bg-primary/8";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ShadcnCard className={cn("shadow-none", className)}>
      <CardContent className="p-4 compact:p-3">{children}</CardContent>
    </ShadcnCard>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ShadcnCard className={cn("shadow-none transition-colors", className)}>
      <CardContent className="p-4">{children}</CardContent>
    </ShadcnCard>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4 border-b border-border/70 pb-4 max-lg:grid">
      <div className="min-w-0">
        <h1 className="m-0 text-[clamp(22px,2.4vw,32px)] font-semibold leading-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionTitle({ title, meta, actions }: { title: string; meta?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-[14px] font-semibold text-foreground">{title}</h2>
        {meta ? <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground [&_input]:min-h-8 [&_input]:w-full [&_select]:min-h-8 [&_select]:w-full [&_textarea]:min-h-24 [&_textarea]:w-full">
      <span>{label}</span>
      {children}
    </label>
  );
}

const destructiveTones = new Set(["critical", "failed", "failure", "danger", "error", "blocked"]);
const warningTones = new Set(["draft", "pending", "open", "warning", "running", "queued"]);
const successTones = new Set(["active", "ready", "validated", "success", "completed", "resolved", "ok"]);
const infoTones = new Set(["characters", "storyline", "generation", "assets", "versions", "exports", "settings", "info"]);

export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const key = (tone || String(children)).toLowerCase();
  const toneClass = destructiveTones.has(key)
    ? "border-destructive/25 bg-destructive/10 text-destructive"
    : successTones.has(key)
      ? "border-success/25 bg-success/10 text-success"
      : warningTones.has(key)
        ? "border-warning/25 bg-warning/10 text-warning"
        : infoTones.has(key)
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-border bg-secondary text-secondary-foreground";

  return (
    <ShadcnBadge
      variant="outline"
      className={cn("rounded-md px-1.5 py-0 text-[11px] font-medium uppercase tracking-normal", toneClass, className)}
    >
      {children}
    </ShadcnBadge>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Alert className="border-border bg-secondary/25">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </Alert>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="grid gap-2.5 rounded-lg border border-dashed border-border bg-card p-5">
      <strong className="text-sm text-foreground">{label}</strong>
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <ShadcnCard className="shadow-none">
      <CardContent className="grid min-h-24 content-between gap-3 p-4">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <b className="block text-2xl font-semibold leading-none text-foreground">{value}</b>
      </CardContent>
    </ShadcnCard>
  );
}

export function RouterLinkButton({ className, variant, to, children }: { className?: string; variant?: LegacyButtonVariant; to: string; children: ReactNode }) {
  return (
    <ShadcnButton asChild variant={mapButtonVariant(variant)} className={className}>
      <Link to={to}>{children}</Link>
    </ShadcnButton>
  );
}

export function toCsv(values: string[] | undefined) {
  return (values || []).join(", ");
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export { clsx };
