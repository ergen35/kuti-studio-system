import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, scanProjectWarnings } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectWarningsRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const rescanWarningsMutation = useMutation({
    mutationFn: async () => scanProjectWarnings(project.id),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  return (
    <WorkspaceFrame
      eyebrow="Warnings center"
      title="Warnings"
      description="Track continuity issues, missing references, and job failures in a single QA surface." 
      toolbar={
        <Button variant="secondary" onClick={() => rescanWarningsMutation.mutate()} isDisabled={rescanWarningsMutation.isPending}>
          {rescanWarningsMutation.isPending ? "Rescanning..." : "Rescan warnings"}
        </Button>
      }
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Open</div>
          <div className="space-y-2">
            {project.warnings.filter((warning) => warning.status === "open").map((warning) => (
              <div key={warning.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="text-sm font-medium">{warning.title}</div>
                <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{warning.source}</div>
              </div>
            ))}
          </div>
        </Card>
      }
      center={
        <div className="space-y-4">
          {project.warnings.map((warning) => (
            <Card key={warning.id} padding="md" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{warning.title}</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">{warning.type} · {warning.source}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={warning.severity === "high" ? "danger" : warning.severity === "medium" ? "warning" : "muted"}>{warning.severity}</Badge>
                  <Badge tone={warning.status === "open" ? "open" : "resolved"}>{warning.status}</Badge>
                </div>
              </div>
              <div className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">{warning.note}</div>
            </Card>
          ))}
        </div>
      }
      right={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">QA summary</div>
          <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
            <div className="flex items-center justify-between"><span>Open</span><span className="font-mono text-[rgb(var(--foreground))]">{project.warnings.filter((warning) => warning.status === "open").length}</span></div>
            <div className="flex items-center justify-between"><span>Resolved</span><span className="font-mono text-[rgb(var(--foreground))]">{project.warnings.filter((warning) => warning.status === "resolved").length}</span></div>
          </div>
        </Card>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Warnings unavailable" description="The warnings workspace could not be loaded." />;
}
