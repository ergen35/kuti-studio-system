import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
  dateLabel,
} from "~/components/ui";
import { apiErrorMessage, API_BASE_URL, type Project } from "~/lib/api";
import { useProjects, useCreateProject } from "~/hooks/use-api";
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
  const projects = useProjects();
  
  const projectImagesQueries = useMemo(() => {
    const items = projects.data?.items || [];
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
          const { readProjectCharacterImagesApiProjectsProjectIdCharactersImagesGet } = await import("~/lib/backend");
          const { data: images } = await readProjectCharacterImagesApiProjectsProjectIdCharactersImagesGet({
            path: { project_id: projectId }
          });
          if (images) {
            const imageUrls = Object.values(images).flat().slice(0, 2);
            for (const img of imageUrls) {
              results.push(`${API_BASE_URL}/api/projects/${projectId}/characters/${img.character_id}/images/${img.id}/file`);
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
  const health = useQuery({
    queryKey: keys.health,
    queryFn: async () => {
      const { healthApiHealthGet } = await import("~/lib/backend");
      const { data } = await healthApiHealthGet();
      return data;
    },
    retry: 0
  });
  
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
  
  const projects = useProjects();
  
  const open = useMutation({
    mutationFn: async (projectId: string) => {
      const { openProjectRouteApiProjectsProjectIdOpenPost } = await import("~/lib/backend");
      const { data } = await openProjectRouteApiProjectsProjectIdOpenPost({
        path: { project_id: projectId }
      });
      return data;
    },
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      if (project) {
        navigate(`/projects/${project.id}`);
      }
    },
  });
  
  const archive = useMutation({
    mutationFn: async (projectId: string) => {
      const { archiveProjectRouteApiProjectsProjectIdArchivePost } = await import("~/lib/backend");
      const { data } = await archiveProjectRouteApiProjectsProjectIdArchivePost({
        path: { project_id: projectId }
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });
  
  const clone = useMutation({
    mutationFn: async (projectId: string) => {
      const { cloneProjectRouteApiProjectsProjectIdClonePost } =await import("~/lib/backend");
      const { data } = await cloneProjectRouteApiProjectsProjectIdClonePost({
        path: { project_id: projectId },
        body: {}
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });

  const items: ProjectWithMetrics[] = useMemo(() => {
    const projectItems = projects.data?.items ?? [];
    return projectItems.map(project => ({
      project: project as unknown as Project,
      metrics: generateProjectMetrics(project as unknown as Project),
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
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <SectionTitle
            title={t('home:projects.title')}
            meta={`${items.length} ${items.length === 1 ? 'projet' : 'projets'}`}
          />
          <div className="hidden sm:flex items-center gap-2">
            {activeCount > 0 && (
              <Badge tone="active" className="text-[10px]">
                {activeCount} actif{activeCount > 1 ? 's' : ''}
              </Badge>
            )}
            {draftCount > 0 && (
              <Badge tone="draft" className="text-[10px]">
                {draftCount} brouillon{draftCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Projects grid/list */}
      <div className={viewMode === "grid" 
        ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        : "space-y-2"
      }>
        {items.map(({ project, metrics }) => (
          <ProjectCard
            key={project.id}
            project={project}
            metrics={metrics}
            onOpen={() => open.mutate(project.id)}
            onClone={() => clone.mutate(project.id)}
            onArchive={() => archive.mutate(project.id)}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Route
// =============================================================================

export default function HomeRoute() {
  const navigate = useNavigate();
  const backgroundImages = useBackgroundImages();
  
  const create = useCreateProject({
    mutation: {
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({ queryKey: keys.projects });
        const project = data as Project;
        navigate(`/projects/${project.id}`);
      },
    },
  });
  
  const [projectName, setProjectName] = useState("");

  const handleCreate = () => {
    if (projectName.trim()) {
      create.mutate({
        body: {
          name: projectName.trim(),
          status: "draft",
          settings_json: { locations_json: [] }
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
        {/* Top bar with backend status */}
        <div className="mb-8">
          <BackendStatusSection />
        </div>
        
        {/* Hero section with title and create form */}
        <div className="mb-12 max-w-4xl mx-auto">
          <HeroSection
            projectName={projectName}
            onProjectNameChange={setProjectName}
            onSubmit={handleCreate}
            isLoading={create.isPending}
            error={create.error ? apiErrorMessage(create.error) : null}
          />
        </div>
        
        {/* Projects section */}
        <div className="max-w-6xl mx-auto">
          <ProjectsSection />
        </div>
      </main>
    </div>
  );
}
