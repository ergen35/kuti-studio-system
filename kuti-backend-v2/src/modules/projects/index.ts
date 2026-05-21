/**
 * Module Projects - Routes Elysia
 * Migration depuis api.py du backend v1
 */

import { Elysia } from "elysia";
import {
  projectIdParamsSchema,
  createProjectBodySchema,
  updateProjectBodySchema,
  cloneProjectBodySchema,
  projectResponseSchema,
  projectListResponseSchema,
} from "./dto";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  archiveProject,
  openProject,
  cloneProject,
  exportProject,
} from "./controller";

// ============================================================================
// Module
// ============================================================================

export const projectsModule = new Elysia({
  prefix: "/api/projects",
  name: "projectsModule",
  detail: { tags: ["Projects"] },
})
  // GET /api/projects - Liste tous les projets
  .get(
    "/",
    () => listProjects(),
    {
      response: projectListResponseSchema,
      detail: {
        operationId: "listProjects",
        summary: "List all projects",
      },
    }
  )

  // POST /api/projects - Créer un projet
  .post(
    "/",
    ({ body }) => createProject(body),
    {
      body: createProjectBodySchema,
      response: projectResponseSchema,
      detail: {
        operationId: "createProject",
        summary: "Create a new project",
      },
    }
  )

  // GET /api/projects/:projectId - Détail d'un projet
  .get(
    "/:projectId",
    async ({ params: { projectId } }) => {
      const project = await getProject(projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    },
    {
      params: projectIdParamsSchema,
      response: projectResponseSchema,
      detail: {
        operationId: "getProject",
        summary: "Get a project by ID",
      },
    }
  )

  // PATCH /api/projects/:projectId - Modifier un projet
  .patch(
    "/:projectId",
    async ({ params: { projectId }, body }) => {
      const project = await updateProject(projectId, body);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    },
    {
      params: projectIdParamsSchema,
      body: updateProjectBodySchema,
      response: projectResponseSchema,
      detail: {
        operationId: "updateProject",
        summary: "Update a project",
      },
    }
  )

  // POST /api/projects/:projectId/open - Ouvrir un projet
  .post(
    "/:projectId/open",
    async ({ params: { projectId } }) => {
      const project = await openProject(projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    },
    {
      params: projectIdParamsSchema,
      response: projectResponseSchema,
      detail: {
        operationId: "openProject",
        summary: "Mark project as opened",
      },
    }
  )

  // POST /api/projects/:projectId/archive - Archiver un projet
  .post(
    "/:projectId/archive",
    async ({ params: { projectId } }) => {
      const project = await archiveProject(projectId);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    },
    {
      params: projectIdParamsSchema,
      response: projectResponseSchema,
      detail: {
        operationId: "archiveProject",
        summary: "Archive a project",
      },
    }
  )

  // POST /api/projects/:projectId/clone - Cloner un projet
  .post(
    "/:projectId/clone",
    async ({ params: { projectId }, body }) => {
      const project = await cloneProject(projectId, body);
      if (!project) {
        throw new Error("Project not found");
      }
      return project;
    },
    {
      params: projectIdParamsSchema,
      body: cloneProjectBodySchema,
      response: projectResponseSchema,
      detail: {
        operationId: "cloneProject",
        summary: "Clone a project",
      },
    }
  )

  // GET /api/projects/:projectId/export - Exporter un projet
  .get(
    "/:projectId/export",
    async ({ params: { projectId } }) => {
      const data = await exportProject(projectId);
      if (!data) {
        throw new Error("Project not found");
      }
      return data;
    },
    {
      params: projectIdParamsSchema,
      detail: {
        operationId: "exportProject",
        summary: "Export project data",
      },
    }
  );
