import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { listGenerationJobsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import { Button, Badge } from "~/components/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useTranslation } from "~/hooks/useTranslation";
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
  const { t } = useTranslation(["tasks", "common"]);
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

  return (
    <>
      <Sheet open={isSideSheetOpen} onOpenChange={(open) => !open && closeSideSheet()}>
        <SheetContent className="w-full sm:w-[400px]" side="right">
          <SheetHeader className="border-b border-line">
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-accent" />
              <SheetTitle>{t('tasks:sideTitle')}</SheetTitle>
              {runningCount > 0 && (
                <Badge tone="running">{t('tasks:runningCount', { count: runningCount })}</Badge>
              )}
            </div>
          </SheetHeader>

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
              emptyMessage={t('tasks:activeEmpty')}
            />
          </div>

          <SheetFooter className="border-t border-line bg-surface-2/30">
            <Button
              variant="ghost"
              onClick={() => {
                closeSideSheet();
                navigate(`/projects/${projectId}/tasks`);
              }}
              className="w-full"
            >
              {t('tasks:viewAll')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
