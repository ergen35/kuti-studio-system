import { clsx } from "clsx";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { useTranslation } from "~/hooks/useTranslation";
import { cn } from "~/lib/utils";

type LegacyButtonVariant =
  | "primary"
  | "danger"
  | "ghost"
  | "icon"
  | "secondary";

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

export function Button({
  className,
  variant,
  ...props
}: ComponentProps<"button"> & { variant?: LegacyButtonVariant }) {
  return (
    <ShadcnButton
      className={className}
      variant={mapButtonVariant(variant)}
      size={mapButtonSize(variant)}
      {...props}
    />
  );
}

export function LinkButton({
  className,
  variant,
  href = "#",
  ...props
}: ComponentProps<"a"> & { variant?: LegacyButtonVariant }) {
  return (
    <ShadcnButton
      asChild
      variant={mapButtonVariant(variant)}
      size={mapButtonSize(variant)}
      className={className}
    >
      <a href={href} {...props} />
    </ShadcnButton>
  );
}

export const linkButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-medium hover:border-accent/30 hover:bg-accent-subtle";

export function Panel({
  children,
  className,
  elevated = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
}) {
  return (
    <ShadcnCard
      elevated={elevated}
      className={cn(elevated ? "" : "shadow-none hover:shadow-none", className)}
    >
      <CardContent className="p-4 compact:p-3">{children}</CardContent>
    </ShadcnCard>
  );
}

export const Card = forwardRef<
  HTMLDivElement,
  { children: ReactNode; className?: string; elevated?: boolean }
>(function Card({ children, className, elevated = false }, ref) {
  return (
    <ShadcnCard ref={ref} elevated={elevated} className={className}>
      <CardContent className="p-4">{children}</CardContent>
    </ShadcnCard>
  );
});

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4 border-b border-line/50 pb-5 max-lg:grid">
      <div className="min-w-0">
        <h1 className="m-0 text-[clamp(24px,2.5vw,32px)] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

export function SectionTitle({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {meta ? (
          <p className="mt-0.5 text-xs text-muted">{meta}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-xs font-medium text-muted [&_input]:min-h-8 [&_input]:w-full [&_select]:min-h-8 [&_select]:w-full [&_textarea]:min-h-24 [&_textarea]:w-full">
      <span>{label}</span>
      {children}
    </label>
  );
}

const destructiveTones = new Set([
  "critical",
  "failed",
  "failure",
  "danger",
  "error",
  "blocked",
]);
const warningTones = new Set([
  "draft",
  "pending",
  "open",
  "warning",
  "running",
  "queued",
  "maintenance",
]);
const successTones = new Set([
  "active",
  "ready",
  "validated",
  "success",
  "completed",
  "resolved",
  "ok",
]);
const infoTones = new Set([
  "characters",
  "storyline",
  "generation",
  "dramavideos",
  "drama-videos",
  "assets",
  "versions",
  "exports",
  "settings",
  "info",
]);

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: string;
  className?: string;
}) {
  const key = (tone || String(children)).toLowerCase();
  const toneClass = destructiveTones.has(key)
    ? "bg-danger/12 text-danger"
    : successTones.has(key)
      ? "bg-success/12 text-success"
      : warningTones.has(key)
        ? "bg-warning/12 text-warning"
        : infoTones.has(key)
          ? "bg-accent/12 text-accent"
          : "bg-surface-3 text-ink";

  return (
    <ShadcnBadge
      variant="secondary"
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        toneClass,
        className,
      )}
    >
      {children}
    </ShadcnBadge>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Alert className="animate-[fade-in_200ms_ease-out] border-line/50 bg-surface-2/50">
      <AlertTitle className="text-ink">{title}</AlertTitle>
      {description ? (
        <AlertDescription className="text-muted">{description}</AlertDescription>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Alert>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive" role="alert" className="animate-[shake_400ms_ease-out]">
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation("common");
  const resolvedLabel = label ?? t("states.loading");

  return (
    <div
      className="grid gap-3 rounded-xl border border-dashed border-line/60 bg-surface p-5 animate-[fade-in_200ms_ease-out]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <strong className="text-sm text-ink">{resolvedLabel}</strong>
      <Skeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

export function Stat({
  value,
  label,
  icon,
}: {
  value: number | string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <ShadcnCard className="group shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated">
      <CardContent className="grid min-h-24 content-between gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="block text-xs font-medium text-muted">
            {label}
          </span>
          {icon ? (
            <span className="text-muted transition-all duration-150 group-hover:text-accent group-hover:scale-110">{icon}</span>
          ) : null}
        </div>
        <b className="block text-2xl font-semibold leading-none tracking-tight text-ink">
          {value}
        </b>
      </CardContent>
    </ShadcnCard>
  );
}

export function RouterLinkButton({
  className,
  variant,
  to,
  children,
}: {
  className?: string;
  variant?: LegacyButtonVariant;
  to: string;
  children: ReactNode;
}) {
  return (
    <ShadcnButton
      asChild
      variant={mapButtonVariant(variant)}
      className={className}
    >
      <Link to={to}>{children}</Link>
    </ShadcnButton>
  );
}

export function toCsv(values: string[] | undefined) {
  return (values || []).join(", ");
}

export function dateLabel(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export { clsx };
