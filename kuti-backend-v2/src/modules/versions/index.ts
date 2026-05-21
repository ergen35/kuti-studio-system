/**
 * Module Versions - Routes Elysia
 * Migration depuis api.py du backend v1
 */

import { Elysia } from "elysia";
import {
  versionIdParamsSchema,
  createVersionBodySchema,
  restoreVersionBodySchema,
  compareVersionsBodySchema,
  versionResponseSchema,
  versionBranchSchema,
  versionCompareResponseSchema,
} from "./dto";
import {
  listVersions,
  listBranches,
  createVersion,
  getVersion,
  compareVersions,
  restoreVersion,
} from "./controller";

// ============================================================================
// Module
// ============================================================================

export const versionsModule = new Elysia({
  prefix: "/api/projects/:projectId/versions",
  name: "versionsModule",
  detail: { tags: ["Versions"] },
})
  // GET /api/projects/:projectId/versions - Liste toutes les versions
  .get("/", ({ params: { projectId } }) => listVersions(projectId), {
    response: [versionResponseSchema],
    detail: { operationId: "listVersions", summary: "List all versions" },
  })

  // GET /api/projects/:projectId/versions/branches - Liste les branches
  .get("/branches", ({ params: { projectId } }) => listBranches(projectId), {
    response: [versionBranchSchema],
    detail: { operationId: "listBranches", summary: "List version branches" },
  })

  // POST /api/projects/:projectId/versions - Créer une version
  .post("/", async ({ params: { projectId }, body }) => {
    const version = await createVersion(projectId, body);
    if (!version) throw new Error("Project not found");
    return version;
  }, {
    body: createVersionBodySchema,
    response: versionResponseSchema,
    detail: { operationId: "createVersion", summary: "Create a version" },
  })

  // GET /api/projects/:projectId/versions/:versionId - Détail d'une version
  .get("/:versionId", async ({ params: { projectId, versionId } }) => {
    const version = await getVersion(projectId, versionId);
    if (!version) throw new Error("Version not found");
    return version;
  }, {
    params: versionIdParamsSchema,
    response: versionResponseSchema,
    detail: { operationId: "getVersion", summary: "Get version details" },
  })

  // POST /api/projects/:projectId/versions/compare - Comparer deux versions
  .post("/compare", async ({ params: { projectId }, body }) => {
    const result = await compareVersions(projectId, body.leftVersionId, body.rightVersionId);
    if (!result) throw new Error("One or both versions not found");
    return result;
  }, {
    body: compareVersionsBodySchema,
    response: versionCompareResponseSchema,
    detail: { operationId: "compareVersions", summary: "Compare two versions" },
  })

  // POST /api/projects/:projectId/versions/:versionId/restore - Restaurer une version
  .post("/:versionId/restore", async ({ params: { projectId, versionId }, body }) => {
    const version = await restoreVersion(projectId, versionId, body || {});
    if (!version) throw new Error("Version not found");
    return version;
  }, {
    params: versionIdParamsSchema,
    body: restoreVersionBodySchema,
    response: versionResponseSchema,
    detail: { operationId: "restoreVersion", summary: "Restore a version" },
  });
