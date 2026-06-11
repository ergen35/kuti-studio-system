import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brush,
  FileArchive,
  Settings,
  UsersRound,
  BookOpen,
  ChevronRight,
  Activity,
} from "lucide-react";
import { AppShell } from "~/components/layout";
import { apiErrorMessage } from "~/lib/errors";
import {
  getProjectOptions,
  listCharactersOptions,
  getStorySummaryOptions,
  listWarningsOptions,
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
  SectionTitle,
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
  const openWarningCount = warnings.data
    ? warningItems.filter((item) => item.status === "open").length
    : null;
  const jobCount = jobs.data ? jobItems.length : null;
  const exportCount = exports.data ? exportItems.length : null;

  const getProjectPath = (data: typeof project.data) => data?.rootPath ?? "";
  const getProjectUpdatedAt = (data: typeof project.data) =>
    typeof data?.updatedAt === "string" ? data.updatedAt : null;
  const getProjectLastOpenedAt = (data: typeof project.data) =>
    typeof data?.lastOpenedAt === "string" ? data.lastOpenedAt : null;

  const getCharactersCount = () => {
    const data = characters.data;
    if (!data) return "-";
    const items = Array.isArray(data) ? data : [];
    return items.length;
  };

  const getTomesCount = () => story.data?.tomes?.length ?? 0;
  const getChaptersCount = () => story.data?.chapters?.length ?? 0;

  const mainWorkspaces = [
    {
      key: "characters",
      path: "characters",
      title: t("workspaces.characters.title"),
      icon: UsersRound,
      stat: getCharactersCount(),
      statLabel: t("stats.characters"),
    },
    {
      key: "storyline",
      path: "story",
      title: t("workspaces.storyline.title"),
      icon: BookOpen,
      stat: story.data?.scenes?.length ?? "-",
      statLabel: t("stats.scenes"),
    },
    {
      key: "generation",
      path: "generation",
      title: t("workspaces.generation.title"),
      icon: Brush,
      stat: jobCount ?? "-",
      statLabel: t("recent.production.jobs"),
    },
  ];

  const secondaryWorkspaces = [
    {
      key: "warnings",
      path: "warnings",
      title: t("workspaces.warnings.title"),
      icon: AlertTriangle,
      badge: openWarningCount,
      badgeTone: openWarningCount && openWarningCount > 0 ? "warning" : "ready",
    },
    {
      key: "exports",
      path: "exports",
      title: t("workspaces.exports.title"),
      icon: FileArchive,
      badge: exportCount,
    },
    {
      key: "tasks",
      path: "tasks",
      title: t("workspaces.tasks.title"),
      icon: Activity,
    },
    {
      key: "settings",
      path: "settings",
      title: t("workspaces.settings.title"),
      icon: Settings,
    },
  ];

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

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Main content */}
            <div className="flex flex-col gap-6">
              {/* Primary workspaces - larger cards with stats */}
              <div className="grid gap-3 sm:grid-cols-3">
                {mainWorkspaces.map(
                  ({ key, path, title, icon: Icon, stat, statLabel }) => (
                    <Link
                      key={key}
                      to={`/projects/${projectId}/${path}`}
                      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-all hover:border-accent/40 hover:bg-accent/5 hover:shadow-md"
                    >
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:scale-110">
                        <Icon size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-ink">
                          {title}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted">
                          <span className="font-medium text-ink">{stat}</span>{" "}
                          {statLabel}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                      />
                    </Link>
                  ),
                )}
              </div>

              {/* Secondary workspaces - compact row */}
              <div className="flex flex-wrap gap-2">
                {secondaryWorkspaces.map(
                  ({ key, path, title, icon: Icon, badge, badgeTone }) => (
                    <Link
                      key={key}
                      to={`/projects/${projectId}/${path}`}
                      className="group inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm transition-all hover:border-accent/40 hover:bg-accent/5"
                    >
                      <Icon
                        size={15}
                        className="text-muted group-hover:text-accent"
                      />
                      <span className="font-medium text-ink">{title}</span>
                      {badge !== undefined && badge !== null && (
                        <Badge
                          tone={badgeTone}
                          className="ml-1 px-1.5 py-0 text-[10px]"
                        >
                          {badge}
                        </Badge>
                      )}
                    </Link>
                  ),
                )}
              </div>

              {/* Story overview */}
              <Card elevated>
                <SectionTitle
                  title={t("recent.story.title")}
                  meta={`${getTomesCount()} ${t("stats.tomes")} · ${getChaptersCount()} ${t("stats.chapters")} · ${story.data?.scenes?.length ?? 0} ${t("stats.scenes")}`}
                />
                <div className="mt-3 grid gap-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2">
                    <span className="text-muted">{t("common:meta.updated")}</span>
                    <span className="font-medium text-ink">
                      {dateLabel(getProjectUpdatedAt(project.data))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-surface-2/50 px-3 py-2">
                    <span className="text-muted">{t("meta.lastOpened")}</span>
                    <span className="font-medium text-ink">
                      {dateLabel(getProjectLastOpenedAt(project.data))}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar - Warnings */}
            <div className="flex flex-col gap-4">
              <Card elevated className="flex-1">
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
                    {warningItems.slice(0, 4).map((warning) => (
                      <div
                        className="grid gap-1 rounded-lg border border-line/50 bg-surface-2/50 p-2.5"
                        key={warning.id}
                      >
                        <strong className="text-xs font-medium text-ink line-clamp-1">
                          {warning.title}
                        </strong>
                        <small className="text-[11px] text-muted line-clamp-2">
                          {warning.message}
                        </small>
                      </div>
                    ))}
                    {warningItems.length > 4 && (
                      <Link
                        to={`/projects/${projectId}/warnings`}
                        className="text-center text-xs text-accent hover:underline"
                      >
                        {t("common:actions.viewAll")} ({warningItems.length})
                      </Link>
                    )}
                  </div>
                )}
              </Card>

              {/* Production stats */}
              <div className="rounded-xl border border-line bg-surface p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("recent.production.title")}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-ink">
                      {jobCount ?? "-"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {t("recent.production.jobs")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-ink">
                      {exportCount ?? "-"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {t("recent.production.exports")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

export function ErrorBoundary() {
  return <AppShell />;
}
