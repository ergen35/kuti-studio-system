import { z } from "zod";

export const storyStatusSchema = z.enum(["active", "draft", "archived"]);
export type StoryStatus = z.infer<typeof storyStatusSchema>;

// Tome
export const tomeResponseSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  slug: z.string(),
  synopsis: z.string(),
  status: storyStatusSchema,
  order_index: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
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
  project_id: z.string(),
  tome_id: z.string(),
  title: z.string(),
  slug: z.string(),
  synopsis: z.string(),
  status: storyStatusSchema,
  order_index: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
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
  project_id: z.string(),
  tome_id: z.string(),
  chapter_id: z.string(),
  title: z.string(),
  slug: z.string(),
  scene_type: z.string(),
  location: z.string(),
  summary: z.string(),
  content: z.string(),
  notes: z.string(),
  characters_json: z.array(z.string()),
  tags_json: z.array(z.string()),
  status: storyStatusSchema,
  order_index: z.number(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
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

// Story Summary
export const storyReferenceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  scene_id: z.string(),
  reference_kind: z.string(),
  target_slug: z.string(),
  raw_token: z.string(),
  created_at: z.string().datetime(),
});

export const storySummaryResponseSchema = z.object({
  tomes: z.array(tomeResponseSchema),
  chapters: z.array(chapterResponseSchema),
  scenes: z.array(sceneResponseSchema),
  orphan_references: z.array(z.object({
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
