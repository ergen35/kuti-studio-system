/**
 * Module Exports - Routes Elysia
 * Migration depuis api.py du backend v1
 */

import { Elysia } from "elysia";
import {
  exportIdParamsSchema,
  createExportBodySchema,
  listExportsQuerySchema,
  exportResponseSchema,
  exportListResponseSchema,
} from "./dto";
import {
  listExports,
  getExport,
  createExport,
  getExportDownload,
} from "./controller";

function responseBody(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

// ============================================================================
// Module
// ============================================================================

export const exportsModule = new Elysia({
  prefix: "/api/projects/:projectId/exports",
  name: "exportsModule",
  detail: { tags: ["Exports"] },
})
  // GET /api/projects/:projectId/exports - Liste tous les exports
  .get("/", async ({ params: { projectId }, query }) => {
    return listExports(projectId, query);
  }, {
    query: listExportsQuerySchema,
    response: exportListResponseSchema,
    detail: { operationId: "listExports", summary: "List all exports" },
  })

  // POST /api/projects/:projectId/exports - Créer un export
  .post("/", async ({ params: { projectId }, body }) => {
    const exportRecord = await createExport(projectId, body);
    if (!exportRecord) throw new Error("Project not found");
    return exportRecord;
  }, {
    body: createExportBodySchema,
    response: exportResponseSchema,
    detail: { operationId: "createExport", summary: "Create an export" },
  })

  // GET /api/projects/:projectId/exports/:exportId - Détail d'un export
  .get("/:exportId", async ({ params: { projectId, exportId } }) => {
    const exportRecord = await getExport(projectId, exportId);
    if (!exportRecord) throw new Error("Export not found");
    return exportRecord;
  }, {
    params: exportIdParamsSchema,
    response: exportResponseSchema,
    detail: { operationId: "getExport", summary: "Get export details" },
  })

  // GET /api/projects/:projectId/exports/:exportId/download - Télécharger l'export
  .get("/:exportId/download", async ({ params: { projectId, exportId } }) => {
    const result = await getExportDownload(projectId, exportId);
    if (!result) throw new Error("Export artifact not found");
    return new Response(responseBody(result.buffer), {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  }, {
    params: exportIdParamsSchema,
    detail: { operationId: "downloadExport", summary: "Download export artifact" },
  });
