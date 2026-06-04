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
  character: (projectId: string, characterId: string | null) =>
    ["character", projectId, characterId] as const,
  story: (projectId: string) => ["story", projectId] as const,
  references: (projectId: string) => ["references", projectId] as const,
  assets: (projectId: string) => ["assets", projectId] as const,
  asset: (projectId: string, assetId: string | null) =>
    ["asset", projectId, assetId] as const,
  warnings: (projectId: string) => ["warnings", projectId] as const,
  versions: (projectId: string) => ["versions", projectId] as const,
  branches: (projectId: string) => ["branches", projectId] as const,
  exports: (projectId: string) => ["exports", projectId] as const,
  generationJobs: (projectId: string) => ["generationJobs", projectId] as const,
  generationBoards: (projectId: string) =>
    ["generationBoards", projectId] as const,
  generationJob: (projectId: string, jobId: string | null) =>
    ["generationJob", projectId, jobId] as const,
  characterImages: (projectId: string, characterId: string) =>
    ["characterImages", projectId, characterId] as const,
  sceneGenerationConfigs: (projectId: string, sceneId: string) =>
    ["sceneGenerationConfigs", projectId, sceneId] as const,
  sceneMangaPages: (projectId: string, sceneId: string) =>
    ["sceneMangaPages", projectId, sceneId] as const,
};

type GeneratedQueryKeyHead = {
  _id?: string;
};

function getGeneratedQueryId(queryKey: unknown): string | null {
  if (!Array.isArray(queryKey)) {
    return null;
  }

  const head = queryKey[0];
  if (!head || typeof head !== "object") {
    return null;
  }

  const id = (head as GeneratedQueryKeyHead)._id;
  return typeof id === "string" ? id : null;
}

export function invalidateQueriesById(
  queryClient: QueryClient,
  ids: string | string[],
) {
  const wantedIds = new Set(Array.isArray(ids) ? ids : [ids]);

  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryId = getGeneratedQueryId(query.queryKey);
      return queryId ? wantedIds.has(queryId) : false;
    },
  });
}

export function invalidateProject(projectId: string) {
  void invalidateQueriesById(queryClient, ["getProject", "listProjects"]);
}

export function invalidateWorkspace(projectId: string) {
  invalidateProject(projectId);
  void invalidateQueriesById(queryClient, [
    "listCharacters",
    "getStorySummary",
    "getReferenceSuggestions",
    "listAssets",
    "listWarnings",
    "listVersions",
    "listBranches",
    "listExports",
    "listGenerationJobs",
    "listGenerationBoards",
    "getProjectCharacterImages",
    "listCharacterImages",
    "listSceneConfigs",
    "listSceneMangaPages",
    "getCharacter",
    "getAsset",
    "getVersion",
    "getGenerationJob",
    "getGenerationBoard",
  ]);
}
