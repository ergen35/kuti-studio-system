import { useLoaderData, useNavigate, useParams } from "react-router";
import { getProject } from "../lib/api";
import { formatDate, formatRelative } from "../lib/format";
import { Badge, Button, Card, EmptyState, Separator, StatTile } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";

export async function clientLoader({ params }: { params: { projectId: string } }) {
  return getProject(params.projectId);
}

clientLoader.hydrate = true as const;

export default function ProjectDashboardRoute() {
  const project = useLoaderData() as Awaited<ReturnType<typeof getProject>>;
  const navigate = useNavigate();
  const params = useParams();

  return (
    <WorkspaceFrame
      eyebrow="Project dashboard"
      title={project.name}
      description={project.summary}
      toolbar={
        <>
          <Button onClick={() => navigate(`/projects/${params.projectId}/story`)}>Continue writing</Button>
          <Button variant="secondary" onClick={() => navigate(`/projects/${params.projectId}/generation`)}>Launch generation</Button>
        </>
      }
      left={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Project state</div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight">{project.progress}%</div>
                <div className="text-sm text-[rgb(var(--muted-foreground))]">Production readiness</div>
              </div>
              <Badge tone={project.status === "active" ? "active" : project.status === "draft" ? "draft" : "archived"}>{project.status}</Badge>
            </div>
            <div className="h-2 rounded-full bg-[rgb(var(--muted))]"><div className="h-2 rounded-full bg-[rgb(var(--primary))]" style={{ width: `${project.progress}%` }} /></div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Last activity</div>
            <div className="space-y-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              {project.activity.slice(0, 3).map((entry) => (
                <div key={entry} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3">{entry}</div>
              ))}
            </div>
          </Card>
        </>
      }
      center={
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Characters" value={project.stats.characters} hint="Narrative cast" />
            <StatTile label="Scenes" value={project.stats.scenes} hint="Story units" />
            <StatTile label="Assets" value={project.stats.assets} hint="Local media" />
            <StatTile label="Warnings" value={project.stats.warnings} hint="Continuity issues" />
          </div>

          <Card padding="lg" className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Overview</div>
                <div className="mt-1 text-lg font-semibold">Health snapshot</div>
              </div>
              <Badge tone={project.jobs.some((job) => job.status === "running") ? "running" : "resolved"}>{project.jobs.some((job) => job.status === "running") ? "jobs running" : "stable"}</Badge>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              {project.jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{job.label}</div>
                      <div className="mt-1 text-sm text-[rgb(var(--muted-foreground))]">{job.step}</div>
                    </div>
                    <Badge tone={job.status === "running" ? "running" : job.status === "failed" ? "failed" : "done"}>{job.status}</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[rgb(var(--muted))]"><div className="h-2 rounded-full bg-[rgb(var(--primary))]" style={{ width: `${job.progress}%` }} /></div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[rgb(var(--muted-foreground))]">
                    <span>{job.model}</span>
                    <span>{formatRelative(job.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      }
      right={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Project details</div>
            <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <div className="flex items-center justify-between"><span>Slug</span><span className="font-mono text-[rgb(var(--foreground))]">{project.slug}</span></div>
              <div className="flex items-center justify-between"><span>Language</span><span className="font-mono text-[rgb(var(--foreground))]">{project.language}</span></div>
              <div className="flex items-center justify-between"><span>Updated</span><span className="font-mono text-[rgb(var(--foreground))]">{formatDate(project.lastUpdated)}</span></div>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Warnings</div>
            <div className="space-y-2">
              {project.warnings.slice(0, 3).map((warning) => (
                <button key={warning.id} type="button" className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3 text-left text-sm transition hover:border-[rgb(var(--primary)/0.25)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[rgb(var(--foreground))]">{warning.title}</span>
                    <Badge tone={warning.status === "open" ? "open" : "resolved"}>{warning.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{warning.source}</div>
                </button>
              ))}
            </div>
          </Card>
        </>
      }
    />
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Dashboard unavailable" description="This project dashboard could not be loaded." />;
}
