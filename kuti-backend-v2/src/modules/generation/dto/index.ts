import { z } from "zod";

export const generationSourceKindSchema = z.enum(["scene", "chapter", "tome", "panel", "custom"]);
export const generationStrategySchema = z.enum(["direct", "intermediate"]);
export const generationJobStatusSchema = z.enum(["pending", "running", "ready", "validated", "failed"]);
export const generationBoardStatusSchema = z.enum(["draft", "validated"]);
export const generationPanelStatusSchema = z.enum(["draft", "selected", "rejected", "replaced"]);

export const generationJobResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceKind: generationSourceKindSchema,
  sourceId: z.string(),
  sourceLabel: z.string(),
  sourceVersionId: z.string().nullable(),
  strategy: generationStrategySchema,
  entrypoint: z.string(),
  title: z.string(),
  prompt: z.string(),
  summary: z.string(),
  status: generationJobStatusSchema,
  progress: z.number(),
  metadataJson: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});

export const generationJobStepResponseSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  orderIndex: z.number(),
  title: z.string(),
  status: z.enum(["pending", "running", "ready", "failed"]),
  prompt: z.string(),
  outputText: z.string(),
  artifactPath: z.string().nullable(),
  artifactName: z.string().nullable(),
  metadataJson: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  errorMessage: z.string().nullable(),
});

export const generationPanelResponseSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  stepId: z.string().nullable(),
  orderIndex: z.number(),
  title: z.string(),
  caption: z.string(),
  prompt: z.string(),
  status: generationPanelStatusSchema,
  imagePath: z.string(),
  imageName: z.string(),
  metadataJson: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const generationBoardResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  jobId: z.string(),
  sourceKind: generationSourceKindSchema,
  strategy: generationStrategySchema,
  title: z.string(),
  summary: z.string(),
  status: generationBoardStatusSchema,
  artifactPath: z.string().nullable(),
  artifactName: z.string().nullable(),
  metadataJson: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  validatedAt: z.string().datetime().nullable(),
  panels: z.array(generationPanelResponseSchema),
});

export const createGenerationJobBodySchema = z.object({
  sourceKind: generationSourceKindSchema,
  sourceId: z.string(),
  sourceVersionId: z.string().optional(),
  strategy: generationStrategySchema.default("direct"),
  modelKey: z.string().optional(),
  mode: z.string().optional(),
  selectionIds: z.array(z.string()).optional(),
  gridRows: z.number().optional(),
  gridCols: z.number().optional(),
  imageCount: z.number().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

export const updatePanelBodySchema = z.object({
  status: generationPanelStatusSchema.optional(),
  caption: z.string().optional(),
  title: z.string().optional(),
});

export type GenerationJobResponse = z.infer<typeof generationJobResponseSchema>;
export type GenerationBoardResponse = z.infer<typeof generationBoardResponseSchema>;
export type CreateGenerationJobBody = z.infer<typeof createGenerationJobBodySchema>;
