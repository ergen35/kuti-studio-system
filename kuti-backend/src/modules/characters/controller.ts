/**
 * Controller pour le module Characters
 */

import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { readFile } from "node:fs/promises";
import { prisma } from "@lib/db";
import {
  sendGenerateImageEvent,
} from "@lib/inngest";
import type {
  CreateCharacterBody,
  UpdateCharacterBody,
  CreateRelationBody,
  CharacterResponse,
  CharacterDetailResponse,
  CharacterRelationResponse,
  VoiceSampleResponse,
  CharacterImageResponse,
  GenerateCharacterImageQuery,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

async function generateUniqueSlug(projectId: string, name: string): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true }) || "character";
  let candidate = baseSlug;
  let index = 2;

  while (await prisma.character.findUnique({
    where: { projectId_slug: { projectId, slug: candidate } }
  })) {
    candidate = `${baseSlug}-${index}`;
    index++;
  }

  return candidate;
}

function serializeCharacter(char: {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  alias: string | null;
  narrativeRole: string | null;
  description: string;
  physicalDescription: string;
  colorPaletteJson: unknown;
  costumeElementsJson: unknown;
  keyTraitsJson: unknown;
  personality: string;
  narrativeArc: string;
  tagsJson: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}): CharacterResponse {
  return {
    id: char.id,
    projectId: char.projectId,
    slug: char.slug,
    name: char.name,
    alias: char.alias,
    narrativeRole: char.narrativeRole,
    description: char.description,
    physicalDescription: char.physicalDescription,
    colorPaletteJson: char.colorPaletteJson as string[],
    costumeElementsJson: char.costumeElementsJson as string[],
    keyTraitsJson: char.keyTraitsJson as string[],
    personality: char.personality,
    narrativeArc: char.narrativeArc,
    tagsJson: char.tagsJson as string[],
    status: char.status as "active" | "draft" | "archived",
    createdAt: char.createdAt.toISOString(),
    updatedAt: char.updatedAt.toISOString(),
    archivedAt: char.archivedAt?.toISOString() ?? null,
  };
}

function serializeRelation(rel: {
  id: string;
  projectId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationType: string;
  strength: number;
  narrativeDependency: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}): CharacterRelationResponse {
  return {
    id: rel.id,
    projectId: rel.projectId,
    sourceCharacterId: rel.sourceCharacterId,
    targetCharacterId: rel.targetCharacterId,
    relationType: rel.relationType,
    strength: rel.strength,
    narrativeDependency: rel.narrativeDependency,
    notes: rel.notes,
    createdAt: rel.createdAt.toISOString(),
    updatedAt: rel.updatedAt.toISOString(),
  };
}

function serializeVoiceSample(vs: {
  id: string;
  projectId: string;
  characterId: string;
  assetPath: string | null;
  label: string;
  voiceNotes: string;
  createdAt: Date;
}): VoiceSampleResponse {
  return {
    id: vs.id,
    projectId: vs.projectId,
    characterId: vs.characterId,
    assetPath: vs.assetPath,
    label: vs.label,
    voiceNotes: vs.voiceNotes,
    createdAt: vs.createdAt.toISOString(),
  };
}

function serializeImage(img: {
  id: string;
  projectId: string;
  characterId: string;
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  prompt: string;
  strategy: string | null;
  style: string | null;
  variationIndex: number | null;
  createdAt: Date;
}): CharacterImageResponse {
  return {
    id: img.id,
    projectId: img.projectId,
    characterId: img.characterId,
    filePath: img.filePath,
    publicUrl: img.publicUrl,
    fileName: img.fileName,
    fileSize: img.fileSize,
    mimeType: img.mimeType,
    prompt: img.prompt,
    strategy: img.strategy,
    style: img.style,
    variationIndex: img.variationIndex,
    createdAt: img.createdAt.toISOString(),
  };
}

// ============================================================================
// CRUD Characters
// ============================================================================

export async function listCharacters(projectId: string): Promise<CharacterResponse[]> {
  const chars = await prisma.character.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });
  return chars.map(serializeCharacter);
}

export async function getCharacter(
  projectId: string,
  characterId: string
): Promise<CharacterDetailResponse | null> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
    include: {
      sourceRelations: true,
      voiceSamples: true,
    },
  });

  if (!char) return null;

  const relations = char.sourceRelations.map(serializeRelation);
  const voiceSamples = char.voiceSamples.map(serializeVoiceSample);

  const relationshipsSummary = relations.length > 0
    ? relations.map(r => `${r.relationType}:${r.strength}`).join(" / ")
    : null;

  return {
    ...serializeCharacter(char),
    relations,
    voiceSamples,
    relationshipsSummary,
  };
}

export async function createCharacter(
  projectId: string,
  data: CreateCharacterBody
): Promise<CharacterResponse> {
  const slug = await generateUniqueSlug(projectId, data.name);
  const now = new Date();

  const char = await prisma.character.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      slug,
      name: data.name,
      alias: data.alias ?? null,
      narrativeRole: data.narrativeRole ?? null,
      description: data.description ?? "",
      physicalDescription: data.physicalDescription ?? "",
      colorPaletteJson: data.colorPaletteJson ?? [],
      costumeElementsJson: data.costumeElementsJson ?? [],
      keyTraitsJson: data.keyTraitsJson ?? [],
      personality: data.personality ?? "",
      narrativeArc: data.narrativeArc ?? "",
      tagsJson: data.tagsJson ?? [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeCharacter(char);
}

export async function updateCharacter(
  projectId: string,
  characterId: string,
  data: UpdateCharacterBody
): Promise<CharacterResponse | null> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });

  if (!char) return null;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      name: data.name,
      alias: data.alias,
      narrativeRole: data.narrativeRole,
      description: data.description,
      physicalDescription: data.physicalDescription,
      colorPaletteJson: data.colorPaletteJson,
      costumeElementsJson: data.costumeElementsJson,
      keyTraitsJson: data.keyTraitsJson,
      personality: data.personality,
      narrativeArc: data.narrativeArc,
      tagsJson: data.tagsJson,
      status: data.status,
      updatedAt: new Date(),
    },
  });

  return serializeCharacter(updated);
}

