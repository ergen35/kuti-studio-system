import { z } from "zod";

export const projectIdParamsSchema = z.object({ projectId: z.string().uuid() });

export const dramaVideoStatusSchema = z.enum(["draft", "queued", "running", "ready", "failed", "archived"]);

export const dramaVideoResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceMangaPageId: z.string().nullable(),
  jobId: z.string().nullable(),
  title: z.string(),
  prompt: z.string(),
  modelKey: z.string(),
  stylePreset: z.string(),
  status: dramaVideoStatusSchema,
  videoUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  source: z.object({
    sceneId: z.string(),
    sceneTitle: z.string(),
    tomeId: z.string(),
    tomeTitle: z.string(),
    chapterId: z.string(),
    chapterTitle: z.string(),
    pageNumber: z.number(),
    pageLabel: z.string(),
    pageImageUrl: z.string().nullable(),
  }).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const dramaVideoListResponseSchema = z.array(dramaVideoResponseSchema);
