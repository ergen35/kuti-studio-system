/**
 * DTOs pour le module Assets
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const AssetStatusSchema = z.enum(["active", "archived"]);

// ============================================================================
// Params Schemas
// ============================================================================

export const assetIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export const linkIdParamsSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  linkId: z.string().uuid(),
});

// ============================================================================
// Body Schemas
// ============================================================================

export const createAssetBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

export const updateAssetBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

export const importAssetBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  sourcePath: z.string().min(1), // Chemin source du fichier à importer
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

export const createAssetLinkBodySchema = z.object({
  targetKind: z.enum(["character", "scene", "chapter", "tome"]),
  targetId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const assetResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  slug: z.string(),
  name: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  checksum: z.string(),
  sizeBytes: z.number(),
  storagePath: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  status: AssetStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

export const assetListResponseSchema = z.array(assetResponseSchema);

export const assetLinkResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  assetId: z.string(),
  targetKind: z.string(),
  targetId: z.string(),
  note: z.string(),
  createdAt: z.string(),
});

export const assetLinkListResponseSchema = z.array(assetLinkResponseSchema);

export const assetDetailResponseSchema = assetResponseSchema.extend({
  links: assetLinkListResponseSchema,
  usages: z.array(
    z.object({
      kind: z.string(),
      id: z.string(),
      name: z.string(),
    })
  ),
});

// ============================================================================
// Types
// ============================================================================

export type CreateAssetBody = z.infer<typeof createAssetBodySchema>;
export type UpdateAssetBody = z.infer<typeof updateAssetBodySchema>;
export type ImportAssetBody = z.infer<typeof importAssetBodySchema>;
export type CreateAssetLinkBody = z.infer<typeof createAssetLinkBodySchema>;
export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type AssetLinkResponse = z.infer<typeof assetLinkResponseSchema>;
export type AssetDetailResponse = z.infer<typeof assetDetailResponseSchema>;
