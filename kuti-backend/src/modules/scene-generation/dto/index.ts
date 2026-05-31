/**
 * DTOs pour le module Scene Generation
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const StylePresetSchema = z.enum(["shonen", "shojo", "seinen", "generic"]);
export const ColorModeSchema = z.enum(["bw", "color", "spot_color"]);
export const MangaPageStatusSchema = z.enum(["draft", "selected", "rejected"]);
export const DramaVideoStatusSchema = z.enum(["draft", "queued", "running", "ready", "failed", "archived"]);

// ============================================================================
// Params Schemas
// ============================================================================

export const sceneIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
});

export const configIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
  configId: z.string().uuid(),
});

export const pageIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
  pageId: z.string().uuid(),
});

export const dramaVideoIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
  dramaVideoId: z.string().uuid(),
});

// ============================================================================
// Body Schemas
// ============================================================================

export const createSceneConfigBodySchema = z.object({
  name: z.string().min(1).max(255),
  systemPrompt: z.string().min(1),
  stylePreset: StylePresetSchema.default("generic"),
  colorMode: ColorModeSchema.default("bw"),
  defaultImageCount: z.number().int().min(1).max(16).default(4),
  allowMultiPage: z.boolean().default(false),
});

export const updateSceneConfigBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  systemPrompt: z.string().min(1).optional(),
  stylePreset: StylePresetSchema.optional(),
  colorMode: ColorModeSchema.optional(),
  defaultImageCount: z.number().int().min(1).max(16).optional(),
  allowMultiPage: z.boolean().optional(),
});

export const setDefaultConfigBodySchema = z.object({
  isDefault: z.boolean().default(true),
});

export const generateSceneMangaBodySchema = z.object({
  configId: z.string().uuid().optional(),
  modelKey: z.string().optional(),
  imageCount: z.number().int().min(1).max(16).default(6),
  characterImageRefs: z.record(z.string(), z.string()).optional(),
  additionalContext: z.string().max(2000).optional(),
});

export const previewPromptBodySchema = z.object({
  configId: z.string().uuid().optional(),
  characterImageRefs: z.record(z.string(), z.string()).optional(),
  panelCount: z.number().int().min(1).max(16).default(6),
});

export const updateMangaPageBodySchema = z.object({
  label: z.string().max(255).optional(),
  status: MangaPageStatusSchema.optional(),
  imageUrl: z.string().optional(),
  caption: z.string().max(2000).optional(),
  prompt: z.string().max(4000).optional(),
});

export const generateDramaVideoBodySchema = z.object({
  modelKey: z.string().optional(),
  prompt: z.string().max(4000).optional(),
  title: z.string().max(255).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const sceneConfigResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  isDefault: z.boolean(),
  systemPrompt: z.string(),
  stylePreset: StylePresetSchema,
  colorMode: ColorModeSchema,
  defaultImageCount: z.number(),
  allowMultiPage: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const sceneConfigListResponseSchema = z.array(sceneConfigResponseSchema);

export const mangaPageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sceneId: z.string(),
  tomeId: z.string(),
  chapterId: z.string(),
  jobId: z.string(),
  boardId: z.string(),
  panelId: z.string(),
  pageNumber: z.number(),
  label: z.string(),
  status: MangaPageStatusSchema,
  imageUrl: z.string().nullable(),
  caption: z.string().nullable(),
  prompt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mangaPageListResponseSchema = z.array(mangaPageResponseSchema);

export const dramaVideoResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceMangaPageId: z.string().nullable(),
  jobId: z.string().nullable(),
  title: z.string(),
  prompt: z.string(),
  modelKey: z.string(),
  stylePreset: z.string(),
  status: DramaVideoStatusSchema,
  videoUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const dramaVideoListResponseSchema = z.array(dramaVideoResponseSchema);

export const generateDramaVideoResponseSchema = z.object({
  success: z.boolean(),
  dramaVideoId: z.string(),
  jobId: z.string(),
  message: z.string(),
});

export const generateSceneMangaResponseSchema = z.object({
  success: z.boolean(),
  jobId: z.string(),
  boardId: z.string().optional(),
  message: z.string(),
});

export const previewPromptResponseSchema = z.object({
  prompts: z.array(z.object({
    panelIndex: z.number(),
    title: z.string(),
    prompt: z.string(),
    caption: z.string(),
  })),
  systemPrompt: z.string(),
  styleDescription: z.string(),
});

export type CreateSceneConfigBody = z.infer<typeof createSceneConfigBodySchema>;
export type UpdateSceneConfigBody = z.infer<typeof updateSceneConfigBodySchema>;
export type GenerateSceneMangaBody = z.infer<typeof generateSceneMangaBodySchema>;
export type PreviewPromptBody = z.infer<typeof previewPromptBodySchema>;
export type UpdateMangaPageBody = z.infer<typeof updateMangaPageBodySchema>;
export type GenerateDramaVideoBody = z.infer<typeof generateDramaVideoBodySchema>;
