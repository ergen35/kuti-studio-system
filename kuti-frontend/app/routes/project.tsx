import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "~/components/layout";
import { api, apiErrorMessage } from "~/lib/api";
import { keys } from "~/lib/query";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, Stat, dateLabel } from "~/components/ui";

export default function ProjectRoute() {
  const { projectId = "" } = useParams();
  const project = useQuery({ queryKey: keys.project(projectId), queryFn: () => api.project(projectId) });
  const characters = useQuery({ queryKey: keys.characters(projectId), queryFn: () => api.characters(projectId) });
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const warnings = useQuery({ queryKey: keys.warnings(projectId), queryFn: () => api.warnings(projectId) });
  const versions = useQuery({ queryKey: keys.versions(projectId), queryFn: () => api.versions(projectId) });
  const exports = useQuery({ queryKey: keys.exports(projectId), queryFn: () => api.exports(projectId) });
  const jobs = useQuery({ queryKey: keys.generationJobs(projectId), queryFn: () => api.generationJobs(projectId) });

  return (
    <AppShell>
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? (
        <>
          <PageHeader
            title={project.data.name}
            description={`Project ${project.data.slug} lives at ${project.data.root_path}.`}
            actions={<Badge>{project.data.status}</Badge>}
          />
          <div className="stats">
            <Stat value={characters.data?.items.length ?? "-"} label="Characters" />
            <Stat value={story.data?.scenes.length ?? "-"} label="Scenes" />
            <Stat value={warnings.data?.filter((item) => item.status === "open").length ?? "-"} label="Open warnings" />
            <Stat value={versions.data?.length ?? "-"} label="Versions" />
          </div>
          <div className="grid three">
            {[
              ["Characters", "Maintain cast profiles, relations and voice notes.", "characters"],
              ["Storyline", "Structure tomes, chapters, scenes and typed references.", "story"],
              ["Generation", "Launch image or video generation jobs from story sources.", "generation"],
              ["Assets", "Import local files and link them to project entities.", "assets"],
              ["Warnings", "Scan and resolve continuity warnings.", "warnings"],
              ["Versions", "Create checkpoints, compare branches and restore snapshots.", "versions"],
              ["Exports", "Generate work exports in JSON, tree or ZIP format.", "exports"],
              ["Settings", "Edit project metadata and coherence settings.", "settings"],
            ].map(([title, desc, path]) => (
              <Card key={path}>
                <SectionTitle title={title} />
                <p className="meta">{desc}</p>
                <Link className="button" to={`/projects/${projectId}/${path}`}>Open {title}</Link>
              </Card>
            ))}
          </div>
          <div style={{ height: 16 }} />
          <div className="grid two">
            <Card>
              <SectionTitle title="Recent warnings" meta={`${warnings.data?.length ?? 0} total`} />
              {(warnings.data || []).slice(0, 5).map((warning) => <div className="list-item" key={warning.id}><strong>{warning.title}</strong><small>{warning.message}</small></div>)}
              {warnings.data?.length === 0 ? <EmptyState title="No warnings" description="Run a scan from the Warnings workspace." /> : null}
            </Card>
            <Card>
              <SectionTitle title="Recent production" meta={`${jobs.data?.length ?? 0} jobs · ${exports.data?.length ?? 0} exports`} />
              <p className="meta">Updated {dateLabel(project.data.updated_at)}</p>
              <p className="meta">Last opened {dateLabel(project.data.last_opened_at)}</p>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <AppShell />;
}
