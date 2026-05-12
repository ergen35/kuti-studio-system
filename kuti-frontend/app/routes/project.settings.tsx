import { useEffect, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { archiveProject, createExport, getProject, updateProject } from "../lib/api";
import { Badge, Button, Card, EmptyState, Separator, Textarea } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectSettingsRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const [summary, setSummary] = useState(project.summary);
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  useEffect(() => {
    setSummary(project.summary);
  }, [project.summary]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () =>
      updateProject(project.id, {
        settings_json: {
          ...project.settingsJson,
          summary,
        },
      }),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  const archiveProjectMutation = useMutation({
    mutationFn: async () => archiveProject(project.id),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  const exportSettingsMutation = useMutation({
    mutationFn: async () =>
      createExport(project.id, {
        kind: "work",
        format: "json",
        label: `${project.name} settings export`,
        summary: `Settings export for ${project.name}`,
      }),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  return (
    <WorkspaceFrame
      eyebrow="Project settings"
      title="Settings"
      description="Adjust project metadata, local storage expectations, and high-level workflow preferences." 
      toolbar={
        <Button onClick={() => saveSettingsMutation.mutate()} isDisabled={saveSettingsMutation.isPending}>
          {saveSettingsMutation.isPending ? "Saving..." : "Save settings"}
        </Button>
      }
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Storage</div>
          <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
            <div className="flex items-center justify-between"><span>Project ID</span><span className="font-mono text-[rgb(var(--foreground))]">{project.id}</span></div>
            <div className="flex items-center justify-between"><span>Slug</span><span className="font-mono text-[rgb(var(--foreground))]">{project.slug}</span></div>
            <div className="flex items-center justify-between"><span>Language</span><span className="font-mono text-[rgb(var(--foreground))]">{project.language}</span></div>
          </div>
        </Card>
      }
      center={
        <Card padding="lg" className="space-y-5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">General</div>
            <div className="mt-1 text-xl font-semibold">{project.name}</div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Workflow mode</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="primary">Editorial</Badge>
                <Badge tone="muted">Local-first</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4 sm:p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Theme accent</div>
              <div className="mt-2 h-8 w-8 rounded-full border border-[rgb(var(--border))]" style={{ backgroundColor: project.accent }} />
            </div>
          </div>

          <Textarea value={summary} onChange={setSummary} aria-label="Project summary" />
        </Card>
      }
      right={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Danger zone</div>
          <div className="space-y-3">
              <Button
                variant="danger"
                UNSAFE_className="w-full"
                onClick={() => archiveProjectMutation.mutate()}
                isDisabled={archiveProjectMutation.isPending}
              >
              {archiveProjectMutation.isPending ? "Archiving..." : "Archive project"}
            </Button>
              <Button
                variant="ghost"
                UNSAFE_className="w-full"
                onClick={() => exportSettingsMutation.mutate()}
                isDisabled={exportSettingsMutation.isPending}
              >
              {exportSettingsMutation.isPending ? "Exporting..." : "Export settings"}
            </Button>
          </div>
        </Card>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Settings unavailable" description="The project settings workspace could not be loaded." />;
}
