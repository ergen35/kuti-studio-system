import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGenerationJob, getProject } from "../lib/api";
import { Badge, Button, Card, EmptyState, Input } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";
import { ActionDialog } from "../components/action-dialog";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectGenerationRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const runningJob = project.jobs.find((job) => job.status === "running") ?? project.jobs[0];
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState(runningJob.label);

  const startJobMutation = useMutation({
    mutationFn: async (title: string) => {
      const source = project.scenes[0];
      if (!source) {
        throw new Error("No scene available for generation");
      }

      return createGenerationJob(project.id, {
        source_kind: "scene",
        source_id: source.id,
        strategy: "direct",
        title,
        summary: source.summary,
      });
    },
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  function handleStartJob() {
    setJobTitle(runningJob.label);
    setJobDialogOpen(true);
  }

  return (
    <>
      <ActionDialog
        isOpen={jobDialogOpen}
        title="Start generation job"
        description="Create a new job from the current story context and monitor it in the generation studio."
        confirmLabel="Start job"
        isPending={startJobMutation.isPending}
        confirmDisabled={!jobTitle.trim()}
        onDismiss={() => setJobDialogOpen(false)}
        onConfirm={() => {
          const title = jobTitle.trim();
          if (!title) {
            return;
          }

          setJobDialogOpen(false);
          startJobMutation.mutate(title);
        }}
      >
        <Input value={jobTitle} onChange={setJobTitle} placeholder="Generation job title" />
      </ActionDialog>

      <WorkspaceFrame
      eyebrow="Generation studio"
      title="Generation"
      description="Track job state, source selection, and output validation before boards move forward into publication-ready material."
      toolbar={
        <Button onClick={handleStartJob} isDisabled={startJobMutation.isPending}>
          Start job
        </Button>
      }
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Jobs</div>
          <div className="space-y-2">
            {project.jobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{job.label}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{job.kind}</div>
                  </div>
                  <Badge tone={job.status === "running" ? "running" : job.status === "failed" ? "failed" : "done"}>{job.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
      center={
        <>
          <Card padding="lg" className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Active job</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{runningJob.label}</div>
              </div>
              <Badge tone={runningJob.status === "running" ? "running" : runningJob.status === "failed" ? "failed" : "done"}>{runningJob.status}</Badge>
            </div>

            <div className="h-2 rounded-full bg-[rgb(var(--muted))]"><div className="h-2 rounded-full bg-[rgb(var(--primary))]" style={{ width: `${runningJob.progress}%` }} /></div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Model</div>
                <div className="mt-2 text-sm">{runningJob.model}</div>
              </div>
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Step</div>
                <div className="mt-2 text-sm">{runningJob.step}</div>
              </div>
            </div>
          </Card>

          <Card padding="lg" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Preview</div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {project.scenes.slice(0, 3).map((scene) => (
                <div key={scene.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-4">
                  <div className="text-sm font-medium">{scene.title}</div>
                  <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{scene.tome} · {scene.chapter}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      }
      right={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Board state</div>
            <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <div className="flex items-center justify-between"><span>Running</span><span className="font-mono text-[rgb(var(--foreground))]">{project.jobs.filter((job) => job.status === "running").length}</span></div>
              <div className="flex items-center justify-between"><span>Failed</span><span className="font-mono text-[rgb(var(--foreground))]">{project.jobs.filter((job) => job.status === "failed").length}</span></div>
              <div className="flex items-center justify-between"><span>Done</span><span className="font-mono text-[rgb(var(--foreground))]">{project.jobs.filter((job) => job.status === "done").length}</span></div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Warnings</div>
            {project.warnings.slice(0, 2).map((warning) => (
              <div key={warning.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{warning.title}</div>
                  <Badge tone={warning.status === "open" ? "open" : "resolved"}>{warning.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{warning.note}</div>
              </div>
            ))}
          </Card>
        </>
      }
      />
    </>
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Generation unavailable" description="The generation studio could not be loaded." />;
}
