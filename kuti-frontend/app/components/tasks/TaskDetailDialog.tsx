import { useMemo } from "react";
import { clsx } from "clsx";
import {
  X,
  BookOpen,
  Book,
  FileText,
  PanelTop,
  Sparkles,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button, Badge } from "~/components/ui";
import type {
  TaskItem,
  TaskStatus,
  SourceKind,
} from "~/lib/tasks/types";
import {
  getStatusLabel,
  formatElapsedTime,
} from "~/lib/tasks/types";

const SOURCE_ICONS: Record<SourceKind, React.ComponentType<{ size?: number; className?: string }>> = {
  tome: BookOpen,
  chapter: Book,
  scene: FileText,
  panel: PanelTop,
  custom: Sparkles,
  character: User,
};

const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ size?: number; className?: string }>> = {
  pending: Clock,
  running: Loader2,
  ready: CheckCircle2,
  validated: CheckCircle2,
  failed: AlertCircle,
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "text-yellow-500",
  running: "text-blue-500",
  ready: "text-emerald-500",
  validated: "text-teal-500",
  failed: "text-red-500",
};

const STATUS_BG_COLORS: Record<TaskStatus, string> = {
  pending: "bg-yellow-500/10",
  running: "bg-blue-500/10",
  ready: "bg-emerald-500/10",
  validated: "bg-teal-500/10",
  failed: "bg-red-500/10",
};

interface TaskDetailDialogProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailDialog({
  task,
  isOpen,
  onClose,
}: TaskDetailDialogProps) {
  const SourceIcon = SOURCE_ICONS[task.sourceKind] || Sparkles;
  const StatusIcon = STATUS_ICONS[task.status];

  const elapsedTime = useMemo(() => {
    if (task.updatedAt && task.status !== 'running') {
      return formatElapsedTime(task.createdAt);
    }
    return formatElapsedTime(task.createdAt);
  }, [task.createdAt, task.updatedAt, task.status]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] bg-surface border border-line rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 mx-4">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 border-b border-line">
          <div
            className={clsx(
              "p-2 rounded-lg shrink-0",
              STATUS_BG_COLORS[task.status]
            )}
          >
            <SourceIcon
              size={24}
              className={STATUS_COLORS[task.status]}
            />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-ink truncate">
              {task.title}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={task.status}>{getStatusLabel(task.status)}</Badge>
              <span className="text-xs text-muted">
                {task.sourceLabel || task.sourceKind}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Status */}
            <div className="rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                <StatusIcon size={12} className={STATUS_COLORS[task.status]} />
                <span>Statut</span>
              </div>
              <p className={clsx("font-medium text-sm", STATUS_COLORS[task.status])}>
                {getStatusLabel(task.status)}
              </p>
            </div>

            {/* Type */}
            <div className="rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                <SourceIcon size={12} />
                <span>Type</span>
              </div>
              <p className="font-medium text-sm text-ink capitalize">
                {task.sourceKind}
              </p>
            </div>

            {/* Elapsed Time */}
            <div className="rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                <Clock size={12} />
                <span>Temps</span>
              </div>
              <p className="font-medium text-sm text-ink">
                {elapsedTime}
              </p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="rounded-lg border border-line bg-surface-2/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Progrès</span>
              <span className="text-sm font-semibold text-accent">
                {Math.round(task.progress)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-300",
                  task.status === "running" && "bg-accent animate-pulse",
                  task.status === "ready" && "bg-emerald-500",
                  task.status === "validated" && "bg-teal-500",
                  task.status === "failed" && "bg-red-500",
                  task.status === "pending" && "bg-yellow-500"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>

            {task.hierarchyProgress && (
              <p className="text-xs text-muted">
                {task.hierarchyProgress.label}
              </p>
            )}

            {task.errorMessage && (
              <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 text-red-500 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{task.errorMessage}</span>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="rounded-lg border border-line bg-surface-2/30 p-4 space-y-3">
            <h3 className="text-sm font-medium text-ink">Détails</h3>

            <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
              <dt className="text-muted">ID Job</dt>
              <dd className="font-mono text-ink truncate">{task.id}</dd>

              <dt className="text-muted">Source ID</dt>
              <dd className="font-mono text-ink truncate">{task.sourceId || '-'}</dd>

              <dt className="text-muted">Source</dt>
              <dd className="text-ink">{task.sourceLabel || '-'}</dd>

              <dt className="text-muted">Créé le</dt>
              <dd className="text-ink">
                {new Date(task.createdAt).toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>

              {task.updatedAt && (
                <>
                  <dt className="text-muted">Mis à jour</dt>
                  <dd className="text-ink">
                    {new Date(task.updatedAt).toLocaleString('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-line bg-surface-2/30">
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
}
