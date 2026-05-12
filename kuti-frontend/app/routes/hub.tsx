import { useMemo, useState } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createProject, getHubSummary, getProjects } from "../lib/api";
import { formatDate, formatRelative } from "../lib/format";
import { Card, Badge, Button, EmptyState, Input, SearchField, Separator, StatTile } from "../components/ui";
import { WorkspaceFrame } from "../components/layout/workspace-frame";
import { refreshWorkspaceData } from "../lib/query";
import { ActionDialog } from "../components/action-dialog";

type HubData = Awaited<ReturnType<typeof getProjects>> extends infer Projects
  ? {
      projects: Projects extends Array<infer Project> ? Project[] : never;
      summary: Awaited<ReturnType<typeof getHubSummary>>;
    }
  : never;

export async function clientLoader() {
  const [projects, summary] = await Promise.all([getProjects(), getHubSummary()]);
  return { projects, summary };
}

clientLoader.hydrate = true as const;

export default function HubRoute() {
  const { projects, summary } = useLoaderData() as HubData;
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState("New project");
  const [searchQuery, setSearchQuery] = useState("");
  const firstProject = projects[0];

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || b.progress - a.progress),
    [projects],
  );

  const visibleProjects = useMemo(
    () =>
      sortedProjects.filter((project) => {
        const haystack = `${project.name} ${project.slug} ${project.status} ${project.summary}`.toLowerCase();
        return haystack.includes(searchQuery.trim().toLowerCase());
      }),
    [searchQuery, sortedProjects],
  );

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => createProject({ name, settings_json: { summary: `${name} workspace` } }),
    onSuccess: async (project) => {
      await refreshWorkspaceData(queryClient);
      revalidator.revalidate();
      navigate(`/projects/${project.id}/settings`);
    },
  });

  function handleCreateProject() {
    setProjectName("New project");
    setCreateProjectOpen(true);
  }

  return (
    <>
      <ActionDialog
        isOpen={createProjectOpen}
        title="Create project"
        description="Start a new local workspace with a default summary and editor state."
        confirmLabel="Create project"
        isPending={createProjectMutation.isPending}
        confirmDisabled={!projectName.trim()}
        onDismiss={() => setCreateProjectOpen(false)}
        onConfirm={() => {
          const name = projectName.trim();
          if (!name) {
            return;
          }

          setCreateProjectOpen(false);
          createProjectMutation.mutate(name);
        }}
      >
        <Input autoFocus value={projectName} onChange={setProjectName} placeholder="Project name" />
      </ActionDialog>

      <WorkspaceFrame
      eyebrow="Project hub"
      title="Studio intake"
      description="Recover a project, inspect its current state, and jump directly into the editorial workspace without losing context."
      toolbar={
        <>
          <Button onClick={() => navigate(firstProject ? `/projects/${firstProject.id}` : "/")}>Open latest project</Button>
          <Button variant="secondary" onClick={handleCreateProject} isDisabled={createProjectMutation.isPending}>
            Create project
          </Button>
        </>
      }
      left={
        <>
          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Storage</div>
            <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              <div className="flex items-center justify-between"><span>Projects</span><span className="font-mono text-[rgb(var(--foreground))]">{summary.projects}</span></div>
              <div className="flex items-center justify-between"><span>Active</span><span className="font-mono text-[rgb(var(--foreground))]">{summary.activeProjects}</span></div>
              <div className="flex items-center justify-between"><span>Warnings</span><span className="font-mono text-[rgb(var(--foreground))]">{summary.warnings}</span></div>
              <div className="flex items-center justify-between"><span>Running jobs</span><span className="font-mono text-[rgb(var(--foreground))]">{summary.runningJobs}</span></div>
            </div>
          </Card>

          <Card padding="md" className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Recent state</div>
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{project.name}</span>
                    <Badge tone={project.status === "active" ? "active" : project.status === "draft" ? "draft" : "archived"}>{project.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-[rgb(var(--muted-foreground))]">Updated {formatRelative(project.lastUpdated)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>
      }
      center={
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Projects" value={summary.projects} hint="Local projects available" />
            <StatTile label="Warnings" value={summary.warnings} hint="Continuity issues and missing references" />
            <StatTile label="Jobs" value={summary.runningJobs} hint="Current generation activity" />
            <StatTile label="Active" value={summary.activeProjects} hint="Projects ready for work" />
          </div>

          <Card padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Projects</div>
                <div className="mt-1 text-lg font-semibold">Recent workspaces</div>
              </div>
              <div className="w-full sm:max-w-sm">
                <SearchField label={<span className="sr-only">Search projects</span>} placeholder="Search projects, slugs, or statuses" onChange={setSearchQuery} />
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 md:grid-cols-2">
              {visibleProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="group rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-4 text-left transition hover:-translate-y-0.5 hover:border-[rgb(var(--primary)/0.3)] hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{project.name}</div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">{project.slug}</div>
                    </div>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: project.accent }} />
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">{project.summary}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={project.status === "active" ? "active" : project.status === "draft" ? "draft" : "archived"}>{project.status}</Badge>
                    <Badge tone="muted">{project.language}</Badge>
                    <Badge tone="primary">{project.progress}%</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[rgb(var(--muted-foreground))] sm:grid-cols-4">
                    <div>Chars {project.stats.characters}</div>
                    <div>Scenes {project.stats.scenes}</div>
                    <div>Assets {project.stats.assets}</div>
                    <div>Warn {project.stats.warnings}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Activity</div>
                <div className="mt-1 text-lg font-semibold">System overview</div>
              </div>
              <Badge tone="resolved">Healthy</Badge>
            </div>
            <div className="space-y-3">
              {visibleProjects.flatMap((project) => project.activity.slice(0, 1).map((entry) => ({ project, entry }))).map(({ project, entry }) => (
                <div key={`${project.id}-${entry}`} className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{project.name}</div>
                      <div className="mt-1 text-sm leading-6 text-[rgb(var(--muted-foreground))]">{entry}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">{formatDate(project.lastActivity)}</div>
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
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Actions</div>
            <div className="space-y-2">
              <Button UNSAFE_className="w-full justify-between" onClick={() => navigate(firstProject ? `/projects/${firstProject.id}/story` : "/")}>
                Resume writing
                <span>↗</span>
              </Button>
              <Button variant="secondary" UNSAFE_className="w-full justify-between" onClick={() => navigate(firstProject ? `/projects/${firstProject.id}/generation` : "/")}>
                Open generation studio
                <span>↗</span>
              </Button>
              <Button variant="ghost" UNSAFE_className="w-full justify-between" onClick={() => navigate(firstProject ? `/projects/${firstProject.id}/warnings` : "/")}>
                Review warnings
                <span>↗</span>
              </Button>
            </div>
          </Card>

          <Card padding="md" className="space-y-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Hub notes</div>
            <div className="space-y-2 text-sm leading-6 text-[rgb(var(--muted-foreground))]">
              <p>The frontend runs as a local SPA with persistent shell, editorial density, and a centralized command palette.</p>
              <p>Project state is mirrored in React Query and the UI shell syncs theme and density through Zustand.</p>
            </div>
          </Card>

          <Card padding="md" className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Preview</div>
            {firstProject ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold">{firstProject.name}</div>
                <div className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">{firstProject.summary}</div>
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3">Last updated<br /><span className="font-mono text-xs">{formatRelative(firstProject.lastUpdated)}</span></div>
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3">Project state<br /><span className="font-mono text-xs">{firstProject.status}</span></div>
                </div>
              </div>
            ) : (
              <EmptyState title="No projects" description="Create or import a project to begin working." />
            )}
          </Card>
        </>
      }
      />
    </>
  );
}

export function ErrorBoundary() {
  return <EmptyState title="Hub unavailable" description="The project hub could not be loaded." />;
}