export async function archiveCharacter(
  projectId: string,
  characterId: string
): Promise<CharacterResponse | null> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });

  if (!char) return null;

  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      status: "archived",
      archivedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return serializeCharacter(updated);
}

export async function deleteCharacter(
  projectId: string,
  characterId: string
): Promise<boolean> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });

  if (!char) return false;

  await prisma.character.delete({ where: { id: characterId } });
  return true;
}

// ============================================================================
// Relations
// ============================================================================

export async function createRelation(
  projectId: string,
  characterId: string,
  data: CreateRelationBody
): Promise<CharacterRelationResponse | null> {
  // Vérifier que le characterId correspond bien au sourceCharacterId
  if (data.sourceCharacterId !== characterId) {
    throw new Error("source_character_id_must_match_route");
  }

  // Vérifier que les deux personnages existent
  const [source, target] = await Promise.all([
    prisma.character.findFirst({ where: { id: data.sourceCharacterId, projectId } }),
    prisma.character.findFirst({ where: { id: data.targetCharacterId, projectId } }),
  ]);

  if (!source || !target) {
    throw new Error("relation_missing_character");
  }

  // Empêcher l'auto-référence
  if (data.sourceCharacterId === data.targetCharacterId) {
    throw new Error("relation_self_reference");
  }

  const now = new Date();

  const relation = await prisma.characterRelation.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      sourceCharacterId: data.sourceCharacterId,
      targetCharacterId: data.targetCharacterId,
      relationType: data.relationType,
      strength: data.strength,
      narrativeDependency: data.narrativeDependency ?? "",
      notes: data.notes ?? "",
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeRelation(relation);
}

export async function listRelations(
  projectId: string,
  characterId: string
): Promise<CharacterRelationResponse[]> {
  const relations = await prisma.characterRelation.findMany({
    where: {
      projectId,
      OR: [
        { sourceCharacterId: characterId },
        { targetCharacterId: characterId },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  return relations.map(serializeRelation);
}

// ============================================================================
// Voice Samples
// ============================================================================

export async function createVoiceSample(
  projectId: string,
  characterId: string,
  data: { label: string; assetPath?: string; voiceNotes?: string }
): Promise<VoiceSampleResponse | null> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });

  if (!char) return null;

  const vs = await prisma.voiceSample.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      characterId,
      assetPath: data.assetPath ?? null,
      label: data.label,
      voiceNotes: data.voiceNotes ?? "",
      createdAt: new Date(),
    },
  });

  return serializeVoiceSample(vs);
}

// ============================================================================
// Images
// ============================================================================

export async function listCharacterImages(
  projectId: string,
  characterId: string
): Promise<CharacterImageResponse[]> {
  const images = await prisma.characterImage.findMany({
    where: { projectId, characterId },
    orderBy: { createdAt: "desc" },
  });

  return images.map(serializeImage);
}

export async function getAllProjectCharacterImages(
  projectId: string
): Promise<Record<string, CharacterImageResponse[]>> {
  const images = await prisma.characterImage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const result: Record<string, CharacterImageResponse[]> = {};

  for (const img of images) {
    if (!result[img.characterId]) {
      result[img.characterId] = [];
    }
    result[img.characterId].push(serializeImage(img));
  }

  return result;
}

export async function deleteCharacterImage(
  projectId: string,
  characterId: string,
  imageId: string
): Promise<boolean> {
  const image = await prisma.characterImage.findFirst({
    where: { id: imageId, projectId, characterId },
  });

  if (!image) return false;

  // Supprimer le fichier physique
  try {
    const { deleteFile } = await import("@lib/filesystem");
    const { getAssetsRootDir } = await import("@lib/config");
    const fullPath = `${getAssetsRootDir()}/${image.filePath}`;
    await deleteFile(fullPath);
  } catch {
    // Ignorer les erreurs de suppression de fichier
  }

  await prisma.characterImage.delete({ where: { id: imageId } });
  return true;
}

// ============================================================================
// Image Generation (via Inngest)
// ============================================================================

export async function generateCharacterImage(
  projectId: string,
  characterId: string,
  query: GenerateCharacterImageQuery
): Promise<{ jobId: string; status: string; message: string } | null> {
  const char = await prisma.character.findFirst({
    where: { id: characterId, projectId },
  });

  if (!char) return null;

  // Créer un GenerationJob
  const jobId = randomUUIDv7();

  await prisma.generationJob.create({
    data: {
      id: jobId,
      projectId,
      sourceKind: "custom",
      sourceId: characterId,
      sourceLabel: `Character: ${char.name}`,
      strategy: "direct",
      status: "pending",
      progress: 0,
      title: `Generate images for ${char.name}`,
      prompt: `Generate ${query.strategy} images for character ${char.name}`,
      metadataJson: {
        characterId,
        strategy: query.strategy,
        style: query.style,
        imageCount: Math.min(Math.max(query.imageCount, 1), 4),
        modelKey: query.modelKey,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Déclencher le job Inngest
  await sendGenerateImageEvent({
    projectId,
    characterId,
    jobId,
    strategy: query.strategy,
    style: query.style,
    imageCount: Math.min(Math.max(query.imageCount, 1), 4),
    modelKey: query.modelKey,
  });

  return {
    jobId,
    status: "pending",
    message: "Image generation job created",
  };
}
