import { useMemo } from "react";
import { clsx } from "clsx";
import {
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
  Square,
  RefreshCw,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Badge } from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";
import {
  cancelGenerationJobMutation,
  relaunchGenerationJobMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
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
  pending: "text-warning",
  running: "text-primary",
  ready: "text-success",
  validated: "text-success",
  failed: "text-destructive",
};

const STATUS_BG_COLORS: Record<TaskStatus, string> = {
  pending: "bg-warning/10",
  running: "bg-primary/10",
  ready: "bg-success/10",
  validated: "bg-success/10",
  failed: "bg-destructive/10",
};

const STATUS_BAR_COLORS: Record<TaskStatus, string> = {
  pending: "bg-warning",
  running: "bg-primary",
  ready: "bg-success",
  validated: "bg-success",
  failed: "bg-destructive",
};

interface TaskDetailDialogProps {
  task: TaskItem;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailDialog({
  task,
  projectId,
  isOpen,
  onClose,
}: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation(["tasks", "common"]);

  // Conditions d'affichage des boutons
  const canCancel = task.status === "running" || task.status === "pending";
  const canRelaunch = task.status === "ready" || task.status === "validated" || task.status === "failed";

  // Mutation Cancel
  const cancelMutation = useMutation({
    ...cancelGenerationJobMutation(),
    onSuccess: () => {
      // Fermer la boîte de dialogue
      onClose();
      // Actualiser la liste des tâches
      queryClient.invalidateQueries({ queryKey: ["listGenerationJobs", { path: { projectId } }] });
    },
  });

  // Mutation Relaunch
  const relaunchMutation = useMutation({
    ...relaunchGenerationJobMutation(),
    onSuccess: () => {
      // Fermer la boîte de dialogue
      onClose();
      // Actualiser la liste des tâches
      queryClient.invalidateQueries({ queryKey: ["listGenerationJobs", { path: { projectId } }] });
    },
  });
  const SourceIcon = SOURCE_ICONS[task.sourceKind] || Sparkles;
  const StatusIcon = STATUS_ICONS[task.status];

  const elapsedTime = useMemo(() => {
    if (task.updatedAt && task.status !== 'running') {
      return formatElapsedTime(task.createdAt);
    }
    return formatElapsedTime(task.createdAt);
  }, [task.createdAt, task.updatedAt, task.status]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-4">
          <div className="flex items-start gap-3 pr-8">
          <div
            className={clsx(
              "shrink-0 rounded-lg p-2",
              STATUS_BG_COLORS[task.status]
            )}
          >
            <SourceIcon
              size={24}
              className={STATUS_COLORS[task.status]}
            />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-lg font-semibold text-foreground">
              {task.title}
            </DialogTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone={task.status}>{getStatusLabel(task.status)}</Badge>
              <span className="text-xs text-muted-foreground">
                {task.sourceLabel || task.sourceKind}
              </span>
            </div>
          </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto p-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Status */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <StatusIcon size={12} className={STATUS_COLORS[task.status]} />
                <span>{t('detail.status')}</span>
              </div>
              <p className={clsx("font-medium text-sm", STATUS_COLORS[task.status])}>
                {getStatusLabel(task.status)}
              </p>
            </div>

            {/* Type */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <SourceIcon size={12} />
                <span>{t('detail.type')}</span>
              </div>
              <p className="text-sm font-medium capitalize text-foreground">
                {task.sourceKind}
              </p>
            </div>

            {/* Elapsed Time */}
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock size={12} />
                <span>{t('detail.elapsed')}</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {elapsedTime}
              </p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t('detail.progress')}</span>
              <span className="text-sm font-semibold text-primary">
                {Math.round(task.progress)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 overflow-hidden rounded-full bg-card">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-300",
                  STATUS_BAR_COLORS[task.status],
                  task.status === "running" && "animate-pulse"
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>

            {task.hierarchyProgress && (
              <p className="text-xs text-muted-foreground">
                {task.hierarchyProgress.label}
              </p>
            )}

            {task.errorMessage && (
              <div className="flex items-start gap-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{task.errorMessage}</span>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
            <h3 className="text-sm font-medium text-foreground">{t('detail.details')}</h3>

            <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('detail.jobId')}</dt>
              <dd className="truncate font-mono text-foreground">{task.id}</dd>

              <dt className="text-muted-foreground">{t('detail.sourceId')}</dt>
              <dd className="truncate font-mono text-foreground">{task.sourceId || '-'}</dd>

              <dt className="text-muted-foreground">{t('detail.source')}</dt>
              <dd className="text-foreground">{task.sourceLabel || '-'}</dd>

              <dt className="text-muted-foreground">{t('detail.createdAt')}</dt>
              <dd className="text-foreground">
                {new Date(task.createdAt).toLocaleString(i18n.language, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </dd>

              {task.updatedAt && (
                <>
                  <dt className="text-muted-foreground">{t('detail.updatedAt')}</dt>
                  <dd className="text-foreground">
                    {new Date(task.updatedAt).toLocaleString(i18n.language, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-end gap-2">
          {canCancel && (
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate({ path: { projectId, jobId: task.id } })}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-2"
            >
              {cancelMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Square size={16} />
              )}
              {t('actions.cancelTask')}
            </Button>
          )}

          {canRelaunch && (
            <Button
              variant="primary"
              onClick={() => relaunchMutation.mutate({ path: { projectId, jobId: task.id } })}
              disabled={relaunchMutation.isPending}
              className="flex items-center gap-2"
            >
              {relaunchMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {t('actions.relaunch')}
            </Button>
          )}

          <Button variant="ghost" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
