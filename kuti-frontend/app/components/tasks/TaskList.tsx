import { EmptyState, LoadingState } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { TaskTreeItem } from "./TaskTreeItem";
import type { TaskItem } from "~/lib/tasks/types";
import { useTasksStore } from "~/stores/tasks";

interface TaskListProps {
  tasks: TaskItem[];
  isLoading: boolean;
  onNavigate?: (taskId: string) => void;
  onOpenDetail?: (task: TaskItem) => void;
  showProgressBar?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  isLoading,
  onNavigate,
  onOpenDetail,
  showProgressBar = true,
  compact = false,
  emptyMessage,
}: TaskListProps) {
  const { t } = useTranslation("tasks");
  const { searchQuery, selectedStatuses, selectedSourceKinds } = useTasksStore();

  if (isLoading) {
    return <LoadingState label={t("loading")} />;
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.sourceLabel?.toLowerCase().includes(query) ||
        task.sourceKind.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (!selectedStatuses.includes(task.status)) {
      return false;
    }

    // SourceKind filter
    if (!selectedSourceKinds.includes(task.sourceKind)) {
      return false;
    }

    return true;
  });

  if (filteredTasks.length === 0) {
    return (
      <EmptyState
        title={emptyMessage ?? t("empty")}
        description={
          searchQuery
            ? t("emptySearch")
            : t("emptyDescription")
        }
      />
    );
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {filteredTasks.map((task) => (
        <TaskTreeItem
          key={task.id}
          task={task}
          onNavigate={onNavigate}
          onOpenDetail={onOpenDetail}
          showProgressBar={showProgressBar}
          compact={compact}
        />
      ))}
    </div>
  );
}
