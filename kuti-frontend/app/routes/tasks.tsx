import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { TaskDetailDialog, TaskFilters, TaskList } from "~/components/tasks";
import {
  Button,
  PageHeader,
  Panel,
} from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { listGenerationJobsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import type { TaskItem } from "~/lib/tasks/types";
import { jobToTaskItem } from "~/lib/tasks/types";
import { useTasksStore } from "~/stores/tasks";

export default function TasksRoute() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['tasks', 'common']);
  const { selectedTaskId, setSelectedTask } = useTasksStore();

  // Fetch tasks with polling when running
  const { data: jobs, isLoading, refetch, dataUpdatedAt } = useQuery({
    ...listGenerationJobsOptions({ path: { projectId } }),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data as Array<{ status: string }> | undefined;
      const hasRunning = data?.some((j) => j.status === "running");
      return hasRunning ? 10000 : false;
    },
    refetchOnWindowFocus: true,
  });

  // Convert API jobs to TaskItems
  const tasks: TaskItem[] =
    jobs?.map((job) => {
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

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <AppShell>
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Activity size={24} className="text-accent" />
            <span>Gestionnaire de Tâches</span>
          </div>
        }
        description={
          lastUpdated
            ? `Dernière mise à jour: ${lastUpdated}`
            : "Suivi des jobs de génération en cours"
        }
        actions={
          <Button onClick={() => refetch()} variant="secondary">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t('common:nav.refresh')}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] items-start">
        {/* Filters panel */}
        <Panel className="lg:sticky lg:top-4">
          <h3 className="font-medium text-ink mb-4">Filtres</h3>
          <TaskFilters />
        </Panel>

        {/* Task list */}
        <Panel>
          <TaskList
            tasks={tasks}
            isLoading={isLoading}
            onOpenDetail={(task) => setSelectedTask(task.id)}
            showProgressBar={true}
            compact={false}
            emptyMessage="Aucune tâche trouvée"
          />
        </Panel>
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
    </AppShell>
  );
}
