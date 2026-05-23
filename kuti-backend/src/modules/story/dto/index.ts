import { z } from "zod";

export const storyStatusSchema = z.enum(["active", "draft", "archived"]);
export type StoryStatus = z.infer<typeof storyStatusSchema>;

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
  orphanReferences: z.array(z.object({
    reference: storyReferenceSchema,
    reason: z.string(),
  })),
});

export const referenceSuggestionSchema = z.object({
  slug: z.string(),
  label: z.string(),
});

// Alias pour compatibilité
export const StorySummaryResponse = storySummaryResponseSchema;

// List types
export type TomeResponse = z.infer<typeof tomeResponseSchema>;
export type ChapterResponse = z.infer<typeof chapterResponseSchema>;
export type SceneResponse = z.infer<typeof sceneResponseSchema>;
export type CreateTomeBody = z.infer<typeof createTomeBodySchema>;
export type UpdateTomeBody = z.infer<typeof updateTomeBodySchema>;
export type CreateChapterBody = z.infer<typeof createChapterBodySchema>;
export type UpdateChapterBody = z.infer<typeof updateChapterBodySchema>;
export type CreateSceneBody = z.infer<typeof createSceneBodySchema>;
export type UpdateSceneBody = z.infer<typeof updateSceneBodySchema>;
