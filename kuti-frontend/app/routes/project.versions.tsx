import { useLoaderData, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getProject, restoreVersion } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectVersionsRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => restoreVersion(project.id, versionId),
    onSuccess: async () => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
    },
  });

  return (
    <WorkspaceFrame
      eyebrow="Version history"
      title="Versions"
      description="Review branches, compare revisions, and restore milestones without losing editorial context."
      toolbar={<Button>Compare selected</Button>}
      left={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Timeline</div>
          <div className="space-y-2">
            {project.versions.map((version) => (
              <div key={version.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{version.label}</div>
                    <div className="text-xs text-[rgb(var(--muted-foreground))]">{version.branch}</div>
                  </div>
                  <Badge tone={version.status === "active" ? "active" : "archived"}>{version.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      }
      center={
        <div className="space-y-4">
          {project.versions.map((version) => (
            <Card key={version.id} padding="lg" className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Revision</div>
                  <div className="mt-1 text-lg font-semibold">{version.label}</div>
                </div>
                <Badge tone={version.status === "active" ? "active" : "archived"}>{version.status}</Badge>
              </div>
              <div className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">{version.summary}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => restoreVersionMutation.mutate(version.id)} isDisabled={restoreVersionMutation.isPending}>
                  {restoreVersionMutation.isPending ? "Restoring..." : "Restore"}
                </Button>
                <Button size="sm" variant="secondary">Diff</Button>
              </div>
            </Card>
          ))}
        </div>
      }
      right={
        <Card padding="md" className="space-y-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Rules</div>
          <div className="space-y-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
            <p>Keep the active line stable and use compare views for deliberate branching.</p>
            <p>Versions are the main safety net for restoration and review.</p>
          </div>
        </Card>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Versions unavailable" description="The version history workspace could not be loaded." />;
}
