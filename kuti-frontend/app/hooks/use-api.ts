/**
 * Hooks API personnalisés
 * Wrappers autour des hooks TanStack Query générés par @hey-api/openapi-ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import {
  // Queries - Projects
  readProjectsApiProjectsGetOptions,
  readProjectApiProjectsProjectIdGetOptions,
  // Queries - Story
  readStoryApiProjectsProjectIdStoryGetOptions,
  readTomesApiProjectsProjectIdStoryTomesGetOptions,
  readChaptersApiProjectsProjectIdStoryChaptersGetOptions,
  readScenesApiProjectsProjectIdStoryScenesGetOptions,
  // Queries - Characters
  readCharactersApiProjectsProjectIdCharactersGetOptions,
  readCharacterApiProjectsProjectIdCharactersCharacterIdGetOptions,
  listCharacterImagesApiProjectsProjectIdCharactersCharacterIdImagesGetOptions,
  // Queries - Assets
  readAssetsApiProjectsProjectIdAssetsGetOptions,
  // Queries - Warnings
  readWarningsApiProjectsProjectIdWarningsGetOptions,
  // Queries - Versions
  readVersionsApiProjectsProjectIdVersionsGetOptions,
  readVersionBranchesApiProjectsProjectIdVersionsBranchesGetOptions,
  // Queries - Exports
  readExportsApiProjectsProjectIdExportsGetOptions,
  // Queries - Generation
  readGenerationJobsApiProjectsProjectIdGenerationJobsGetOptions,
  readGenerationBoardsApiProjectsProjectIdGenerationBoardsGetOptions,
  modelsApiModelsGetOptions,
  // Mutations - Projects
  createProjectRouteApiProjectsPostMutation,
  patchProjectApiProjectsProjectIdPatchMutation,
  // Mutations - Story
  createTomeRouteApiProjectsProjectIdStoryTomesPostMutation,
  createChapterRouteApiProjectsProjectIdStoryChaptersPostMutation,
  createSceneRouteApiProjectsProjectIdStoryScenesPostMutation,
  // Mutations - Characters
  createCharacterRouteApiProjectsProjectIdCharactersPostMutation,
  updateCharacterRouteApiProjectsProjectIdCharactersCharacterIdPatchMutation,
  archiveCharacterRouteApiProjectsProjectIdCharactersCharacterIdArchivePostMutation,
  deleteCharacterRouteApiProjectsProjectIdCharactersCharacterIdDeleteMutation,
  createRelationRouteApiProjectsProjectIdCharactersCharacterIdRelationsPostMutation,
  generateCharacterImageRouteApiProjectsProjectIdCharactersCharacterIdGenerateImagePostMutation,
  // Mutations - Assets
  importAssetRouteApiProjectsProjectIdAssetsImportPostMutation,
  archiveAssetRouteApiProjectsProjectIdAssetsAssetIdArchivePostMutation,
  deleteAssetRouteApiProjectsProjectIdAssetsAssetIdDeleteMutation,
  // Mutations - Warnings
  scanWarningsApiProjectsProjectIdWarningsScanPostMutation,
  patchWarningApiProjectsProjectIdWarningsWarningIdPatchMutation,
  // Mutations - Versions
  createVersionRouteApiProjectsProjectIdVersionsPostMutation,
  restoreVersionRouteApiProjectsProjectIdVersionsVersionIdRestorePostMutation,
  // Mutations - Exports
  createExportRouteApiProjectsProjectIdExportsPostMutation,
  // Mutations - Generation
  createGenerationJobRouteApiProjectsProjectIdGenerationJobsPostMutation,
  validateGenerationBoardRouteApiProjectsProjectIdGenerationBoardsBoardIdValidatePostMutation,
} from "~/lib/backend/@tanstack/react-query.gen";

// ============================================================================
// Projects
// ============================================================================

export function useProjects() {
  return useQuery(readProjectsApiProjectsGetOptions());
}

export function useProject(projectId: string) {
  return useQuery({
    ...readProjectApiProjectsProjectIdGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useCreateProject({
  mutation: mutationOptions = {},
}: { mutation?: Partial<Parameters<typeof createProjectRouteApiProjectsPostMutation>[0] & { onSuccess?: (data: unknown, variables: unknown) => void }> } = {}) {
  const queryClient = useQueryClient();
  const { onSuccess, ...restMutationOptions } = mutationOptions;
  
  return useMutation({
    ...createProjectRouteApiProjectsPostMutation(restMutationOptions),
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ["readProjectsApiProjectsGet"] });
      onSuccess?.(data, variables);
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    ...patchProjectApiProjectsProjectIdPatchMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      queryClient.invalidateQueries({ queryKey: ["readProjectsApiProjectsGet"] });
      if (projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ["readProjectApiProjectsProjectIdGet"],
        });
      }
    },
  });
}

// ============================================================================
// Story
// ============================================================================

export function useStory(projectId: string) {
  return useQuery({
    ...readStoryApiProjectsProjectIdStoryGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useTomes(projectId: string) {
  return useQuery({
    ...readTomesApiProjectsProjectIdStoryTomesGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useChapters(projectId: string, tomeId?: string) {
  return useQuery({
    ...readChaptersApiProjectsProjectIdStoryChaptersGetOptions({
      path: { project_id: projectId },
      query: tomeId ? { tome_id: tomeId } : undefined,
    }),
    enabled: !!projectId,
  });
}

export function useScenes(projectId: string, chapterId?: string) {
  return useQuery({
    ...readScenesApiProjectsProjectIdStoryScenesGetOptions({
      path: { project_id: projectId },
      query: chapterId ? { chapter_id: chapterId } : undefined,
    }),
    enabled: !!projectId,
  });
}

export function useCreateTome({
  mutation: mutationOptions = {},
}: { mutation?: { onSuccess?: () => void } } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...createTomeRouteApiProjectsProjectIdStoryTomesPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readStoryApiProjectsProjectIdStoryGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readTomesApiProjectsProjectIdStoryTomesGet"],
        });
      }
      mutationOptions.onSuccess?.();
    },
  });
}

export function useCreateChapter({
  mutation: mutationOptions = {},
}: { mutation?: { onSuccess?: () => void } } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...createChapterRouteApiProjectsProjectIdStoryChaptersPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readStoryApiProjectsProjectIdStoryGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readChaptersApiProjectsProjectIdStoryChaptersGet"],
        });
      }
      mutationOptions.onSuccess?.();
    },
  });
}

export function useCreateScene({
  mutation: mutationOptions = {},
}: { mutation?: { onSuccess?: () => void } } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...createSceneRouteApiProjectsProjectIdStoryScenesPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readStoryApiProjectsProjectIdStoryGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readScenesApiProjectsProjectIdStoryScenesGet"],
        });
      }
      mutationOptions.onSuccess?.();
    },
  });
}

// ============================================================================
// Characters
// ============================================================================

export function useCharacters(projectId: string) {
  return useQuery({
    ...readCharactersApiProjectsProjectIdCharactersGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useCharacter(projectId: string, characterId: string) {
  return useQuery({
    ...readCharacterApiProjectsProjectIdCharactersCharacterIdGetOptions({
      path: { project_id: projectId, character_id: characterId },
    }),
    enabled: !!projectId && !!characterId,
  });
}

export function useCharacterImages(projectId: string, characterId: string) {
  return useQuery({
    ...listCharacterImagesApiProjectsProjectIdCharactersCharacterIdImagesGetOptions({
      path: { project_id: projectId, character_id: characterId },
    }),
    enabled: !!projectId && !!characterId,
  });
}

export function useCreateCharacter({
  mutation: mutationOptions = {},
}: { mutation?: { onSuccess?: (data: unknown) => void } } = {}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    ...createCharacterRouteApiProjectsProjectIdCharactersPostMutation(),
    onSuccess: (data, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readCharactersApiProjectsProjectIdCharactersGet"],
        });
      }
      mutationOptions.onSuccess?.(data);
    },
  });
  return mutation;
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateCharacterRouteApiProjectsProjectIdCharactersCharacterIdPatchMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      const characterId = variables.path?.character_id;
      if (projectId && characterId) {
        queryClient.invalidateQueries({
          queryKey: ["readCharacterApiProjectsProjectIdCharactersCharacterIdGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readCharactersApiProjectsProjectIdCharactersGet"],
        });
      }
    },
  });
}

export function useArchiveCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    ...archiveCharacterRouteApiProjectsProjectIdCharactersCharacterIdArchivePostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readCharactersApiProjectsProjectIdCharactersGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readCharacterApiProjectsProjectIdCharactersCharacterIdGet"],
        });
      }
    },
  });
}

export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteCharacterRouteApiProjectsProjectIdCharactersCharacterIdDeleteMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readCharactersApiProjectsProjectIdCharactersGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readCharacterApiProjectsProjectIdCharactersCharacterIdGet"],
        });
      }
    },
  });
}

export function useCreateRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createRelationRouteApiProjectsProjectIdCharactersCharacterIdRelationsPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      const characterId = variables.path?.character_id;
      if (projectId && characterId) {
        queryClient.invalidateQueries({
          queryKey: ["readCharacterApiProjectsProjectIdCharactersCharacterIdGet"],
        });
      }
    },
  });
}

export function useGenerateCharacterImage() {
  const queryClient = useQueryClient();
  return useMutation({
    ...generateCharacterImageRouteApiProjectsProjectIdCharactersCharacterIdGenerateImagePostMutation(),
    onSuccess: () => {
      // Invalidation générale car pas d'accès direct aux variables
      queryClient.invalidateQueries({
        queryKey: ["readCharacterApiProjectsProjectIdCharactersCharacterIdGet"],
      });
    },
  });
}

// ============================================================================
// Warnings
// ============================================================================

export function useWarnings(projectId: string) {
  return useQuery({
    ...readWarningsApiProjectsProjectIdWarningsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

// ============================================================================
// Versions
// ============================================================================

export function useVersions(projectId: string) {
  return useQuery({
    ...readVersionsApiProjectsProjectIdVersionsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

// ============================================================================
// Exports
// ============================================================================

export function useExports(projectId: string) {
  return useQuery({
    ...readExportsApiProjectsProjectIdExportsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

// ============================================================================
// Generation Jobs
// ============================================================================

export function useGenerationJobs(projectId: string) {
  return useQuery({
    ...readGenerationJobsApiProjectsProjectIdGenerationJobsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useGenerationBoards(projectId: string) {
  return useQuery({
    ...readGenerationBoardsApiProjectsProjectIdGenerationBoardsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useModels() {
  return useQuery({
    ...modelsApiModelsGetOptions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateGenerationJob() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createGenerationJobRouteApiProjectsProjectIdGenerationJobsPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readGenerationJobsApiProjectsProjectIdGenerationJobsGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readGenerationBoardsApiProjectsProjectIdGenerationBoardsGet"],
        });
      }
    },
  });
}

export function useValidateBoard() {
  return useMutation(validateGenerationBoardRouteApiProjectsProjectIdGenerationBoardsBoardIdValidatePostMutation());
}

// ============================================================================
// Assets
// ============================================================================

export function useAssets(projectId: string) {
  return useQuery({
    ...readAssetsApiProjectsProjectIdAssetsGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useImportAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    ...importAssetRouteApiProjectsProjectIdAssetsImportPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readAssetsApiProjectsProjectIdAssetsGet"],
        });
      }
    },
  });
}

export function useArchiveAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    ...archiveAssetRouteApiProjectsProjectIdAssetsAssetIdArchivePostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readAssetsApiProjectsProjectIdAssetsGet"],
        });
      }
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteAssetRouteApiProjectsProjectIdAssetsAssetIdDeleteMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readAssetsApiProjectsProjectIdAssetsGet"],
        });
      }
    },
  });
}

// ============================================================================
// Warnings Mutations
// ============================================================================

export function useScanWarnings() {
  return useMutation(scanWarningsApiProjectsProjectIdWarningsScanPostMutation());
}

export function useUpdateWarning() {
  return useMutation(patchWarningApiProjectsProjectIdWarningsWarningIdPatchMutation());
}

// ============================================================================
// Versions
// ============================================================================

export function useBranches(projectId: string) {
  return useQuery({
    ...readVersionBranchesApiProjectsProjectIdVersionsBranchesGetOptions({
      path: { project_id: projectId },
    }),
    enabled: !!projectId,
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createVersionRouteApiProjectsProjectIdVersionsPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readVersionsApiProjectsProjectIdVersionsGet"],
        });
        queryClient.invalidateQueries({
          queryKey: ["readVersionBranchesApiProjectsProjectIdVersionsBranchesGet"],
        });
      }
    },
  });
}

export function useRestoreVersion() {
  return useMutation(restoreVersionRouteApiProjectsProjectIdVersionsVersionIdRestorePostMutation());
}

// ============================================================================
// Exports
// ============================================================================

export function useCreateExport() {
  const queryClient = useQueryClient();
  return useMutation({
    ...createExportRouteApiProjectsProjectIdExportsPostMutation(),
    onSuccess: (_, variables) => {
      const projectId = variables.path?.project_id;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ["readExportsApiProjectsProjectIdExportsGet"],
        });
      }
    },
  });
}
