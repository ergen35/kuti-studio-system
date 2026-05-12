import type { ReactNode } from "react";
import { Card } from "../ui";
import { cn } from "../../lib/cn";

interface WorkspaceFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  toolbar?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  className?: string;
}

export function WorkspaceFrame({ eyebrow, title, description, toolbar, left, center, right, className }: WorkspaceFrameProps) {
  return (
    <div className={cn("space-y-5", className)}>
      <Card className="border-[rgb(var(--border)/0.72)] bg-[rgb(var(--kuti-surface-1)/0.82)] p-5 sm:p-6 lg:p-7" padding="none">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[rgb(var(--muted-foreground))] sm:text-[11px]">{eyebrow}</div>
            <div>
              <h1 className="text-[clamp(1.75rem,4vw,3rem)] font-semibold tracking-tight text-[rgb(var(--foreground))]">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgb(var(--muted-foreground))]">{description}</p>
            </div>
          </div>
          {toolbar ? <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">{toolbar}</div> : null}
        </div>
      </Card>

      <div className="space-y-4 xl:hidden">
        <div className="space-y-5">{center}</div>

        {left ? (
          <details className="group rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--kuti-surface-1)/0.9)] shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--kuti-surface-2))] group-open:border-b group-open:border-[rgb(var(--border))]">
              <span>Context</span>
              <span className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Expand</span>
            </summary>
            <div className="space-y-4 p-4 sm:p-5">{left}</div>
          </details>
        ) : null}

        {right ? (
          <details className="group rounded-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--kuti-surface-1)/0.9)] shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[rgb(var(--foreground))] transition hover:bg-[rgb(var(--kuti-surface-2))] group-open:border-b group-open:border-[rgb(var(--border))]">
              <span>Inspector</span>
              <span className="text-xs uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Expand</span>
            </summary>
            <div className="space-y-4 p-4 sm:p-5">{right}</div>
          </details>
        ) : null}
      </div>

      <div className="hidden gap-5 xl:grid xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)_minmax(16rem,19rem)]">
        <div className="space-y-5">{left}</div>
        <div className="space-y-5">{center}</div>
        <div className="space-y-5">{right}</div>
      </div>
    </div>
  );
}
