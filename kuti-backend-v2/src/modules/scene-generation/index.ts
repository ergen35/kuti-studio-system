/**
 * Module Scene Generation - Routes Elysia
 * Configuration de génération de scènes et pages manga
 */

import { Elysia } from "elysia";
import {
  sceneIdParamsSchema,
  configIdParamsSchema,
  pageIdParamsSchema,
  createSceneConfigBodySchema,
  updateSceneConfigBodySchema,
  setDefaultConfigBodySchema,
  generateSceneMangaBodySchema,
  previewPromptBodySchema,
  updateMangaPageBodySchema,
  sceneConfigResponseSchema,
  sceneConfigListResponseSchema,
  mangaPageResponseSchema,
  mangaPageListResponseSchema,
  generateSceneMangaResponseSchema,
  previewPromptResponseSchema,
} from "./dto";
import {
  listSceneConfigs,
  createSceneConfig,
  updateSceneConfig,
  deleteSceneConfig,
  setDefaultConfig,
  generateSceneManga,
  previewPrompt,
  listSceneMangaPages,
  updateSceneMangaPage,
  deleteSceneMangaPage,
} from "./controller";

// ============================================================================
// Module
// ============================================================================

export const sceneGenerationModule = new Elysia({
  prefix: "/api/projects/:projectId/story/scenes/:sceneId",
  name: "sceneGenerationModule",
  detail: { tags: ["Scene Generation"] },
})
  // List generation configs for scene
  .get("/generation-configs", ({ params: { projectId, sceneId } }) => {
    return listSceneConfigs(projectId, sceneId);
  }, {
    params: sceneIdParamsSchema,
    response: sceneConfigListResponseSchema,
    detail: { operationId: "listSceneConfigs", summary: "List scene generation configs" },
  })

  // Create generation config
  .post("/generation-configs", ({ params: { projectId, sceneId }, body }) => {
    return createSceneConfig(projectId, sceneId, body);
  }, {
    params: sceneIdParamsSchema,
    body: createSceneConfigBodySchema,
    response: sceneConfigResponseSchema,
    detail: { operationId: "createSceneConfig", summary: "Create a generation config" },
  })

  // Update generation config
  .patch("/generation-configs/:configId", async ({ params: { projectId, sceneId, configId }, body }) => {
    const config = await updateSceneConfig(projectId, sceneId, configId, body);
    if (!config) throw new Error("Config not found");
    return config;
  }, {
    params: configIdParamsSchema,
    body: updateSceneConfigBodySchema,
    response: sceneConfigResponseSchema,
    detail: { operationId: "updateSceneConfig", summary: "Update a generation config" },
  })

  // Delete generation config
  .delete("/generation-configs/:configId", async ({ params: { projectId, sceneId, configId } }) => {
    const deleted = await deleteSceneConfig(projectId, sceneId, configId);
    if (!deleted) throw new Error("Config not found");
    return;
  }, {
    params: configIdParamsSchema,
    detail: { operationId: "deleteSceneConfig", summary: "Delete a generation config" },
  })

  // Set default config
  .post("/generation-configs/:configId/set-default", async ({ params: { projectId, sceneId, configId }, body }) => {
    const config = await setDefaultConfig(projectId, sceneId, configId, body.isDefault);
    if (!config) throw new Error("Config not found");
    return config;
  }, {
    params: configIdParamsSchema,
    body: setDefaultConfigBodySchema,
    response: sceneConfigResponseSchema,
    detail: { operationId: "setDefaultConfig", summary: "Set config as default" },
  })

  // Generate scene manga
  .post("/generate", ({ params: { projectId, sceneId }, body }) => {
    return generateSceneManga(projectId, sceneId, body);
  }, {
    params: sceneIdParamsSchema,
    body: generateSceneMangaBodySchema,
    response: generateSceneMangaResponseSchema,
    detail: { operationId: "generateSceneManga", summary: "Generate manga for scene" },
  })

  // Preview prompt
  .post("/preview-prompt", ({ params: { projectId, sceneId }, body }) => {
    return previewPrompt(projectId, sceneId, body);
  }, {
    params: sceneIdParamsSchema,
    body: previewPromptBodySchema,
    response: previewPromptResponseSchema,
    detail: { operationId: "previewPrompt", summary: "Preview generation prompts" },
  })

  // List manga pages
  .get("/manga-pages", ({ params: { projectId, sceneId } }) => {
    return listSceneMangaPages(projectId, sceneId);
  }, {
    params: sceneIdParamsSchema,
    response: mangaPageListResponseSchema,
    detail: { operationId: "listSceneMangaPages", summary: "List scene manga pages" },
  })

  // Update manga page
  .patch("/manga-pages/:pageId", async ({ params: { projectId, sceneId, pageId }, body }) => {
    const page = await updateSceneMangaPage(projectId, sceneId, pageId, body);
    if (!page) throw new Error("Page not found");
    return page;
  }, {
    params: pageIdParamsSchema,
    body: updateMangaPageBodySchema,
    response: mangaPageResponseSchema,
    detail: { operationId: "updateSceneMangaPage", summary: "Update a manga page" },
  })

  // Delete manga page
  .delete("/manga-pages/:pageId", async ({ params: { projectId, sceneId, pageId } }) => {
    const deleted = await deleteSceneMangaPage(projectId, sceneId, pageId);
    if (!deleted) throw new Error("Page not found");
    return;
  }, {
    params: pageIdParamsSchema,
    detail: { operationId: "deleteSceneMangaPage", summary: "Delete a manga page" },
  });
