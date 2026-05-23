/**
 * DTOs pour le module Projects
 * Migration depuis schemas.py du backend v1
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const projectStatusSchema = z.enum([
  "draft",
  "active",
  "archived",
  "maintenance",
]);

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

// ============================================================================
// Schemas de base
// ============================================================================

export const projectBaseSchema = z.object({
  name: z.string().min(1).max(255),
  settingsJson: z.record(z.unknown()).default({}),
});

// ============================================================================
// Create
// ============================================================================

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(255),
  status: projectStatusSchema.default("draft"),
  settingsJson: z.record(z.unknown()).optional(),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

// ============================================================================
// Update
// ============================================================================

export const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: projectStatusSchema.optional(),
  settingsJson: z.record(z.unknown()).optional(),
});

export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

// ============================================================================
// Clone
// ============================================================================

export const cloneProjectBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export type CloneProjectBody = z.infer<typeof cloneProjectBodySchema>;

// ============================================================================
// Delete
// ============================================================================

export const deleteProjectBodySchema = z.object({
  confirmedName: z.string().min(1),
});

export type DeleteProjectBody = z.infer<typeof deleteProjectBodySchema>;

export const deleteProjectResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});

export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;

// ============================================================================
// Params
// ============================================================================

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;

// ============================================================================
// Response
// ============================================================================

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: projectStatusSchema,
  rootPath: z.string(),
  settingsJson: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
});

export type ProjectResponse = z.infer<typeof projectResponseSchema>;

export const projectListResponseSchema = z.array(projectResponseSchema);

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>;
