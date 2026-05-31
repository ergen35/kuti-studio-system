import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  CreativeBackground,
  HeroSection,
  MinimalBackendStatus,
  ProjectCard,
  ThemeToggle,
  ViewToggle,
} from "~/components/home";
import { Badge, EmptyState, ErrorState, LoadingState } from "~/components/ui";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import { characterImageUrlFromData, type CharacterImageWithUrl } from "~/lib/image-urls";
import type { Project } from "~/lib/backend/types.gen";
import {
  listProjectsOptions,
  createProjectMutation,
  getProjectCharacterImagesOptions,
  getHealthOptions,
  openProjectMutation,
  archiveProjectMutation,
  cloneProjectMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { keys, queryClient } from "~/lib/query";
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
    return items.slice(0, 6).map(p => ({
      projectId: p.id,
      queryKey: ['characterImages', p.id, 'all'] as const,
    }));
  }, [projects.data]);

  const imagesResults = useQuery({
    queryKey: ['backgroundImages', projectImagesQueries.map(q => q.projectId)],
    queryFn: async () => {
      const results: string[] = [];
      for (const { projectId } of projectImagesQueries) {
        try {
          const images = await queryClient.fetchQuery(getProjectCharacterImagesOptions({ path: { projectId } }));
          if (images) {
            const imageUrls = Object.values(images).flat().slice(0, 2);
            for (const img of imageUrls) {
              results.push(characterImageUrlFromData({
                publicUrl: (img as unknown as CharacterImageWithUrl).publicUrl,
                fileName: img.fileName,
                projectId: img.projectId || projectId,
                characterId: img.characterId,
                id: img.id,
              }));
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

// Generate mock metrics for a project (until backend endpoint is available)
function generateProjectMetrics(project: Project): ProjectMetrics {
  // Use project ID to generate consistent pseudo-random metrics
  const hash = project.id.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const absHash = Math.abs(hash);
  
  return {
    tomes: (absHash % 5) + 1,
    chapters: (absHash % 20) + 3,
    scenes: (absHash % 50) + 10,
    characters: (absHash % 15) + 2,
  };
}

// =============================================================================
// Components
// =============================================================================

function BackendStatusSection() {
  const { t } = useTranslation('home');
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
  const { t } = useTranslation(['home', 'common']);
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const queryClient = useQueryClient();
  
  const projects = useQuery(listProjectsOptions());
  
  const open = useMutation({
    ...openProjectMutation(),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      if (project) {
        navigate(`/projects/${project.id}`);
      }
    },
  });
  
  const archive = useMutation({
    ...archiveProjectMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });
  
  const clone = useMutation({
    ...cloneProjectMutation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });

  const items: ProjectWithMetrics[] = useMemo(() => {
    const projectItems = projects.data ?? [];
    return projectItems.map(project => ({
      project,
      metrics: generateProjectMetrics(project),
    }));
  }, [projects.data]);

  const activeCount = items.filter(i => i.project.status === "active").length;
  const draftCount = items.filter(i => i.project.status === "draft").length;

  if (projects.isLoading) {
    return <LoadingState label={t('common:states.loading')} />;
  }

  if (projects.error) {
    return <ErrorState message={apiErrorMessage(projects.error)} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('home:projects.empty.title')}
        description={t('home:projects.empty.description')}
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('home:projects.title')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('home:projects.count', { count: items.length })}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {activeCount > 0 && (
              <Badge tone="active" className="text-[10px]">
                {t('home:projects.statusCount.active', { count: activeCount })}
              </Badge>
            )}
            {draftCount > 0 && (
              <Badge tone="draft" className="text-[10px]">
                {t('home:projects.statusCount.draft', { count: draftCount })}
              </Badge>
            )}
          </div>
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <div className={viewMode === "grid"
        ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        : "space-y-2"
      }>
        {items.map(({ project, metrics }) => (
          <ProjectCard
            key={project.id}
            project={project}
            metrics={metrics}
            onOpen={() => open.mutate({ path: { projectId: project.id } })}
            onClone={() => clone.mutate({ path: { projectId: project.id }, body: {} })}
            onArchive={() => archive.mutate({ path: { projectId: project.id } })}
            viewMode={viewMode}
          />
        ))}
      </div>
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
  
  const create = useMutation({
    ...createProjectMutation(),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      const project = data as unknown as Project;
      navigate(`/projects/${project.id}`);
    },
  });
  
  const [projectName, setProjectName] = useState("");

  const handleCreate = () => {
    if (projectName.trim()) {
      create.mutate({
        body: {
          name: projectName.trim(),
          status: "draft",
          settingsJson: {}
        }
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
            isLoading={create.isPending}
            error={create.error ? apiErrorMessage(create.error) : null}
          />
        </div>
        
        <div className="mx-auto max-w-6xl">
          <ProjectsSection />
        </div>
      </main>
    </div>
  );
}
