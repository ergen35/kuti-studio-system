import { useQuery } from "@tanstack/react-query";
import { Activity, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { listGenerationJobsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import type { TaskItem } from "~/lib/tasks/types";
import { jobToTaskItem } from "~/lib/tasks/types";
import { useTasksStore } from "~/stores/tasks";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { TaskFilters } from "./TaskFilters";
import { TaskList } from "./TaskList";

interface TaskSideSheetProps {
  projectId?: string;
}

export function TaskSideSheet({ projectId: propProjectId }: TaskSideSheetProps) {
  const { projectId: routeProjectId } = useParams();
  const projectId = propProjectId || routeProjectId || "";
  const navigate = useNavigate();
  const { isSideSheetOpen, closeSideSheet, selectedTaskId, setSelectedTask, searchQuery, selectedStatuses, selectedSourceKinds } =
    useTasksStore();

  // Fetch tasks with polling when running
  const { data: jobs, isLoading } = useQuery({
    ...listGenerationJobsOptions({ path: { projectId } }),
    enabled: !!projectId && isSideSheetOpen,
    refetchInterval: (query) => {
      const data = query.state.data as Array<{ status: string }> | undefined;
      const hasRunning = data?.some((j) => j.status === "running");
      return hasRunning ? 2 * 60 * 1000 : false;
    },
    refetchOnWindowFocus: true,
  });

  // Convert API jobs to TaskItems
  const jobsData = jobs as Array<{
    id: string;
    title: string;
    status: string;
    sourceKind: string;
    sourceLabel: string;
    sourceId: string;
    progress: number;
    createdAt: string;
    updatedAt?: string;
    errorMessage: unknown;
    metadataJson: unknown;
  }> | undefined;

  const tasks: TaskItem[] =
    jobsData?.map((job) => {
      const item = jobToTaskItem(job);
      // Extract hierarchy info from metadata if available
      const metadata = job.metadataJson as {
        children?: TaskItem[];
        completed?: number;
        total?: number;
      } | null;

      if (metadata?.children) {
        item.children = metadata.children;
      }

      if (metadata?.completed !== undefined && metadata?.total !== undefined) {
        item.hierarchyProgress = {
          completed: metadata.completed,
          total: metadata.total,
          percentage: Math.round((metadata.completed / metadata.total) * 100),
          label: `${metadata.completed}/${metadata.total} scènes`,
        };
      }

      return item;
    }) || [];

  // Filter tasks for side sheet
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.sourceLabel?.toLowerCase().includes(query) ||
        task.sourceKind.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }
    if (!selectedStatuses.includes(task.status)) return false;
    if (!selectedSourceKinds.includes(task.sourceKind)) return false;
    return true;
  });

  // Count running tasks
  const runningCount = tasks.filter((t) => t.status === "running").length;

  const handleNavigate = useCallback(
    (taskId: string) => {
      closeSideSheet();
      navigate(`/projects/${projectId}/generation?job=${taskId}`);
    },
    [closeSideSheet, navigate, projectId]
  );

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSideSheetOpen) {
        closeSideSheet();
      }
    };
    if (isSideSheetOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isSideSheetOpen, closeSideSheet]);

  if (!isSideSheetOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm transition-opacity"
        onClick={closeSideSheet}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-surface border-l border-line shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-accent" />
              <h2 className="font-semibold text-ink">Tâches</h2>
              {runningCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 rounded-full animate-pulse">
                  {runningCount} en cours
                </span>
              )}
            </div>
            <button
              onClick={closeSideSheet}
              className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 border-b border-line bg-surface-2/30">
            <TaskFilters compact />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4">
            <TaskList
              tasks={filteredTasks}
              isLoading={isLoading}
              onOpenDetail={(task) => setSelectedTask(task.id)}
              showProgressBar={false}
              compact
              emptyMessage="Aucune tâche active"
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-surface-2/30">
            <button
              onClick={() => {
                closeSideSheet();
                navigate(`/projects/${projectId}/tasks`);
              }}
              className="w-full py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Voir toutes les tâches →
            </button>
          </div>
        </div>
      </div>

      {/* Task Detail Dialog */}
      {selectedTaskId && (
        <TaskDetailDialog
          task={tasks.find(t => t.id === selectedTaskId)!}
          projectId={projectId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}
