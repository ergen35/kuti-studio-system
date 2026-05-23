/**
 * DTOs pour le module Exports
 * Migration depuis schemas.py du backend v1
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const ExportKindSchema = z.enum(["work", "publication"]);
export const ExportFormatSchema = z.enum(["json", "tree", "zip"]);
export const ExportStatusSchema = z.enum(["pending", "ready", "failed"]);

export type ExportKind = z.infer<typeof ExportKindSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

// ============================================================================
// Body Schemas
// ============================================================================

export const createExportBodySchema = z.object({
  kind: ExportKindSchema.default("work"),
  format: ExportFormatSchema.default("json"),
  label: z.string().max(255).optional(),
  summary: z.string().max(2000).default(""),
});

export type CreateExportBody = z.infer<typeof createExportBodySchema>;

// ============================================================================
// Params Schemas
// ============================================================================

export const exportIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  exportId: z.string().uuid(),
});

export type ExportIdParams = z.infer<typeof exportIdParamsSchema>;

// ============================================================================
// Query Schemas
// ============================================================================

export const listExportsQuerySchema = z.object({
  kind: ExportKindSchema.optional(),
  status: ExportStatusSchema.optional(),
  format: ExportFormatSchema.optional(),
});

export type ListExportsQuery = z.infer<typeof listExportsQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const exportResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  kind: ExportKindSchema,
  format: ExportFormatSchema,
  status: ExportStatusSchema,
  label: z.string(),
  summary: z.string(),
  artifactPath: z.string().nullable(),
  artifactName: z.string().nullable(),
  metadataJson: z.record(z.unknown()),
  sizeBytes: z.number().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  failedAt: z.iso.datetime().nullable(),
  errorMessage: z.string().nullable(),
});

export type ExportResponse = z.infer<typeof exportResponseSchema>;

export const exportListResponseSchema = z.array(exportResponseSchema);

export type ExportListResponse = z.infer<typeof exportListResponseSchema>;
