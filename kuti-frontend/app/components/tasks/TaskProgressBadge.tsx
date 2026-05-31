import { clsx } from "clsx";
import type { TaskStatus } from "~/lib/tasks/types";
import { getStatusColor, getStatusLabel } from "~/lib/tasks/types";

const progressBarClass: Record<TaskStatus, string> = {
  pending: "bg-warning",
  running: "bg-primary",
  ready: "bg-success",
  validated: "bg-success",
  failed: "bg-destructive",
};

interface TaskProgressBadgeProps {
  status: TaskStatus;
  progress: number;
  label?: string; // e.g., "2/8 scènes"
  showProgressBar?: boolean;
  size?: "sm" | "md";
}

export function TaskProgressBadge({
  status,
  progress,
  label,
  showProgressBar = false,
  size = "md",
}: TaskProgressBadgeProps) {
  const statusClasses = getStatusColor(status);
  const isRunning = status === "running";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            statusClasses,
            isRunning && "animate-pulse",
            size === "sm" && "text-[10px] px-2 py-0.5"
          )}
        >
          {isRunning && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
            </span>
          )}
          {getStatusLabel(status)}
        </span>

        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>

      {showProgressBar && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={clsx(
                "h-full rounded-full transition-all duration-300",
                progressBarClass[status]
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}

// Mini version for compact displays
export function TaskProgressBadgeMini({
  status,
  progress,
  label,
}: Pick<TaskProgressBadgeProps, "status" | "progress" | "label">) {
  const statusClasses = getStatusColor(status);
  const isRunning = status === "running";

  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
          statusClasses,
          isRunning && "animate-pulse"
        )}
      >
        {isRunning && (
          <span className="h-1 w-1 rounded-full bg-current" />
        )}
        {getStatusLabel(status)}
      </span>

      {label && (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
