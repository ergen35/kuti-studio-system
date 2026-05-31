import { clsx } from "clsx";
import {
  BookOpen,
  Book,
  FileText,
  PanelTop,
  Sparkles,
  User,
  ChevronRight,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { TaskProgressBadge, TaskProgressBadgeMini } from "./TaskProgressBadge";
import { Button } from "~/components/ui";
import type {
  TaskItem,
  TaskStatus,
  SourceKind,
  HierarchyProgress,
} from "~/lib/tasks/types";
import { useTasksStore } from "~/stores/tasks";

const SOURCE_ICONS: Record<SourceKind, React.ComponentType<{ size?: number; className?: string }>> = {
  tome: BookOpen,
  chapter: Book,
  scene: FileText,
  panel: PanelTop,
  custom: Sparkles,
  character: User,
};

const STATUS_ICON_CLASS: Record<TaskStatus, string> = {
  pending: "text-warning",
  running: "text-primary",
  ready: "text-success",
  validated: "text-success",
  failed: "text-destructive",
};

const STATUS_ICON_BG_CLASS: Record<TaskStatus, string> = {
  pending: "bg-warning/10",
  running: "bg-primary/10",
  ready: "bg-success/10",
  validated: "bg-success/10",
  failed: "bg-destructive/10",
};

interface TaskTreeItemProps {
  task: TaskItem;
  level?: number;
  onNavigate?: (taskId: string) => void;
  onOpenDetail?: (task: TaskItem) => void;
  showProgressBar?: boolean;
  compact?: boolean;
}

export function TaskTreeItem({
  task,
  level = 0,
  onNavigate,
  onOpenDetail,
  showProgressBar = false,
  compact = false,
}: TaskTreeItemProps) {
  const { expandedTaskIds, toggleExpanded } = useTasksStore();
  const isExpanded = expandedTaskIds.has(task.id);
  const hasChildren = task.children && task.children.length > 0;

  const Icon = SOURCE_ICONS[task.sourceKind] || Sparkles;
  const isFailed = task.status === "failed";

  const handleClick = () => {
    if (hasChildren) {
      toggleExpanded(task.id);
    } else if (onOpenDetail) {
      onOpenDetail(task);
    } else if (onNavigate) {
      onNavigate(task.id);
    }
  };

  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-card transition-colors hover:border-primary/45">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenDetail ? onOpenDetail(task) : handleClick()}
          className="h-auto w-full justify-start gap-2 p-2 text-left"
        >
          <Icon size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm truncate">{task.title}</span>
          <TaskProgressBadgeMini
            status={task.status}
            progress={task.progress}
            label={task.hierarchyProgress?.label}
          />
          {hasChildren && (
            <Button
              type="button"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(task.id);
              }}
              className="p-0.5"
            >
              <ChevronRight
                size={14}
                className={clsx(
                  "text-muted-foreground transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </Button>
          )}
        </Button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-t border-border">
            {task.children!.map((child) => (
              <TaskTreeItemChild
                key={child.id}
                child={child}
                onOpenDetail={onOpenDetail}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Button
        type="button"
        variant="ghost"
        onClick={handleClick}
        className={clsx(
          "flex h-auto w-full items-center gap-3 p-3 text-left transition-colors",
          level > 0 && "pl-6"
        )}
      >
        {hasChildren ? (
          <ChevronDown
            size={16}
            className={clsx(
              "shrink-0 text-muted-foreground transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
        ) : (
          <span className="w-4" />
        )}

        <div
          className={clsx(
            "shrink-0 rounded-md p-1.5",
            STATUS_ICON_BG_CLASS[task.status]
          )}
        >
          <Icon
            size={18}
            className={STATUS_ICON_CLASS[task.status]}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
            {isFailed && (
              <AlertCircle size={14} className="shrink-0 text-destructive" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {task.sourceLabel}
          </div>
        </div>

        <div className="shrink-0">
          <TaskProgressBadge
            status={task.status}
            progress={task.progress}
            label={task.hierarchyProgress?.label}
            showProgressBar={showProgressBar && task.status === "running"}
            size="sm"
          />
        </div>
      </Button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-t border-border">
          {task.children!.map((child) => (
            <TaskTreeItemChild
              key={child.id}
              child={child}
              onNavigate={onNavigate}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Child item (simpler display)
interface TaskTreeItemChildProps {
  child: TaskItem;
  onNavigate?: (taskId: string) => void;
  onOpenDetail?: (task: TaskItem) => void;
}

function TaskTreeItemChild({ child, onNavigate, onOpenDetail }: TaskTreeItemChildProps) {
  const Icon = SOURCE_ICONS[child.sourceKind] || PanelTop;
  const isFailed = child.status === "failed";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onOpenDetail ? onOpenDetail(child) : onNavigate?.(child.id)}
      className="flex h-auto w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-left transition-colors hover:border-primary"
    >
      <span className="w-4" />

      <Icon
        size={14}
        className={clsx("shrink-0", STATUS_ICON_CLASS[child.status])}
      />

      <span className="flex-1 truncate text-sm text-foreground">{child.title}</span>

      <div className="flex items-center gap-2">
        {isFailed && <AlertCircle size={12} className="text-destructive" />}
        <TaskProgressBadgeMini
          status={child.status}
          progress={child.progress}
        />
      </div>
    </Button>
  );
}
