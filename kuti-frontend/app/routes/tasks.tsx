import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { TaskDetailDialog, TaskFilters, TaskList } from "~/components/tasks";
import { Button, PageHeader, Panel } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import {
  getStorySummaryOptions,
  listCharactersOptions,
  listGenerationJobsOptions,
  listWarningsOptions,
} from "~/lib/backend/@tanstack/react-query.gen";
import type { GenerationJob, TaskItem, WarningRecord } from "~/lib/tasks/types";
import { jobToTaskItem, warningToTaskItem } from "~/lib/tasks/types";
import { resolveTaskSourceEntities } from "~/lib/tasks/resolve";
import { useTasksStore } from "~/stores/tasks";

export default function TasksRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["tasks", "common"]);
  const { selectedTaskId, setSelectedTask } = useTasksStore();

  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const characters = useQuery({
    ...listCharactersOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  // Fetch tasks with polling when running
  const {
    data: jobs,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    ...listGenerationJobsOptions({ path: { projectId } }),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as Array<{ status: string }> | undefined;
      const hasRunning = data?.some((j) => j.status === "running");
      return hasRunning ? 10000 : false;
    },
    refetchOnWindowFocus: true,
  });

  const warnings = useQuery({
    ...listWarningsOptions({ path: { projectId }, query: { status: "open" } }),
    enabled: !!projectId,
    refetchOnWindowFocus: true,
  });

  const isTasksLoading =
    isLoading || story.isLoading || characters.isLoading || warnings.isLoading;

  // Convert API jobs to TaskItems
  const jobItems = (jobs as GenerationJob[] | undefined) ?? [];
  const warningItems = (warnings.data as WarningRecord[] | undefined) ?? [];

  const tasks: TaskItem[] = resolveTaskSourceEntities(
    [
      ...warningItems.map((warning) => warningToTaskItem(warning)),
      ...jobItems.map((job) => {
        const item = jobToTaskItem(job);
        const metadata = job.metadataJson as {
          children?: TaskItem[];
          completed?: number;
          total?: number;
        } | null;

        if (metadata?.children) {
          item.children = metadata.children;
        }

        if (
          metadata?.completed !== undefined &&
          metadata?.total !== undefined
        ) {
          item.hierarchyProgress = {
            completed: metadata.completed,
            total: metadata.total,
            percentage: Math.round((metadata.completed / metadata.total) * 100),
            label: `${metadata.completed}/${metadata.total} scènes`,
          };
        }

        return item;
      }),
    ],
    {
      projectId,
      story: story.data,
      characters:
        (characters.data as
          | Array<{ id: string; slug: string; name: string }>
          | undefined) ?? [],
    },
  );

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <AppShell>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-primary" />
            <span>{t("tasks:title")}</span>
          </div>
        }
        description={
          lastUpdated
            ? t("tasks:lastUpdated", { time: lastUpdated })
            : t("tasks:description")
        }
        actions={
          <Button onClick={() => refetch()} variant="secondary">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t("common:nav.refresh")}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] items-start">
        {/* Filters panel */}
        <Panel className="lg:sticky lg:top-4">
          <h3 className="mb-4 font-medium text-foreground">
            {t("tasks:filters.title")}
          </h3>
          <TaskFilters />
        </Panel>

        {/* Task list */}
        <Panel>
          <TaskList
            tasks={tasks}
            isLoading={isTasksLoading}
            onOpenDetail={(task) => setSelectedTask(task.id)}
            showProgressBar={true}
            compact={false}
            emptyMessage={t("tasks:empty")}
          />
        </Panel>
      </div>

      {/* Task Detail Dialog */}
      {selectedTaskId && (
        <TaskDetailDialog
          task={tasks.find((t) => t.id === selectedTaskId)!}
          projectId={projectId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </AppShell>
  );
}
