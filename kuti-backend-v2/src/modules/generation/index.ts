import { Elysia } from "elysia";
import {
  generationJobResponseSchema,
  generationBoardResponseSchema,
  createGenerationJobBodySchema,
  updatePanelBodySchema,
} from "./dto";
import {
  listGenerationJobs,
  getGenerationJob,
  createGenerationJob,
  listGenerationBoards,
  getGenerationBoard,
  validateGenerationBoard,
  updateGenerationPanel,
  getGenerationPanelImage,
  getBoardArtifact,
} from "./controller";

export const generationModule = new Elysia({
  prefix: "/api/projects/:projectId/generation",
  name: "generationModule",
  detail: { tags: ["Generation"] },
})
  // Jobs
  .get("/jobs", ({ params: { projectId } }) => listGenerationJobs(projectId), {
    response: [generationJobResponseSchema],
    detail: { operationId: "listGenerationJobs", summary: "List generation jobs" },
  })
  .post("/jobs", ({ params: { projectId }, body }) => createGenerationJob(projectId, body), {
    params: { projectId: "string" },
    body: createGenerationJobBodySchema,
    response: generationJobResponseSchema,
    detail: { operationId: "createGenerationJob", summary: "Create a generation job" },
  })
  .get("/jobs/:jobId", async ({ params: { projectId, jobId } }) => {
    const job = await getGenerationJob(projectId, jobId);
    if (!job) throw new Error("Job not found");
    return job;
  }, {
    params: { projectId: "string", jobId: "string" },
    response: generationJobResponseSchema,
    detail: { operationId: "getGenerationJob", summary: "Get a generation job" },
  })

  // Boards
  .get("/boards", ({ params: { projectId } }) => listGenerationBoards(projectId), {
    response: [generationBoardResponseSchema],
    detail: { operationId: "listGenerationBoards", summary: "List generation boards" },
  })
  .get("/boards/:boardId", async ({ params: { projectId, boardId } }) => {
    const board = await getGenerationBoard(projectId, boardId);
    if (!board) throw new Error("Board not found");
    return board;
  }, {
    params: { projectId: "string", boardId: "string" },
    response: generationBoardResponseSchema,
    detail: { operationId: "getGenerationBoard", summary: "Get a generation board" },
  })
  .post("/boards/:boardId/validate", async ({ params: { projectId, boardId }, body }) => {
    const board = await validateGenerationBoard(projectId, boardId, body?.note);
    if (!board) throw new Error("Board not found");
    return board;
  }, {
    params: { projectId: "string", boardId: "string" },
    body: "optional",
    response: generationBoardResponseSchema,
    detail: { operationId: "validateGenerationBoard", summary: "Validate a board" },
  })

  // Panels
  .patch("/boards/:boardId/panels/:panelId", async ({ params: { projectId, boardId, panelId }, body }) => {
    const panel = await updateGenerationPanel(projectId, boardId, panelId, body);
    if (!panel) throw new Error("Panel not found");
    return panel;
  }, {
    params: { projectId: "string", boardId: "string", panelId: "string" },
    body: updatePanelBodySchema,
    detail: { operationId: "updateGenerationPanel", summary: "Update a panel" },
  })
  .get("/boards/:boardId/panels/:panelId/image", async ({ params: { projectId, boardId, panelId } }) => {
    const file = await getGenerationPanelImage(projectId, boardId, panelId);
    if (!file) throw new Error("Panel image not found");
    return new Response(file.buffer, {
      headers: { "Content-Type": file.mimeType },
    });
  }, {
    params: { projectId: "string", boardId: "string", panelId: "string" },
    detail: { operationId: "getGenerationPanelImage", summary: "Get panel image" },
  })

  // Board download
  .get("/boards/:boardId/download", async ({ params: { projectId, boardId } }) => {
    const artifact = await getBoardArtifact(projectId, boardId);
    if (!artifact) throw new Error("Board artifact not found");
    return new Response(artifact.buffer, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      },
    });
  }, {
    params: { projectId: "string", boardId: "string" },
    detail: { operationId: "downloadBoardArtifact", summary: "Download board artifact" },
  });
