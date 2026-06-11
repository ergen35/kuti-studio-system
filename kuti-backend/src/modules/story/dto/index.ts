import { z } from "zod";

export const storyStatusSchema = z.enum(["active", "draft", "archived"]);
export type StoryStatus = z.infer<typeof storyStatusSchema>;

export const sceneMetadataSchema = z.object({
  narrativeIntent: z.string().optional(),
  duration: z.string().optional(),
  tone: z.string().optional(),
  rhythm: z.string().optional(),
  visualConstraints: z.string().optional(),
  stagingNotes: z.string().optional(),
});

// Tome
export const tomeResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  slug: z.string(),
  synopsis: z.string(),
  status: storyStatusSchema,
  orderIndex: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createTomeBodySchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

export const updateTomeBodySchema = z.object({
  title: z.string().min(1).optional(),
  synopsis: z.string().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

// Chapter
export const chapterResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tomeId: z.string(),
  title: z.string(),
  slug: z.string(),
  synopsis: z.string(),
  status: storyStatusSchema,
  orderIndex: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createChapterBodySchema = z.object({
  tomeId: z.string(),
  title: z.string().min(1),
  synopsis: z.string().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

export const updateChapterBodySchema = z.object({
  tomeId: z.string().optional(),
  title: z.string().min(1).optional(),
  synopsis: z.string().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

export const chapterAutoGenerateBodySchema = z.object({
  chapterSummary: z.string().trim().min(1000),
  sceneCount: z.number().int().min(1).max(8),
});

export const chapterAutoGenerateResponseSchema = z.object({
  jobId: z.string(),
});

// Scene
export const sceneResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  tomeId: z.string(),
  chapterId: z.string(),
  title: z.string(),
  slug: z.string(),
  sceneType: z.string(),
  location: z.string(),
  summary: z.string(),
  content: z.string(),
  notes: z.string(),
  charactersJson: z.array(z.string()),
  tagsJson: z.array(z.string()),
  metadataJson: sceneMetadataSchema,
  targetPageCount: z.number().nullable(),
  status: storyStatusSchema,
  orderIndex: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createSceneBodySchema = z.object({
  tomeId: z.string(),
  chapterId: z.string(),
  title: z.string().min(1),
  sceneType: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  charactersJson: z.array(z.string()).optional(),
  tagsJson: z.array(z.string()).optional(),
  metadataJson: sceneMetadataSchema.optional(),
  targetPageCount: z.number().int().min(1).max(10).nullable().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

export const updateSceneBodySchema = z.object({
  tomeId: z.string().optional(),
  chapterId: z.string().optional(),
  title: z.string().min(1).optional(),
  sceneType: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
  charactersJson: z.array(z.string()).optional(),
  tagsJson: z.array(z.string()).optional(),
  metadataJson: sceneMetadataSchema.optional(),
  targetPageCount: z.number().int().min(1).max(10).nullable().optional(),
  status: storyStatusSchema.optional(),
  orderIndex: z.number().optional(),
});

// Story Reference
export const storyReferenceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sceneId: z.string(),
  referenceKind: z.string(),
  targetSlug: z.string(),
  rawToken: z.string(),
  createdAt: z.iso.datetime(),
});

export const storySummaryResponseSchema = z.object({
  tomes: z.array(tomeResponseSchema),
  chapters: z.array(chapterResponseSchema),
  scenes: z.array(sceneResponseSchema),
  references: z.array(storyReferenceSchema),
  orphanReferences: z.array(z.object({
    reference: storyReferenceSchema,
    reason: z.string(),
  })),
});

export const referenceSuggestionSchema = z.object({
  kind: z.enum(["character", "scene", "chapter", "tome", "asset", "environment"]),
  slug: z.string(),
  label: z.string(),
  entityId: z.string(),
  href: z.string(),
  description: z.string().optional(),
});

export type ReferenceSuggestion = z.infer<typeof referenceSuggestionSchema>;

// Story completion
export const storyCompletionTargetKindSchema = z.enum(["tome", "chapter", "scene"]);
export const storyCompletionFieldSchema = z.enum(["title", "sceneType", "location", "synopsis", "summary", "content", "notes", "charactersJson", "tagsJson"]);

export const storyCompletionModelSchema = z.object({
  key: z.string(),
  displayName: z.string(),
  enabled: z.boolean(),
  configured: z.boolean(),
});

export const completeStoryFieldBodySchema = z.object({
  targetKind: storyCompletionTargetKindSchema,
  targetId: z.string(),
  field: storyCompletionFieldSchema,
  currentValue: z.string().optional(),
  instruction: z.string().optional(),
  modelKey: z.string().optional(),
});

export const completeStoryFieldResponseSchema = z.object({
  targetKind: storyCompletionTargetKindSchema,
  targetId: z.string(),
  field: storyCompletionFieldSchema,
  modelKey: z.string(),
  text: z.string(),
});

// Alias pour compatibilité
export const StorySummaryResponse = storySummaryResponseSchema;

// Chapter manga pages preview
export const chapterMangaPageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sceneId: z.string(),
  sceneTitle: z.string(),
  sceneOrderIndex: z.number(),
  tomeId: z.string(),
  chapterId: z.string(),
  jobId: z.string(),
  boardId: z.string(),
  panelId: z.string(),
  pageNumber: z.number(),
  label: z.string(),
  status: z.string(),
  imageUrl: z.string().nullable(),
  caption: z.string().nullable(),
  prompt: z.string().nullable(),
  metadataJson: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const chapterMangaPagesResponseSchema = z.array(chapterMangaPageResponseSchema);

export type ChapterMangaPageResponse = z.infer<typeof chapterMangaPageResponseSchema>;

// List types
export type TomeResponse = z.infer<typeof tomeResponseSchema>;
export type ChapterResponse = z.infer<typeof chapterResponseSchema>;
export type SceneResponse = z.infer<typeof sceneResponseSchema>;
export type CreateTomeBody = z.infer<typeof createTomeBodySchema>;
export type UpdateTomeBody = z.infer<typeof updateTomeBodySchema>;
export type CreateChapterBody = z.infer<typeof createChapterBodySchema>;
export type UpdateChapterBody = z.infer<typeof updateChapterBodySchema>;
export type ChapterAutoGenerateBody = z.infer<typeof chapterAutoGenerateBodySchema>;
export type ChapterAutoGenerateResponse = z.infer<typeof chapterAutoGenerateResponseSchema>;
export type CreateSceneBody = z.infer<typeof createSceneBodySchema>;
export type UpdateSceneBody = z.infer<typeof updateSceneBodySchema>;
export type CompleteStoryFieldBody = z.infer<typeof completeStoryFieldBodySchema>;
