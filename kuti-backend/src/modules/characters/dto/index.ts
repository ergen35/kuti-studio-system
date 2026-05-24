/**
 * DTOs pour le module Characters
 */

import { z } from "zod";

export const characterStatusSchema = z.enum(["active", "draft", "archived"]);
export type CharacterStatus = z.infer<typeof characterStatusSchema>;

// Character
export const characterResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  slug: z.string(),
  name: z.string(),
  alias: z.string().nullable(),
  narrativeRole: z.string().nullable(),
  description: z.string(),
  physicalDescription: z.string(),
  colorPaletteJson: z.array(z.string()),
  costumeElementsJson: z.array(z.string()),
  keyTraitsJson: z.array(z.string()),
  personality: z.string(),
  narrativeArc: z.string(),
  tagsJson: z.array(z.string()),
  status: characterStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});

export type CharacterResponse = z.infer<typeof characterResponseSchema>;

// Create
export const createCharacterBodySchema = z.object({
  name: z.string().min(1).max(255),
  alias: z.string().max(255).optional(),
  narrativeRole: z.string().max(255).optional(),
  description: z.string().optional(),
  physicalDescription: z.string().optional(),
  colorPaletteJson: z.array(z.string()).optional(),
  costumeElementsJson: z.array(z.string()).optional(),
  keyTraitsJson: z.array(z.string()).optional(),
  personality: z.string().optional(),
  narrativeArc: z.string().optional(),
  tagsJson: z.array(z.string()).optional(),
});

export type CreateCharacterBody = z.infer<typeof createCharacterBodySchema>;

// Update
export const updateCharacterBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  alias: z.string().max(255).optional(),
  narrativeRole: z.string().max(255).optional(),
  description: z.string().optional(),
  physicalDescription: z.string().optional(),
  colorPaletteJson: z.array(z.string()).optional(),
  costumeElementsJson: z.array(z.string()).optional(),
  keyTraitsJson: z.array(z.string()).optional(),
  personality: z.string().optional(),
  narrativeArc: z.string().optional(),
  tagsJson: z.array(z.string()).optional(),
  status: characterStatusSchema.optional(),
});

export type UpdateCharacterBody = z.infer<typeof updateCharacterBodySchema>;

// Relation
export const characterRelationResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceCharacterId: z.string(),
  targetCharacterId: z.string(),
  relationType: z.string(),
  strength: z.number(),
  narrativeDependency: z.string(),
  notes: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CharacterRelationResponse = z.infer<typeof characterRelationResponseSchema>;

export const createRelationBodySchema = z.object({
  sourceCharacterId: z.string(),
  targetCharacterId: z.string(),
  relationType: z.string().min(1),
  strength: z.number().min(0).max(100).default(50),
  narrativeDependency: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateRelationBody = z.infer<typeof createRelationBodySchema>;

// Voice Sample
export const voiceSampleResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  characterId: z.string(),
  assetPath: z.string().nullable(),
  label: z.string(),
  voiceNotes: z.string(),
  createdAt: z.iso.datetime(),
});

export type VoiceSampleResponse = z.infer<typeof voiceSampleResponseSchema>;

export const createVoiceSampleBodySchema = z.object({
  label: z.string().min(1).max(255),
  assetPath: z.string().optional(),
  voiceNotes: z.string().optional(),
});

// Character Image
export const characterImageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  characterId: z.string(),
  filePath: z.string(),
  publicUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().nullable(),
  mimeType: z.string(),
  prompt: z.string(),
  strategy: z.string().nullable(),
  style: z.string().nullable(),
  variationIndex: z.number().nullable(),
  createdAt: z.iso.datetime(),
});

export type CharacterImageResponse = z.infer<typeof characterImageResponseSchema>;

// Params
export const characterIdParamsSchema = z.object({
  projectId: z.string(),
  characterId: z.string(),
});

export const relationIdParamsSchema = z.object({
  projectId: z.string(),
  characterId: z.string(),
  relationId: z.string(),
});

export const imageIdParamsSchema = z.object({
  projectId: z.string(),
  characterId: z.string(),
  imageId: z.string(),
});

// List responses
export const characterListResponseSchema = z.array(characterResponseSchema);

export const characterRelationListResponseSchema = z.array(characterRelationResponseSchema);

export const characterImageListResponseSchema = z.array(characterImageResponseSchema);

export const projectCharacterImagesResponseSchema = z.record(
  z.array(characterImageResponseSchema)
);

// Generate image
export const generateCharacterImageQuerySchema = z.object({
  strategy: z.string().default("portrait"),
  style: z.string().default("realistic"),
  imageCount: z.coerce.number().min(1).max(4).default(1),
  modelKey: z.string().optional(),
});

export type GenerateCharacterImageQuery = z.infer<typeof generateCharacterImageQuerySchema>;

// Character detail (with relations)
export const characterDetailResponseSchema = characterResponseSchema.extend({
  relations: z.array(characterRelationResponseSchema),
  voiceSamples: z.array(voiceSampleResponseSchema),
  relationshipsSummary: z.string().nullable(),
});

export type CharacterDetailResponse = z.infer<typeof characterDetailResponseSchema>;
