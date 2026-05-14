import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const keys = {
  health: ["health"] as const,
  models: ["models"] as const,
  projects: ["projects"] as const,
  project: (projectId: string) => ["project", projectId] as const,
  characters: (projectId: string) => ["characters", projectId] as const,
  character: (projectId: string, characterId: string | null) => ["character", projectId, characterId] as const,
  story: (projectId: string) => ["story", projectId] as const,
  references: (projectId: string) => ["references", projectId] as const,
  assets: (projectId: string) => ["assets", projectId] as const,
  asset: (projectId: string, assetId: string | null) => ["asset", projectId, assetId] as const,
  warnings: (projectId: string) => ["warnings", projectId] as const,
  versions: (projectId: string) => ["versions", projectId] as const,
  branches: (projectId: string) => ["branches", projectId] as const,
  exports: (projectId: string) => ["exports", projectId] as const,
  generationJobs: (projectId: string) => ["generationJobs", projectId] as const,
  generationBoards: (projectId: string) => ["generationBoards", projectId] as const,
};

export function invalidateProject(projectId: string) {
  void queryClient.invalidateQueries({ queryKey: keys.project(projectId) });
  void queryClient.invalidateQueries({ queryKey: keys.projects });
}

export function invalidateWorkspace(projectId: string) {
  invalidateProject(projectId);
  for (const key of [
    keys.characters(projectId),
    keys.story(projectId),
    keys.references(projectId),
    keys.assets(projectId),
    keys.warnings(projectId),
    keys.versions(projectId),
    keys.branches(projectId),
    keys.exports(projectId),
    keys.generationJobs(projectId),
    keys.generationBoards(projectId),
  ]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}
