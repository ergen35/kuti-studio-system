import { Elysia } from "elysia";
import {
  validateBoardBodySchema,
  generationJobResponseSchema,
  generationBoardResponseSchema,
  createGenerationJobBodySchema,
  updatePanelBodySchema,
  cancelJobResponseSchema,
} from "./dto";
import { z } from "zod";
import {
  listGenerationJobs,
  getGenerationJob,
  createGenerationJob,
  cancelGenerationJob,
  relaunchGenerationJob,
  listGenerationBoards,
  getGenerationBoard,
  validateGenerationBoard,
  updateGenerationPanel,
  getGenerationPanelImage,
  getBoardArtifact,
} from "./controller";

function responseBody(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

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
    params: z.object({ projectId: z.string() }),
    body: createGenerationJobBodySchema,
    response: generationJobResponseSchema,
    detail: { operationId: "createGenerationJob", summary: "Create a generation job" },
  })
  .get("/jobs/:jobId", async ({ params: { projectId, jobId } }) => {
    const job = await getGenerationJob(projectId, jobId);
    if (!job) throw new Error("Job not found");
    return job;
  }, {
    params: z.object({ projectId: z.string(), jobId: z.string() }),
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
    params: z.object({ projectId: z.string(), boardId: z.string() }),
    response: generationBoardResponseSchema,
    detail: { operationId: "getGenerationBoard", summary: "Get a generation board" },
  })
  .post("/boards/:boardId/validate", async ({ params: { projectId, boardId }, body }) => {
    const board = await validateGenerationBoard(projectId, boardId, body?.note);
    if (!board) throw new Error("Board not found");
    return board;
  }, {
    params: z.object({ projectId: z.string(), boardId: z.string() }),
    body: validateBoardBodySchema,
    response: generationBoardResponseSchema,
    detail: { operationId: "validateGenerationBoard", summary: "Validate a board" },
  })

  // Panels
  .patch("/boards/:boardId/panels/:panelId", async ({ params: { projectId, boardId, panelId }, body }) => {
    const panel = await updateGenerationPanel(projectId, boardId, panelId, body);
    if (!panel) throw new Error("Panel not found");
    return panel;
  }, {
    params: z.object({ projectId: z.string(), boardId: z.string(), panelId: z.string() }),
    body: updatePanelBodySchema,
    detail: { operationId: "updateGenerationPanel", summary: "Update a panel" },
  })
  .get("/boards/:boardId/panels/:panelId/image", async ({ params: { projectId, boardId, panelId } }) => {
    const file = await getGenerationPanelImage(projectId, boardId, panelId);
    if (!file) throw new Error("Panel image not found");
    return new Response(responseBody(file.buffer), {
      headers: { "Content-Type": file.mimeType },
    });
  }, {
    params: z.object({ projectId: z.string(), boardId: z.string(), panelId: z.string() }),
    detail: { operationId: "getGenerationPanelImage", summary: "Get panel image" },
  })

  // Board download
  .get("/boards/:boardId/download", async ({ params: { projectId, boardId } }) => {
    const artifact = await getBoardArtifact(projectId, boardId);
    if (!artifact) throw new Error("Board artifact not found");
    return new Response(responseBody(artifact.buffer), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
      },
    });
  }, {
    params: z.object({ projectId: z.string(), boardId: z.string() }),
    detail: { operationId: "downloadBoardArtifact", summary: "Download board artifact" },
  })

  // Cancel job
  .post("/jobs/:jobId/cancel", async ({ params: { projectId, jobId } }) => {
    const result = await cancelGenerationJob(projectId, jobId);
    return result;
  }, {
    params: z.object({ projectId: z.string(), jobId: z.string() }),
    response: cancelJobResponseSchema,
    detail: {
      operationId: "cancelGenerationJob",
      summary: "Cancel a running generation job",
      tags: ["Generation"],
    },
  })

  // Relaunch job
  .post("/jobs/:jobId/relaunch", async ({ params: { projectId, jobId } }) => {
    const result = await relaunchGenerationJob(projectId, jobId);
    return result;
  }, {
    params: z.object({ projectId: z.string(), jobId: z.string() }),
    response: generationJobResponseSchema,
    detail: {
      operationId: "relaunchGenerationJob",
      summary: "Relaunch a completed or failed generation job",
      tags: ["Generation"],
    },
  });
