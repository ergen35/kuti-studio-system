import { useState, useMemo } from "react";
import { Archive } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  CreativeBackground,
  ImportProjectDialog,
  HeroSection,
  MinimalBackendStatus,
  ProjectCard,
  ThemeToggle,
  ViewToggle,
} from "~/components/home";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
} from "~/components/ui";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import {
  characterImageUrlFromData,
  type CharacterImageWithUrl,
} from "~/lib/image-urls";
import type { Project } from "~/lib/backend/types.gen";
import {
  listProjectsOptions,
  createProjectMutation,
  importProjectMutation,
  createExportMutation,
  getProjectCharacterImagesOptions,
  getStorySummaryOptions,
  listCharactersOptions,
  getHealthOptions,
  openProjectMutation,
  archiveProjectMutation,
  cloneProjectMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { invalidateQueriesById, queryClient } from "~/lib/query";
import { projectCreateSchema } from "~/lib/schemas";
import type { ProjectCreateInput } from "~/lib/schemas";
import { useTranslation } from "~/hooks/useTranslation";

// =============================================================================
// Types
// =============================================================================

interface ProjectMetrics {
  tomes: number;
  chapters: number;
  scenes: number;
  characters: number;
}

interface ProjectWithMetrics {
  project: Project;
  metrics: ProjectMetrics;
}

// =============================================================================
// Hooks
// =============================================================================

function useBackgroundImages() {
  const projects = useQuery(listProjectsOptions());

  const projectImagesQueries = useMemo(() => {
    const items = projects.data ?? [];
    return items.slice(0, 6).map((p) => ({
      projectId: p.id,
      queryKey: ["characterImages", p.id, "all"] as const,
    }));
  }, [projects.data]);

  const imagesResults = useQuery({
    queryKey: [
      "backgroundImages",
      projectImagesQueries.map((q) => q.projectId),
    ],
    queryFn: async () => {
      const results: string[] = [];
      for (const { projectId } of projectImagesQueries) {
        try {
          const images = await queryClient.fetchQuery(
            getProjectCharacterImagesOptions({ path: { projectId } }),
          );
          if (images) {
            const imageUrls = Object.values(images).flat().slice(0, 2);
            for (const img of imageUrls) {
              results.push(
                characterImageUrlFromData({
                  publicUrl: (img as unknown as CharacterImageWithUrl)
                    .publicUrl,
                  fileName: img.fileName,
                  projectId: img.projectId || projectId,
                  characterId: img.characterId,
                  id: img.id,
                }),
              );
            }
          }
        } catch {
          // Ignore errors for background images
        }
      }
      return results;
    },
    enabled: projectImagesQueries.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return imagesResults.data || [];
}

type ProjectMetricsMap = Record<string, ProjectMetrics>;

function useProjectMetrics(projects: Project[]) {
  const projectKey = useMemo(
    () => projects.map((project) => project.id).join("|"),
    [projects],
  );

  return useQuery<ProjectMetricsMap>({
    queryKey: ["projectMetrics", projectKey],
    enabled: projects.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        projects.map(async (project) => {
          const [story, characters] = await Promise.all([
            queryClient.fetchQuery(
              getStorySummaryOptions({ path: { projectId: project.id } }),
            ),
            queryClient.fetchQuery(
              listCharactersOptions({ path: { projectId: project.id } }),
            ),
          ]);

          return [
            project.id,
            {
              tomes: story.tomes.length,
              chapters: story.chapters.length,
              scenes: story.scenes.length,
              characters: characters.length,
            },
          ] as const;
        }),
      );

      return Object.fromEntries(entries);
    },
  });
}

// =============================================================================
// Components
// =============================================================================

function BackendStatusSection() {
  const { t } = useTranslation("home");
  const health = useQuery({ ...getHealthOptions(), retry: 0 });

  const status: "ok" | "error" | "loading" | "unknown" = health.isLoading
    ? "loading"
    : health.error
      ? "error"
      : health.data?.status === "ok"
        ? "ok"
        : "unknown";

  return (
    <div className="flex items-center justify-end gap-3">
      <ThemeToggle />
      <MinimalBackendStatus
        status={status}
        service={health.data?.service as string | undefined}
        version={health.data?.version as string | undefined}
        dataDir={health.data?.dataDir as string | undefined}
        lastCheck={health.data?.timestamp as string | undefined}
        onRefresh={() => health.refetch()}
        isRefreshing={health.isRefetching}
      />
    </div>
  );
}

function ProjectsSection() {
  const { t } = useTranslation(["home", "common"]);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Project["status"] | "all">(
    "all",
  );
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const queryClient = useQueryClient();

  const projects = useQuery(listProjectsOptions());
  const projectItems = projects.data ?? [];
  const metrics = useProjectMetrics(projectItems);

  const open = useMutation({
    ...openProjectMutation(),
    onSuccess: async (project) => {
      await invalidateQueriesById(queryClient, "listProjects");
      if (project) {
        navigate(`/projects/${project.id}`);
      }
    },
  });

  const archive = useMutation({
    ...archiveProjectMutation(),
    onSuccess: () => {
      setArchiveTarget(null);
      invalidateQueriesById(queryClient, "listProjects");
    },
  });

  const quickExport = useMutation({
    ...createExportMutation(),
    onSuccess: async (_exportRecord, variables) => {
      await invalidateQueriesById(queryClient, "listExports");

      const projectId = variables?.path?.projectId;
      if (projectId) {
        navigate(`/projects/${projectId}/exports`);
      }
    },
  });

  const clone = useMutation({
    ...cloneProjectMutation(),
    onSuccess: () => invalidateQueriesById(queryClient, "listProjects"),
  });

  const items: ProjectWithMetrics[] = useMemo(() => {
    const metricsByProjectId = metrics.data ?? {};

    return projectItems.map((project) => ({
      project,
      metrics: metricsByProjectId[project.id] ?? {
        tomes: 0,
        chapters: 0,
        scenes: 0,
        characters: 0,
      },
    }));
  }, [metrics.data, projectItems]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter(({ project }) => {
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;
      if (!matchesStatus) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [project.name, project.slug, project.rootPath, project.status]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [items, search, statusFilter]);

  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  if (projects.isLoading || metrics.isLoading) {
    return <LoadingState label={t("projects.loadingMetrics")} />;
  }

  if (projects.error) {
    return <ErrorState message={apiErrorMessage(projects.error)} />;
  }

  if (metrics.error) {
    return <ErrorState message={apiErrorMessage(metrics.error)} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("home:projects.empty.title")}
        description={t("home:projects.empty.description")}
      />
    );
  }

  const statusOptions = [
    { value: "draft", label: t("projects.status.draft") },
    { value: "active", label: t("projects.status.active") },
    { value: "archived", label: t("projects.status.archived") },
    { value: "maintenance", label: t("projects.status.maintenance") },
  ] as const;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("projects.title")}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("projects.count", { count: items.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" className="text-[10px]">
            {t("projects.visible", { count: filteredItems.length })}
          </Badge>
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border/70 bg-secondary/15 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <label className="grid gap-1.5 text-xs text-muted-foreground">
          <span>{t("projects.filters.search")}</span>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("projects.filters.searchPlaceholder")}
          />
        </label>

        <label className="grid gap-1.5 text-xs text-muted-foreground">
          <span>{t("projects.filters.status")}</span>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as Project["status"] | "all")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("projects.filters.allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {t("projects.filters.allStatuses")}
                </SelectItem>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-end justify-end">
          <Button
            variant="ghost"
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
          >
            {t("projects.filters.reset")}
          </Button>
        </div>
      </div>

      {quickExport.error ? (
        <ErrorState message={apiErrorMessage(quickExport.error)} />
      ) : null}

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) =>
          !open && !archive.isPending && setArchiveTarget(null)
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <Archive className="text-warning" size={18} />
            </div>
            <div>
              <DialogTitle>{t("projects.archive.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("projects.archive.dialogDescription", {
                  name: archiveTarget?.name,
                })}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mb-4 rounded-[7px] bg-surface-2 p-3">
            <span className="text-xs text-muted">
              {t("projects.archive.projectLabel")}:
            </span>
            <p className="font-medium text-ink">{archiveTarget?.name}</p>
          </div>

          {archive.error ? (
            <div className="rounded-[7px] border border-danger/30 bg-danger/8 p-3 text-sm text-danger">
              {apiErrorMessage(archive.error)}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setArchiveTarget(null)}
              disabled={archive.isPending}
            >
              {t("projects.archive.cancelButton")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (archiveTarget) {
                  archive.mutate({ path: { projectId: archiveTarget.id } });
                }
              }}
              disabled={!archiveTarget || archive.isPending}
            >
              {archive.isPending
                ? t("projects.archive.confirming")
                : t("projects.archive.confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {filteredItems.length === 0 ? (
        <EmptyState
          title={t("projects.emptyFiltered.title")}
          description={t("projects.emptyFiltered.description")}
          action={
            hasFilters ? (
              <Button variant="ghost" type="button" onClick={resetFilters}>
                {t("projects.filters.reset")}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {filteredItems.length > 0 ? (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              : "space-y-2"
          }
        >
          {filteredItems.map(({ project, metrics }) => (
            <ProjectCard
              key={project.id}
              project={project}
              metrics={metrics}
              onOpen={() => open.mutate({ path: { projectId: project.id } })}
              onQuickExport={() =>
                quickExport.mutate({
                  path: { projectId: project.id },
                  body: {
                    kind: "work",
                    format: "zip",
                    label: t("projects.actions.quickExportLabel", {
                      name: project.name,
                    }),
                    summary: t("projects.actions.quickExportSummary"),
                  },
                })
              }
              onClone={() =>
                clone.mutate({ path: { projectId: project.id }, body: {} })
              }
              onArchive={() => setArchiveTarget(project)}
              isQuickExporting={quickExport.isPending}
              viewMode={viewMode}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// =============================================================================
// Main Route
// =============================================================================

export default function HomeRoute() {
  const navigate = useNavigate();
  const backgroundImages = useBackgroundImages();
  const queryClient = useQueryClient();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const create = useMutation({
    ...createProjectMutation(),
    onSuccess: async (data) => {
      await invalidateQueriesById(queryClient, "listProjects");
      const project = data as unknown as Project;
      navigate(`/projects/${project.id}`);
    },
  });

  const importProject = useMutation({
    ...importProjectMutation(),
    onSuccess: async (project) => {
      await invalidateQueriesById(queryClient, "listProjects");
      setIsImportDialogOpen(false);
      if (project) {
        navigate(`/projects/${project.id}`);
      }
    },
  });

  const [projectName, setProjectName] = useState("");

  const handleCreate = () => {
    if (projectName.trim()) {
      create.mutate({
        body: {
          name: projectName.trim(),
          status: "draft",
          settingsJson: {},
        },
      });
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Creative background with project images */}
      <CreativeBackground images={backgroundImages} />

      {/* Main content */}
      <main className="relative z-10 p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <BackendStatusSection />
        </div>

        <div className="mx-auto mb-8 max-w-6xl">
          <HeroSection
            projectName={projectName}
            onProjectNameChange={setProjectName}
            onSubmit={handleCreate}
            onOpenExisting={() => setIsImportDialogOpen(true)}
            isLoading={create.isPending}
            error={create.error ? apiErrorMessage(create.error) : null}
          />
        </div>

        <ImportProjectDialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
          onSubmit={({ rootPath, name }) => {
            importProject.mutate({
              body: {
                rootPath,
                name,
                status: "draft",
                settingsJson: {},
              },
            });
          }}
          isLoading={importProject.isPending}
          error={
            importProject.error ? apiErrorMessage(importProject.error) : null
          }
        />

        <div className="mx-auto max-w-6xl">
          <ProjectsSection />
        </div>
      </main>
    </div>
  );
}
