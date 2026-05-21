/**
 * Module Warnings - Routes Elysia
 * Migration depuis api.py du backend v1
 */

import { Elysia } from "elysia";
import {
  warningIdParamsSchema,
  updateWarningBodySchema,
  listWarningsQuerySchema,
  warningResponseSchema,
  warningListResponseSchema,
  warningScanResponseSchema,
} from "./dto";
import {
  listWarnings,
  getWarning,
  updateWarning,
  scanWarnings,
} from "./controller";

// ============================================================================
// Module
// ============================================================================

export const warningsModule = new Elysia({
  prefix: "/api/projects/:projectId/warnings",
  name: "warningsModule",
  detail: { tags: ["Warnings"] },
})
  // GET /api/projects/:projectId/warnings - Liste tous les warnings
  .get("/", async ({ params: { projectId }, query }) => {
    return listWarnings(projectId, query);
  }, {
    query: listWarningsQuerySchema,
    response: warningListResponseSchema,
    detail: { operationId: "listWarnings", summary: "List all warnings" },
  })

  // POST /api/projects/:projectId/warnings/scan - Scanner les warnings
  .post("/scan", ({ params: { projectId } }) => scanWarnings(projectId), {
    response: warningScanResponseSchema,
    detail: { operationId: "scanWarnings", summary: "Scan and rebuild warnings" },
  })

  // PATCH /api/projects/:projectId/warnings/:warningId - Mettre à jour un warning
  .patch("/:warningId", async ({ params: { projectId, warningId }, body }) => {
    const warning = await updateWarning(projectId, warningId, body);
    if (!warning) throw new Error("Warning not found");
    return warning;
  }, {
    params: warningIdParamsSchema,
    body: updateWarningBodySchema,
    response: warningResponseSchema,
    detail: { operationId: "updateWarning", summary: "Update warning status" },
  });
