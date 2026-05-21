import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "~/components/layout";
import { apiErrorMessage } from "~/lib/errors";
import {
  getProjectOptions,
  listCharactersOptions,
  getStorySummaryOptions,
  listWarningsOptions,
  listVersionsOptions,
  listExportsOptions,
  listGenerationJobsOptions,
} from "~/lib/backend/@tanstack/react-query.gen";
import { useTranslation } from "~/hooks/useTranslation";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, Stat, dateLabel } from "~/components/ui";

export default function ProjectRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['project', 'common']);
  const project = useQuery({ ...getProjectOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const characters = useQuery({ ...listCharactersOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const story = useQuery({ ...getStorySummaryOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const warnings = useQuery({ ...listWarningsOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const versions = useQuery({ ...listVersionsOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const exports = useQuery({ ...listExportsOptions({ path: { project_id: projectId } }), enabled: !!projectId });
  const jobs = useQuery({ ...listGenerationJobsOptions({ path: { project_id: projectId } }), enabled: !!projectId });

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

  // Helper to access properties with both camelCase and snake_case support
  const getProjectPath = (data: typeof project.data) => {
    if (!data) return "";
    // @ts-expect-error - support both snake_case and camelCase
    return data.rootPath || data.root_path || "";
  };

  const getProjectUpdatedAt = (data: typeof project.data) => {
    if (!data) return null;
    // @ts-expect-error - support both snake_case and camelCase
    return data.updatedAt || data.updated_at || null;
  };

  const getProjectLastOpenedAt = (data: typeof project.data) => {
    if (!data) return null;
    // @ts-expect-error - support both snake_case and camelCase
    return data.lastOpenedAt || data.last_opened_at || null;
  };

  // Helper for characters data (handles both array and { items: [...] })
  const getCharactersCount = () => {
    const data = characters.data;
    if (!data) return "-";
    // @ts-expect-error - support both formats
    const items = Array.isArray(data) ? data : (data.items || []);
    return items.length;
  };

  return (
    <AppShell>
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? (
        <>
          <PageHeader
            title={project.data.name}
            description={t('meta.description', { slug: project.data.slug, path: getProjectPath(project.data) })}
            actions={<Badge>{project.data.status}</Badge>}
          />
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <Stat value={getCharactersCount()} label={t('stats.characters')} />
            <Stat value={story.data?.scenes?.length ?? "-"} label={t('stats.scenes')} />
            <Stat value={warnings.data?.filter?.((item: { status: string }) => item.status === "open").length ?? "-"} label={t('stats.warnings')} />
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
              <p className="text-xs leading-5 text-muted">{t('common:meta.updated')} {dateLabel(getProjectUpdatedAt(project.data))}</p>
              <p className="text-xs leading-5 text-muted">{t('meta.lastOpened')} {dateLabel(getProjectLastOpenedAt(project.data))}</p>
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
