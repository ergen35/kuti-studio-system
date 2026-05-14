import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "~/components/layout";
import { api, apiErrorMessage } from "~/lib/api";
import { keys } from "~/lib/query";
import { useTranslation } from "~/hooks/useTranslation";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, Stat, dateLabel } from "~/components/ui";

export default function ProjectRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['project', 'common']);
  const project = useQuery({ queryKey: keys.project(projectId), queryFn: () => api.project(projectId) });
  const characters = useQuery({ queryKey: keys.characters(projectId), queryFn: () => api.characters(projectId) });
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const warnings = useQuery({ queryKey: keys.warnings(projectId), queryFn: () => api.warnings(projectId) });
  const versions = useQuery({ queryKey: keys.versions(projectId), queryFn: () => api.versions(projectId) });
  const exports = useQuery({ queryKey: keys.exports(projectId), queryFn: () => api.exports(projectId) });
  const jobs = useQuery({ queryKey: keys.generationJobs(projectId), queryFn: () => api.generationJobs(projectId) });

  const workspaces = [
    { key: "characters", title: t('workspaces.characters.title'), desc: t('workspaces.characters.description') },
    { key: "storyline", title: t('workspaces.storyline.title'), desc: t('workspaces.storyline.description') },
    { key: "generation", title: t('workspaces.generation.title'), desc: t('workspaces.generation.description') },
    { key: "assets", title: t('workspaces.assets.title'), desc: t('workspaces.assets.description') },
    { key: "warnings", title: t('workspaces.warnings.title'), desc: t('workspaces.warnings.description') },
    { key: "versions", title: t('workspaces.versions.title'), desc: t('workspaces.versions.description') },
    { key: "exports", title: t('workspaces.exports.title'), desc: t('workspaces.exports.description') },
    { key: "settings", title: t('workspaces.settings.title'), desc: t('workspaces.settings.description') },
  ];

  return (
    <AppShell>
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? (
        <>
          <PageHeader
            title={project.data.name}
            description={t('meta.description', { slug: project.data.slug, path: project.data.root_path })}
            actions={<Badge>{project.data.status}</Badge>}
          />
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat value={characters.data?.items.length ?? "-"} label={t('stats.characters')} />
            <Stat value={story.data?.scenes.length ?? "-"} label={t('stats.scenes')} />
            <Stat value={warnings.data?.filter((item) => item.status === "open").length ?? "-"} label={t('stats.warnings')} />
            <Stat value={versions.data?.length ?? "-"} label={t('stats.versions')} />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {workspaces.map(({ key, title, desc }) => (
              <Card key={key}>
                <SectionTitle title={title} />
                <p className="mb-3 text-xs leading-5 text-muted">{desc}</p>
                <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[7px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2" to={`/projects/${projectId}/${key === 'storyline' ? 'story' : key}`}>
                  {t('common:workspace.open', { name: title })}
                </Link>
              </Card>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Card>
              <SectionTitle title={t('recent.warnings.title')} meta={`${warnings.data?.length ?? 0} ${t('common:meta.total')}`} />
              <div className="grid gap-2">{(warnings.data || []).slice(0, 5).map((warning) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={warning.id}><strong className="text-sm text-ink">{warning.title}</strong><small className="text-xs text-muted">{warning.message}</small></div>)}</div>
              {warnings.data?.length === 0 ? <EmptyState title={t('recent.warnings.empty.title')} description={t('recent.warnings.empty.description')} /> : null}
            </Card>
            <Card>
              <SectionTitle title={t('recent.production.title')} meta={`${jobs.data?.length ?? 0} ${t('recent.production.jobs')} · ${exports.data?.length ?? 0} ${t('recent.production.exports')}`} />
              <p className="text-xs leading-5 text-muted">{t('common:meta.updated')} {dateLabel(project.data.updated_at)}</p>
              <p className="text-xs leading-5 text-muted">{t('meta.lastOpened')} {dateLabel(project.data.last_opened_at)}</p>
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
