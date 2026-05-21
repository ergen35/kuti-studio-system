/**
 * Module Assets - Routes Elysia
 * Gestion des assets et médias du projet
 */

import { Elysia } from "elysia";
import {
  assetIdParamsSchema,
  linkIdParamsSchema,
  createAssetBodySchema,
  updateAssetBodySchema,
  importAssetBodySchema,
  createAssetLinkBodySchema,
  assetResponseSchema,
  assetDetailResponseSchema,
  assetListResponseSchema,
  assetLinkResponseSchema,
  assetLinkListResponseSchema,
} from "./dto";
import {
  listAssets,
  getAsset,
  createAsset,
  importAsset,
  updateAsset,
  archiveAsset,
  deleteAsset,
  getAssetFile,
  listAssetLinks,
  createAssetLink,
  deleteAssetLink,
} from "./controller";

// ============================================================================
// Module
// ============================================================================

export const assetsModule = new Elysia({
  prefix: "/api/projects/:projectId/assets",
  name: "assetsModule",
  detail: { tags: ["Assets"] },
})
  // List all assets
  .get("/", async ({ params: { projectId } }) => {
    return listAssets(projectId);
  }, {
    response: assetListResponseSchema,
    detail: { operationId: "listAssets", summary: "List all assets" },
  })

  // Import asset from local file
  .post("/import", async ({ params: { projectId }, body }) => {
    const asset = await importAsset(projectId, body);
    return asset;
  }, {
    body: importAssetBodySchema,
    response: assetResponseSchema,
    detail: { operationId: "importAsset", summary: "Import an asset from local filesystem" },
  })

  // Get asset detail
  .get("/:assetId", async ({ params: { projectId, assetId } }) => {
    const asset = await getAsset(projectId, assetId);
    if (!asset) throw new Error("Asset not found");
    return asset;
  }, {
    params: assetIdParamsSchema,
    response: assetDetailResponseSchema,
    detail: { operationId: "getAsset", summary: "Get asset details" },
  })

  // Update asset
  .patch("/:assetId", async ({ params: { projectId, assetId }, body }) => {
    const asset = await updateAsset(projectId, assetId, body);
    if (!asset) throw new Error("Asset not found");
    return asset;
  }, {
    params: assetIdParamsSchema,
    body: updateAssetBodySchema,
    response: assetResponseSchema,
    detail: { operationId: "updateAsset", summary: "Update an asset" },
  })

  // Archive asset
  .post("/:assetId/archive", async ({ params: { projectId, assetId } }) => {
    const asset = await archiveAsset(projectId, assetId);
    if (!asset) throw new Error("Asset not found");
    return asset;
  }, {
    params: assetIdParamsSchema,
    response: assetResponseSchema,
    detail: { operationId: "archiveAsset", summary: "Archive an asset" },
  })

  // Delete asset
  .delete("/:assetId", async ({ params: { projectId, assetId } }) => {
    const deleted = await deleteAsset(projectId, assetId);
    if (!deleted) throw new Error("Asset not found");
    return;
  }, {
    params: assetIdParamsSchema,
    detail: { operationId: "deleteAsset", summary: "Delete an asset" },
  })

  // Get asset file
  .get("/:assetId/file", async ({ params: { projectId, assetId } }) => {
    const file = await getAssetFile(projectId, assetId);
    if (!file) throw new Error("Asset file not found");
    return new Response(file.buffer, {
      headers: { 
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName}"`,
      },
    });
  }, {
    params: assetIdParamsSchema,
    detail: { operationId: "getAssetFile", summary: "Get asset file content" },
  })

  // Create asset link
  .post("/:assetId/links", async ({ params: { projectId, assetId }, body }) => {
    const link = await createAssetLink(projectId, assetId, body);
    return link;
  }, {
    params: assetIdParamsSchema,
    body: createAssetLinkBodySchema,
    response: assetLinkResponseSchema,
    detail: { operationId: "createAssetLink", summary: "Create an asset link" },
  })

  // Delete asset link
  .delete("/:assetId/links/:linkId", async ({ params: { projectId, assetId, linkId } }) => {
    const deleted = await deleteAssetLink(projectId, assetId, linkId);
    if (!deleted) throw new Error("Link not found");
    return;
  }, {
    params: linkIdParamsSchema,
    detail: { operationId: "deleteAssetLink", summary: "Delete an asset link" },
  });

// ============================================================================
// Routes pour upload de fichiers (multipart/form-data)
// ============================================================================

export const assetsUploadModule = new Elysia({
  prefix: "/api/projects/:projectId/assets",
  name: "assetsUploadModule",
  detail: { tags: ["Assets"] },
})
  // Upload asset (multipart)
  .post("/upload", async ({ params: { projectId }, body }) => {
    // Note: Pour Elysia, il faudrait utiliser un plugin pour parser multipart
    // Cette route est préparée pour être étendue avec le bon parsing
    throw new Error("Multipart upload not yet implemented - use /import instead");
  }, {
    detail: { operationId: "uploadAsset", summary: "Upload an asset file" },
  });
