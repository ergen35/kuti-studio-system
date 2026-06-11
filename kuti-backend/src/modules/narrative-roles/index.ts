/**
 * Module Narrative Roles - Routes Elysia
 */

import { Elysia } from "elysia";
import { z } from "zod";
import {
  createNarrativeRole,
  listNarrativeRoles,
} from "./controller";
import {
  createNarrativeRoleBodySchema,
  narrativeRoleListResponseSchema,
  narrativeRoleResponseSchema,
} from "./dto";

const projectIdParamsSchema = z.object({ projectId: z.string() });

export const narrativeRolesModule = new Elysia({
  prefix: "/api/projects/:projectId/narrative-roles",
  name: "narrativeRolesModule",
  detail: { tags: ["Narrative Roles"] },
})
  .get(
    "/",
    ({ params: { projectId } }) => listNarrativeRoles(projectId),
    {
      params: projectIdParamsSchema,
      response: narrativeRoleListResponseSchema,
      detail: {
        operationId: "listNarrativeRoles",
        summary: "List narrative roles for a project",
      },
    },
  )
  .post(
    "/",
    async ({ params: { projectId }, body }) => createNarrativeRole(projectId, body),
    {
      params: projectIdParamsSchema,
      body: createNarrativeRoleBodySchema,
      response: narrativeRoleResponseSchema,
      detail: {
        operationId: "createNarrativeRole",
        summary: "Create a narrative role for a project",
      },
    },
  );
