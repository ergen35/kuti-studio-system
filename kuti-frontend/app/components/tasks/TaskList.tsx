import { EmptyState, LoadingState } from "~/components/ui";
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
  emptyMessage = "Aucune tâche",
}: TaskListProps) {
  const { searchQuery, selectedStatuses, selectedSourceKinds } = useTasksStore();

  if (isLoading) {
    return <LoadingState label="Chargement des tâches..." />;
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
        title={emptyMessage}
        description={
          searchQuery
            ? "Aucun résultat pour votre recherche"
            : "Les tâches apparaîtront ici lorsqu'elles seront créées"
        }
      />
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
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
