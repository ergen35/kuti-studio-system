import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createExport, getProject } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectExportsRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const buildExportMutation = useMutation({
    mutationFn: async () =>
      createExport(project.id, {
        kind: "work",
        format: "zip",
        label: `${project.name} export`,
        summary: project.summary,
      }),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  return (
    <WorkspaceFrame
      eyebrow="Exports"
      title="Exports"
      description="Generate and track work or publication bundles with a clear manifest trail and download-ready status." 
      toolbar={
        <Button onClick={() => buildExportMutation.mutate()} isDisabled={buildExportMutation.isPending}>
          {buildExportMutation.isPending ? "Building..." : "Build export"}
        </Button>
      }
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Recent exports</div>
          {project.exports.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-[rgb(var(--muted-foreground))]">{item.kind} · {item.format}</div>
                </div>
                <Badge tone={item.status === "ready" ? "resolved" : item.status === "running" ? "running" : item.status === "failed" ? "failed" : "muted"}>{item.status}</Badge>
              </div>
            </div>
          ))}
        </Card>
      }
      center={
        <div className="grid gap-4 md:grid-cols-2">
          {project.exports.map((item) => (
            <Card key={item.id} padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Export package</div>
                  <div className="mt-1 text-lg font-semibold">{item.label}</div>
                </div>
                <Badge tone={item.status === "ready" ? "resolved" : item.status === "running" ? "running" : item.status === "failed" ? "failed" : "muted"}>{item.status}</Badge>
              </div>
              <div className="text-sm text-[rgb(var(--muted-foreground))]">Manifest: {item.manifest}</div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">{item.kind}</Badge>
                <Badge tone="muted">{item.format}</Badge>
              </div>
            </Card>
          ))}
        </div>
      }
      right={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Export rules</div>
          <div className="space-y-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
            <p>Use work exports for iterative review and publication exports for package handoff.</p>
            <p>Keep manifest files visible so broken references and stale assets are traceable.</p>
          </div>
        </Card>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Exports unavailable" description="The exports workspace could not be loaded." />;
}
