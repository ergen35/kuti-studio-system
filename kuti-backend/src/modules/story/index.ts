/**
 * Module Story - Routes Elysia
 */

import { Elysia } from "elysia";
import {
  createTomeBodySchema,
  updateTomeBodySchema,
  tomeResponseSchema,
  createChapterBodySchema,
  updateChapterBodySchema,
  chapterResponseSchema,
  createSceneBodySchema,
  updateSceneBodySchema,
  sceneResponseSchema,
  storySummaryResponseSchema,
  referenceSuggestionSchema,
} from "./dto";
import {
  getStorySummary,
  listTomes,
  getTome,
  createTome,
  updateTome,
  deleteTome,
  listChapters,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  listScenes,
  getScene,
  createScene,
  updateScene,
  deleteScene,
  getReferenceSuggestions,
} from "./controller";

const projectIdParamsSchema = { projectId: "string" };

export const storyModule = new Elysia({
  prefix: "/api/projects/:projectId",
  name: "storyModule",
  detail: { tags: ["Story"] },
})
  // Story Summary
  .get("/story", ({ params: { projectId } }) => getStorySummary(projectId), {
    response: storySummaryResponseSchema,
    detail: { operationId: "getStorySummary", summary: "Get story summary" },
  })

  // Reference suggestions
  .get("/references/:type", async ({ params: { projectId, type }, query: { q } }) => {
    return getReferenceSuggestions(projectId, type, q ?? "");
  }, {
    params: { projectId: "string", type: "string" },
    query: { q: "string" },
    response: [referenceSuggestionSchema],
    detail: { operationId: "getReferenceSuggestions", summary: "Get reference suggestions" },
  })

  // Tomes
  .get("/story/tomes", ({ params: { projectId } }) => listTomes(projectId), {
    response: [tomeResponseSchema],
    detail: { operationId: "listTomes", summary: "List tomes" },
  })
  .post("/story/tomes", ({ params: { projectId }, body }) => createTome(projectId, body), {
    body: createTomeBodySchema,
    response: tomeResponseSchema,
    detail: { operationId: "createTome", summary: "Create a tome" },
  })
  .patch("/story/tomes/:tomeId", async ({ params: { projectId, tomeId }, body }) => {
    const tome = await updateTome(projectId, tomeId, body);
    if (!tome) throw new Error("Tome not found");
    return tome;
  }, {
    params: { projectId: "string", tomeId: "string" },
    body: updateTomeBodySchema,
    response: tomeResponseSchema,
    detail: { operationId: "updateTome", summary: "Update a tome" },
  })
  .delete("/story/tomes/:tomeId", async ({ params: { projectId, tomeId } }) => {
    const deleted = await deleteTome(projectId, tomeId);
    if (!deleted) throw new Error("Tome not found");
    return;
  }, {
    params: { projectId: "string", tomeId: "string" },
    detail: { operationId: "deleteTome", summary: "Delete a tome" },
  })

  // Chapters
  .get("/story/chapters", ({ params: { projectId }, query: { tomeId } }) =>
    listChapters(projectId, tomeId),
  {
    params: { projectId: "string" },
    query: { tomeId: "string" },
    response: [chapterResponseSchema],
    detail: { operationId: "listChapters", summary: "List chapters" },
  })
  .post("/story/chapters", async ({ params: { projectId }, body }) => {
    const chapter = await createChapter(projectId, body);
    if (!chapter) throw new Error("Chapter creation failed");
    return chapter;
  }, {
    body: createChapterBodySchema,
    response: chapterResponseSchema,
    detail: { operationId: "createChapter", summary: "Create a chapter" },
  })
  .patch("/story/chapters/:chapterId", async ({ params: { projectId, chapterId }, body }) => {
    const chapter = await updateChapter(projectId, chapterId, body);
    if (!chapter) throw new Error("Chapter not found");
    return chapter;
  }, {
    params: { projectId: "string", chapterId: "string" },
    body: updateChapterBodySchema,
    response: chapterResponseSchema,
    detail: { operationId: "updateChapter", summary: "Update a chapter" },
  })
  .delete("/story/chapters/:chapterId", async ({ params: { projectId, chapterId } }) => {
    const deleted = await deleteChapter(projectId, chapterId);
    if (!deleted) throw new Error("Chapter not found");
    return;
  }, {
    params: { projectId: "string", chapterId: "string" },
    detail: { operationId: "deleteChapter", summary: "Delete a chapter" },
  })

  // Scenes
  .get("/story/scenes", ({ params: { projectId }, query: { chapterId } }) =>
    listScenes(projectId, chapterId),
  {
    params: { projectId: "string" },
    query: { chapterId: "string" },
    response: [sceneResponseSchema],
    detail: { operationId: "listScenes", summary: "List scenes" },
  })
  .post("/story/scenes", async ({ params: { projectId }, body }) => {
    const scene = await createScene(projectId, body);
    if (!scene) throw new Error("Scene creation failed");
    return scene;
  }, {
    body: createSceneBodySchema,
    response: sceneResponseSchema,
    detail: { operationId: "createScene", summary: "Create a scene" },
  })
  .patch("/story/scenes/:sceneId", async ({ params: { projectId, sceneId }, body }) => {
    const scene = await updateScene(projectId, sceneId, body);
    if (!scene) throw new Error("Scene not found");
    return scene;
  }, {
    params: { projectId: "string", sceneId: "string" },
    body: updateSceneBodySchema,
    response: sceneResponseSchema,
    detail: { operationId: "updateScene", summary: "Update a scene" },
  })
  .delete("/story/scenes/:sceneId", async ({ params: { projectId, sceneId } }) => {
    const deleted = await deleteScene(projectId, sceneId);
    if (!deleted) throw new Error("Scene not found");
    return;
  }, {
    params: { projectId: "string", sceneId: "string" },
    detail: { operationId: "deleteScene", summary: "Delete a scene" },
  });
