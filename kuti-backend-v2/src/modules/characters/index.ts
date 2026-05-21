/**
 * Module Characters - Routes Elysia
 */

import { Elysia } from "elysia";
import {
  characterIdParamsSchema,
  relationIdParamsSchema,
  imageIdParamsSchema,
  createCharacterBodySchema,
  updateCharacterBodySchema,
  createRelationBodySchema,
  characterResponseSchema,
  characterDetailResponseSchema,
  characterListResponseSchema,
  characterRelationResponseSchema,
  voiceSampleResponseSchema,
  characterImageResponseSchema,
  characterImageListResponseSchema,
  projectCharacterImagesResponseSchema,
  generateCharacterImageQuerySchema,
} from "./dto";
import {
  listCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  archiveCharacter,
  deleteCharacter,
  createRelation,
  listRelations,
  createVoiceSample,
  listCharacterImages,
  getAllProjectCharacterImages,
  deleteCharacterImage,
  getCharacterImageFile,
  generateCharacterImage,
} from "./controller";

export const charactersModule = new Elysia({
  prefix: "/api/projects/:projectId/characters",
  name: "charactersModule",
  detail: { tags: ["Characters"] },
})
  // List all characters
  .get("/", ({ params: { projectId } }) => listCharacters(projectId), {
    response: characterListResponseSchema,
    detail: { operationId: "listCharacters", summary: "List all characters" },
  })

  // Create character
  .post("/", ({ params: { projectId }, body }) => createCharacter(projectId, body), {
    params: characterIdParamsSchema.pick({ projectId: true }),
    body: createCharacterBodySchema,
    response: characterResponseSchema,
    detail: { operationId: "createCharacter", summary: "Create a character" },
  })

  // Get all project character images (grouped by character)
  .get("/images", ({ params: { projectId } }) => getAllProjectCharacterImages(projectId), {
    response: projectCharacterImagesResponseSchema,
    detail: { operationId: "getProjectCharacterImages", summary: "Get all character images for project" },
  })

  // Get character detail
  .get("/:characterId", async ({ params: { projectId, characterId } }) => {
    const char = await getCharacter(projectId, characterId);
    if (!char) throw new Error("Character not found");
    return char;
  }, {
    params: characterIdParamsSchema,
    response: characterDetailResponseSchema,
    detail: { operationId: "getCharacter", summary: "Get character details" },
  })

  // Update character
  .patch("/:characterId", async ({ params: { projectId, characterId }, body }) => {
    const char = await updateCharacter(projectId, characterId, body);
    if (!char) throw new Error("Character not found");
    return char;
  }, {
    params: characterIdParamsSchema,
    body: updateCharacterBodySchema,
    response: characterResponseSchema,
    detail: { operationId: "updateCharacter", summary: "Update a character" },
  })

  // Archive character
  .post("/:characterId/archive", async ({ params: { projectId, characterId } }) => {
    const char = await archiveCharacter(projectId, characterId);
    if (!char) throw new Error("Character not found");
    return char;
  }, {
    params: characterIdParamsSchema,
    response: characterResponseSchema,
    detail: { operationId: "archiveCharacter", summary: "Archive a character" },
  })

  // Delete character
  .delete("/:characterId", async ({ params: { projectId, characterId } }) => {
    const deleted = await deleteCharacter(projectId, characterId);
    if (!deleted) throw new Error("Character not found");
    return;
  }, {
    params: characterIdParamsSchema,
    detail: { operationId: "deleteCharacter", summary: "Delete a character" },
  })

  // Create relation
  .post("/:characterId/relations", async ({ params: { projectId, characterId }, body }) => {
    const relation = await createRelation(projectId, characterId, body);
    return relation;
  }, {
    params: characterIdParamsSchema,
    body: createRelationBodySchema,
    response: characterRelationResponseSchema,
    detail: { operationId: "createRelation", summary: "Create a character relation" },
  })

  // Create voice sample
  .post("/:characterId/voice-samples", async ({ params: { projectId, characterId }, body }) => {
    const sample = await createVoiceSample(projectId, characterId, body);
    if (!sample) throw new Error("Character not found");
    return sample;
  }, {
    params: characterIdParamsSchema,
    body: createRelationBodySchema,
    response: voiceSampleResponseSchema,
    detail: { operationId: "createVoiceSample", summary: "Create a voice sample" },
  })

  // Generate character images
  .post("/:characterId/generate-image", async ({ params: { projectId, characterId }, query }) => {
    const result = await generateCharacterImage(projectId, characterId, query);
    if (!result) throw new Error("Character not found");
    return result;
  }, {
    params: characterIdParamsSchema,
    query: generateCharacterImageQuerySchema,
    detail: { operationId: "generateCharacterImage", summary: "Generate character images" },
  })

  // List character images
  .get("/:characterId/images", ({ params: { projectId, characterId } }) => {
    return listCharacterImages(projectId, characterId);
  }, {
    params: characterIdParamsSchema,
    response: characterImageListResponseSchema,
    detail: { operationId: "listCharacterImages", summary: "List character images" },
  })

  // Delete character image
  .delete("/:characterId/images/:imageId", async ({ params: { projectId, characterId, imageId } }) => {
    const deleted = await deleteCharacterImage(projectId, characterId, imageId);
    if (!deleted) throw new Error("Image not found");
    return;
  }, {
    params: imageIdParamsSchema,
    detail: { operationId: "deleteCharacterImage", summary: "Delete a character image" },
  })

  // Get character image file
  .get("/:characterId/images/:imageId/file", async ({ params: { projectId, characterId, imageId } }) => {
    const file = await getCharacterImageFile(projectId, characterId, imageId);
    if (!file) throw new Error("Image not found");
    return new Response(file.buffer, {
      headers: { "Content-Type": file.mimeType },
    });
  }, {
    params: imageIdParamsSchema,
    detail: { operationId: "getCharacterImageFile", summary: "Get character image file" },
  });
