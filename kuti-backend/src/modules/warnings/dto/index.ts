/**
 * DTOs pour le module Warnings
 * Migration depuis schemas.py du backend v1
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const WarningSeveritySchema = z.enum(["info", "warning", "critical"]);
export const WarningStatusSchema = z.enum(["open", "ignored", "resolved"]);

export type WarningSeverity = z.infer<typeof WarningSeveritySchema>;
export type WarningStatus = z.infer<typeof WarningStatusSchema>;

// ============================================================================
// Body Schemas
// ============================================================================

export const updateWarningBodySchema = z.object({
  status: WarningStatusSchema,
  note: z.string().max(500).optional(),
});

export type UpdateWarningBody = z.infer<typeof updateWarningBodySchema>;

// ============================================================================
// Query Schemas
// ============================================================================

export const listWarningsQuerySchema = z.object({
  status: WarningStatusSchema.optional(),
  kind: z.string().optional(),
  severity: WarningSeveritySchema.optional(),
});

export type ListWarningsQuery = z.infer<typeof listWarningsQuerySchema>;

// ============================================================================
// Params Schemas
// ============================================================================

export const warningIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  warningId: z.string().uuid(),
});

export type WarningIdParams = z.infer<typeof warningIdParamsSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const warningResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  fingerprint: z.string(),
  kind: z.string(),
  severity: WarningSeveritySchema,
  status: WarningStatusSchema,
  title: z.string(),
  message: z.string(),
  entityKind: z.string(),
  entityId: z.string(),
  metadataJson: z.record(z.unknown()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});

export type WarningResponse = z.infer<typeof warningResponseSchema>;

export const warningListResponseSchema = z.array(warningResponseSchema);

export type WarningListResponse = z.infer<typeof warningListResponseSchema>;

export const warningScanResponseSchema = z.object({
  items: warningListResponseSchema,
});

export type WarningScanResponse = z.infer<typeof warningScanResponseSchema>;
