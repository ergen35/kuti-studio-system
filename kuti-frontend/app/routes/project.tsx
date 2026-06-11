import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Brush,
  Clapperboard,
  Clock3,
  FileArchive,
  Settings,
  UsersRound,
  BookOpen,
  ArrowRight,
} from "lucide-react";
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
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  RouterLinkButton,
  SectionTitle,
  Stat,
  dateLabel,
} from "~/components/ui";

export default function ProjectRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["project", "common"]);
  const project = useQuery({
    ...getProjectOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const characters = useQuery({
    ...listCharactersOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const warnings = useQuery({
    ...listWarningsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const versions = useQuery({
    ...listVersionsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const exports = useQuery({
    ...listExportsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const jobs = useQuery({
    ...listGenerationJobsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const warningItems =
    (warnings.data as
      | Array<{ id: string; status: string; title: string; message: string }>
      | undefined) ?? [];
  const jobItems = (jobs.data as Array<unknown> | undefined) ?? [];
  const exportItems = (exports.data as Array<unknown> | undefined) ?? [];
  const versionItems = (versions.data as Array<unknown> | undefined) ?? [];
  const openWarningCount = warnings.data
    ? warningItems.filter((item) => item.status === "open").length
    : null;
  const jobCount = jobs.data ? jobItems.length : null;
  const exportCount = exports.data ? exportItems.length : null;
  const versionCount = versions.data ? versionItems.length : null;

  const workspaces = [
    {
      key: "characters",
      title: t("workspaces.characters.title"),
      desc: t("workspaces.characters.description"),
      icon: UsersRound,
    },
    {
      key: "storyline",
      title: t("workspaces.storyline.title"),
      desc: t("workspaces.storyline.description"),
      icon: BookOpen,
    },
    {
      key: "generation",
      title: t("workspaces.generation.title"),
      desc: t("workspaces.generation.description"),
      icon: Brush,
    },
    {
      key: "dramaVideos",
      title: t("workspaces.dramaVideos.title"),
      desc: t("workspaces.dramaVideos.description"),
      icon: Clapperboard,
    },
    {
      key: "assets",
      title: t("workspaces.assets.title"),
      desc: t("workspaces.assets.description"),
      icon: Boxes,
    },
    {
      key: "warnings",
      title: t("workspaces.warnings.title"),
      desc: t("workspaces.warnings.description"),
      icon: AlertTriangle,
    },
    {
      key: "versions",
      title: t("workspaces.versions.title"),
      desc: t("workspaces.versions.description"),
      icon: Clock3,
    },
    {
      key: "exports",
      title: t("workspaces.exports.title"),
      desc: t("workspaces.exports.description"),
      icon: FileArchive,
    },
    {
      key: "settings",
      title: t("workspaces.settings.title"),
      desc: t("workspaces.settings.description"),
      icon: Settings,
    },
  ];

  const getProjectPath = (data: typeof project.data) => data?.rootPath ?? "";
  const getProjectUpdatedAt = (data: typeof project.data) =>
    typeof data?.updatedAt === "string" ? data.updatedAt : null;
  const getProjectLastOpenedAt = (data: typeof project.data) =>
    typeof data?.lastOpenedAt === "string" ? data.lastOpenedAt : null;

  // Helper for characters data (handles both array and { items: [...] })
  const getCharactersCount = () => {
    const data = characters.data;
    if (!data) return "-";
    const items = Array.isArray(data) ? data : [];
    return items.length;
  };

  return (
    <AppShell>
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? (
        <ErrorState message={apiErrorMessage(project.error)} />
      ) : null}
      {project.data ? (
        <>
          <PageHeader
            title={project.data.name}
            description={t("meta.description", {
              slug: project.data.slug,
              path: getProjectPath(project.data),
            })}
            actions={<Badge>{project.data.status}</Badge>}
          />
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              value={getCharactersCount()}
              label={t("stats.characters")}
              icon={<UsersRound size={16} />}
            />
            <Stat
              value={story.data?.scenes?.length ?? "-"}
              label={t("stats.scenes")}
              icon={<BookOpen size={16} />}
            />
            <Stat
              value={openWarningCount ?? "-"}
              label={t("stats.warnings")}
              icon={<AlertTriangle size={16} />}
            />
            <Stat
              value={versionCount ?? "-"}
              label={t("stats.versions")}
              icon={<Clock3 size={16} />}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map(({ key, title, desc, icon: Icon }) => (
              <Card key={key} className="group">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Icon size={18} />
                  </div>
                  <Badge tone={key}>{key}</Badge>
                </div>
                <h2 className="text-sm font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                <p className="mt-1.5 min-h-10 text-xs leading-relaxed text-muted">
                  {desc}
                </p>
                <RouterLinkButton
                  className="mt-4 w-full justify-between"
                  to={`/projects/${projectId}/${key === "storyline" ? "story" : key === "dramaVideos" ? "drama-videos" : key}`}
                >
                  {t("common:workspace.open", { name: title })}
                  <ArrowRight
                    size={14}
                    className="opacity-50 transition-transform group-hover:translate-x-1"
                  />
                </RouterLinkButton>
              </Card>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card elevated>
              <SectionTitle
                title={t("recent.warnings.title")}
                meta={
                  warnings.isLoading
                    ? t("common:states.loading")
                    : warnings.error
                      ? t("common:states.error")
                      : `${warningItems.length} ${t("common:meta.total")}`
                }
              />
              {warnings.isLoading ? (
                <LoadingState label={t("common:states.loading")} />
              ) : warnings.error ? (
                <ErrorState message={apiErrorMessage(warnings.error)} />
              ) : warningItems.length === 0 ? (
                <EmptyState
                  title={t("recent.warnings.empty.title")}
                  description={t("recent.warnings.empty.description")}
                />
              ) : (
                <div className="grid gap-2">
                  {warningItems.slice(0, 5).map((warning) => (
                    <div
                      className="grid gap-1.5 rounded-xl border border-line/50 bg-surface-2/50 p-3"
                      key={warning.id}
                    >
                      <strong className="text-sm text-ink">
                        {warning.title}
                      </strong>
                      <small className="text-xs text-muted">
                        {warning.message}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card elevated>
              <SectionTitle
                title={t("recent.production.title")}
                meta={`${jobCount ?? "-"} ${t("recent.production.jobs")} · ${exportCount ?? "-"} ${t("recent.production.exports")}`}
              />
              <div className="grid gap-3 text-sm leading-relaxed text-muted">
                <p>
                  {t("common:meta.updated")}{" "}
                  <span className="text-ink">{dateLabel(getProjectUpdatedAt(project.data))}</span>
                </p>
                <p>
                  {t("meta.lastOpened")}{" "}
                  <span className="text-ink">{dateLabel(getProjectLastOpenedAt(project.data))}</span>
                </p>
              </div>
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
