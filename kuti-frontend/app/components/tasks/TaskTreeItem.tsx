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
      <div className="rounded-lg border border-line bg-surface hover:border-accent/50 transition-colors">
        <button
          onClick={() => onOpenDetail ? onOpenDetail(task) : handleClick()}
          className="w-full flex items-center gap-2 p-2 text-left"
        >
          <Icon size={16} className="text-muted shrink-0" />
          <span className="flex-1 text-sm truncate">{task.title}</span>
          <TaskProgressBadgeMini
            status={task.status}
            progress={task.progress}
            label={task.hierarchyProgress?.label}
          />
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(task.id);
              }}
              className="p-0.5 rounded hover:bg-surface-2"
            >
              <ChevronRight
                size={14}
                className={clsx(
                  "text-muted transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          )}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-t border-line/50">
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
    <div className="rounded-lg border border-line bg-surface overflow-hidden">
      <button
        onClick={handleClick}
        className={clsx(
          "w-full flex items-center gap-3 p-3 text-left transition-colors",
          "hover:bg-surface-2/50",
          level > 0 && "pl-6"
        )}
      >
        {hasChildren ? (
          <ChevronDown
            size={16}
            className={clsx(
              "text-muted shrink-0 transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )}
          />
        ) : (
          <span className="w-4" />
        )}

        <div
          className={clsx(
            "p-1.5 rounded-md shrink-0",
            task.status === "running" && "bg-blue-500/10",
            task.status === "ready" && "bg-emerald-500/10",
            task.status === "validated" && "bg-teal-500/10",
            task.status === "failed" && "bg-red-500/10",
            task.status === "pending" && "bg-yellow-500/10"
          )}
        >
          <Icon
            size={18}
            className={clsx(
              task.status === "running" && "text-blue-500",
              task.status === "ready" && "text-emerald-500",
              task.status === "validated" && "text-teal-500",
              task.status === "failed" && "text-red-500",
              task.status === "pending" && "text-yellow-500"
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{task.title}</span>
            {isFailed && (
              <AlertCircle size={14} className="text-red-500 shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted">
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
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-t border-line/50">
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
    <button
      onClick={() => onOpenDetail ? onOpenDetail(child) : onNavigate?.(child.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2/50 transition-colors border-l-2 border-transparent hover:border-accent"
    >
      <span className="w-4" />

      <Icon
        size={14}
        className={clsx(
          "shrink-0",
          child.status === "running" && "text-blue-500",
          child.status === "ready" && "text-emerald-500",
          child.status === "validated" && "text-teal-500",
          child.status === "failed" && "text-red-500",
          child.status === "pending" && "text-yellow-500"
        )}
      />

      <span className="flex-1 text-sm truncate">{child.title}</span>

      <div className="flex items-center gap-2">
        {isFailed && <AlertCircle size={12} className="text-red-500" />}
        <TaskProgressBadgeMini
          status={child.status}
          progress={child.progress}
        />
      </div>
    </button>
  );
}
