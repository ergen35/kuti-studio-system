/**
 * DTOs pour le module Versions
 * Migration depuis schemas.py du backend v1
 */

import { z } from "zod";

// ============================================================================
// Body Schemas
// ============================================================================

export const createVersionBodySchema = z.object({
  branchName: z.string().max(255).default("main"),
  label: z.string().max(255).default("Checkpoint"),
  summary: z.string().default(""),
});

export type CreateVersionBody = z.infer<typeof createVersionBodySchema>;

export const restoreVersionBodySchema = z.object({
  label: z.string().max(255).optional(),
  summary: z.string().optional(),
});

export type RestoreVersionBody = z.infer<typeof restoreVersionBodySchema>;

export const compareVersionsBodySchema = z.object({
  leftVersionId: z.string().uuid(),
  rightVersionId: z.string().uuid(),
});

export type CompareVersionsBody = z.infer<typeof compareVersionsBodySchema>;

// ============================================================================
// Params Schemas
// ============================================================================

export const versionIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export type VersionIdParams = z.infer<typeof versionIdParamsSchema>;

// ============================================================================
// Response Schemas
// ============================================================================

export const versionResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  branchName: z.string(),
  versionIndex: z.number(),
  label: z.string(),
  summary: z.string(),
  createdAt: z.iso.datetime(),
});

export type VersionResponse = z.infer<typeof versionResponseSchema>;

export const versionBranchSchema = z.object({
  branchName: z.string(),
  versionCount: z.number(),
  latestVersionId: z.string().nullable(),
  latestCreatedAt: z.iso.datetime().nullable(),
});

export type VersionBranch = z.infer<typeof versionBranchSchema>;

export const versionCompareResponseSchema = z.object({
  left: versionResponseSchema,
  right: versionResponseSchema,
  projectChanges: z.array(z.string()),
  countsDelta: z.record(z.string(), z.number()),
});

export type VersionCompareResponse = z.infer<typeof versionCompareResponseSchema>;
