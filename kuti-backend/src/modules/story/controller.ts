/**
 * Controller pour le module Story
 */

import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { prisma } from "@lib/db";
import {
  completeStoryField as completeStoryFieldWithProvider,
  getStoryCompletionModels,
} from "@lib/story-completion";
import { runCoherenceScanIfEnabled } from "@lib/coherence-scan";
import { normalizeReferenceKind, syncSceneReferences } from "@lib/story-references";
import type {
  ReferenceSuggestion,
  TomeResponse,
  ChapterResponse,
  SceneResponse,
  CreateTomeBody,
  UpdateTomeBody,
  CreateChapterBody,
  UpdateChapterBody,
  CreateSceneBody,
  UpdateSceneBody,
  CompleteStoryFieldBody,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

type SceneMetadataRecord = {
  narrativeIntent: string;
  duration: string;
  tone: string;
  rhythm: string;
  visualConstraints: string;
  stagingNotes: string;
};

const DEFAULT_SCENE_METADATA: SceneMetadataRecord = {
  narrativeIntent: "",
  duration: "",
  tone: "",
  rhythm: "",
  visualConstraints: "",
  stagingNotes: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSceneMetadataValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readSceneMetadata(metadataJson: unknown): SceneMetadataRecord {
  const metadata = isRecord(metadataJson) ? metadataJson : {};

  return {
    narrativeIntent: readSceneMetadataValue(metadata.narrativeIntent),
    duration: readSceneMetadataValue(metadata.duration),
    tone: readSceneMetadataValue(metadata.tone),
    rhythm: readSceneMetadataValue(metadata.rhythm),
    visualConstraints: readSceneMetadataValue(metadata.visualConstraints),
    stagingNotes: readSceneMetadataValue(metadata.stagingNotes),
  };
}

function readSceneMetadataPatch(metadataJson: unknown): Partial<SceneMetadataRecord> {
  const metadata = isRecord(metadataJson) ? metadataJson : {};
  const patch: Partial<SceneMetadataRecord> = {};

  if (typeof metadata.narrativeIntent === "string") patch.narrativeIntent = metadata.narrativeIntent;
  if (typeof metadata.duration === "string") patch.duration = metadata.duration;
  if (typeof metadata.tone === "string") patch.tone = metadata.tone;
  if (typeof metadata.rhythm === "string") patch.rhythm = metadata.rhythm;
  if (typeof metadata.visualConstraints === "string") patch.visualConstraints = metadata.visualConstraints;
  if (typeof metadata.stagingNotes === "string") patch.stagingNotes = metadata.stagingNotes;

  return patch;
}

function mergeSceneMetadata(baseMetadataJson: unknown, nextMetadataJson: unknown | undefined): SceneMetadataRecord {
  return {
    ...DEFAULT_SCENE_METADATA,
    ...readSceneMetadata(baseMetadataJson),
    ...readSceneMetadataPatch(nextMetadataJson),
  };
}

function serializeTome(t: {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}): TomeResponse {
  return {
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    slug: t.slug,
    synopsis: t.synopsis,
    status: t.status as "active" | "draft" | "archived",
    orderIndex: t.orderIndex,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function serializeChapter(c: {
  id: string;
  projectId: string;
  tomeId: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}): ChapterResponse {
  return {
    id: c.id,
    projectId: c.projectId,
    tomeId: c.tomeId,
    title: c.title,
    slug: c.slug,
    synopsis: c.synopsis,
    status: c.status as "active" | "draft" | "archived",
    orderIndex: c.orderIndex,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function serializeScene(s: {
  id: string;
  projectId: string;
  tomeId: string;
  chapterId: string;
  title: string;
  slug: string;
  sceneType: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  charactersJson: unknown;
  tagsJson: unknown;
  metadataJson: unknown;
  status: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}): SceneResponse {
  // Parser charactersJson et tagsJson si ce sont des strings JSON
  let characters: string[] = [];
  let tags: string[] = [];

  try {
    if (typeof s.charactersJson === 'string') {
      characters = JSON.parse(s.charactersJson);
    } else if (Array.isArray(s.charactersJson)) {
      characters = s.charactersJson as string[];
    }
  } catch { /* ignore */ }

  try {
    if (typeof s.tagsJson === 'string') {
      tags = JSON.parse(s.tagsJson);
    } else if (Array.isArray(s.tagsJson)) {
      tags = s.tagsJson as string[];
    }
  } catch { /* ignore */ }

  return {
    id: s.id,
    projectId: s.projectId,
    tomeId: s.tomeId,
    chapterId: s.chapterId,
    title: s.title,
    slug: s.slug,
    sceneType: s.sceneType,
    location: s.location,
    summary: s.summary,
    content: s.content,
    notes: s.notes,
    charactersJson: characters,
    tagsJson: tags,
    metadataJson: readSceneMetadata(s.metadataJson),
    status: s.status as "active" | "draft" | "archived",
    orderIndex: s.orderIndex,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

function serializeStoryReference(ref: {
  id: string;
  projectId: string;
  sceneId: string;
  referenceKind: string;
  targetSlug: string;
  rawToken: string;
  createdAt: Date;
}) {
  return {
    id: ref.id,
    projectId: ref.projectId,
    sceneId: ref.sceneId,
    referenceKind: ref.referenceKind,
    targetSlug: ref.targetSlug,
    rawToken: ref.rawToken,
    createdAt: ref.createdAt.toISOString(),
  };
}

function normalizeLocationSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, replacement: "-" });
}

function buildReferenceSuggestion(data: ReferenceSuggestion): ReferenceSuggestion {
  return data;
}

async function generateUniqueSlug(projectId: string, title: string, model: "tome" | "chapter" | "scene"): Promise<string> {
  const baseSlug = slugify(title, { lower: true, strict: true }) || model;
  let candidate = baseSlug;
  let index = 2;

  const exists = async (s: string) => {
    const where = { projectId_slug: { projectId, slug: s } };
    if (model === "tome") return await prisma.tome.findUnique({ where });
    if (model === "chapter") return await prisma.chapter.findUnique({ where });
    return await prisma.scene.findUnique({ where });
  };

  while (await exists(candidate)) {
    candidate = `${baseSlug}-${index}`;
    index++;
  }

  return candidate;
}

// ============================================================================
// Story Summary
// ============================================================================

export async function getStorySummary(projectId: string) {
  const [tomes, chapters, scenes, references] = await Promise.all([
    prisma.tome.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" } }),
    prisma.chapter.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" } }),
    prisma.scene.findMany({ where: { projectId }, orderBy: { orderIndex: "asc" } }),
    prisma.storyReference.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
  ]);

  const [characters, assets, project] = await Promise.all([
    prisma.character.findMany({ where: { projectId }, select: { slug: true } }),
    prisma.asset.findMany({ where: { projectId }, select: { slug: true } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { settingsJson: true } }),
  ]);

  // Vérifier les références orphelines
  const sceneSlugs = new Set(scenes.map(s => s.slug));
  const tomeSlugs = new Set(tomes.map(t => t.slug));
  const chapterSlugs = new Set(chapters.map(c => c.slug));
  const charSlugs = new Set(characters.map((c) => c.slug));
  const assetSlugs = new Set(assets.map((asset) => asset.slug));
  const settings = (project?.settingsJson as Record<string, unknown> | null) ?? {};
  const projectLocations = Array.isArray(settings.locationsJson)
    ? (settings.locationsJson as string[])
    : [];
  const locationSlugs = new Set([
    ...projectLocations.map(normalizeLocationSlug),
    ...scenes.flatMap((scene) => scene.location ? [normalizeLocationSlug(scene.location)] : []),
  ]);

  const orphanReferences = references
    .map(ref => {
      let reason = "";
      switch (normalizeReferenceKind(ref.referenceKind)) {
        case "character":
          if (!charSlugs.has(ref.targetSlug)) reason = "Character not found";
          break;
        case "scene":
          if (!sceneSlugs.has(ref.targetSlug)) reason = "Scene not found";
          break;
        case "chapter":
          if (!chapterSlugs.has(ref.targetSlug)) reason = "Chapter not found";
          break;
        case "tome":
          if (!tomeSlugs.has(ref.targetSlug)) reason = "Tome not found";
          break;
        case "asset":
          if (!assetSlugs.has(ref.targetSlug)) reason = "Asset not found";
          break;
        case "environment":
          if (!locationSlugs.has(ref.targetSlug)) reason = "Location not found";
          break;
        default:
          reason = `Unsupported reference kind: ${ref.referenceKind}`;
          break;
      }
      return { ref, reason };
    })
    .filter(({ reason }) => reason !== "")
    .map(({ ref, reason }) => ({
      reference: serializeStoryReference(ref),
      reason,
    }));

  return {
    tomes: tomes.map(serializeTome),
    chapters: chapters.map(serializeChapter),
    scenes: scenes.map(serializeScene),
    references: references.map(serializeStoryReference),
    orphanReferences,
  };
}

// ============================================================================
// Tomes
// ============================================================================

export async function listTomes(projectId: string): Promise<TomeResponse[]> {
  const tomes = await prisma.tome.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
  });
  return tomes.map(serializeTome);
}

export async function getTome(projectId: string, tomeId: string): Promise<TomeResponse | null> {
  const tome = await prisma.tome.findFirst({ where: { id: tomeId, projectId } });
  return tome ? serializeTome(tome) : null;
}

export async function createTome(projectId: string, data: CreateTomeBody): Promise<TomeResponse> {
  const slug = await generateUniqueSlug(projectId, data.title, "tome");
  const now = new Date();

  const tome = await prisma.tome.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      slug,
      title: data.title,
      synopsis: data.synopsis ?? "",
      status: data.status ?? "draft",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeTome(tome);
}

export async function updateTome(
  projectId: string,
  tomeId: string,
  data: UpdateTomeBody
): Promise<TomeResponse | null> {
  const tome = await prisma.tome.findFirst({ where: { id: tomeId, projectId } });
  if (!tome) return null;

  const updated = await prisma.tome.update({
    where: { id: tomeId },
    data: {
      title: data.title,
      synopsis: data.synopsis,
      status: data.status,
      orderIndex: data.orderIndex,
      updatedAt: new Date(),
    },
  });

  return serializeTome(updated);
}

export async function deleteTome(projectId: string, tomeId: string): Promise<boolean> {
  const tome = await prisma.tome.findFirst({ where: { id: tomeId, projectId } });
  if (!tome) return false;

  await prisma.tome.delete({ where: { id: tomeId } });
  return true;
}

// ============================================================================
// Chapters
// ============================================================================

export async function listChapters(projectId: string, tomeId?: string): Promise<ChapterResponse[]> {
  const chapters = await prisma.chapter.findMany({
    where: { projectId, ...(tomeId && { tomeId }) },
    orderBy: { orderIndex: "asc" },
  });
  return chapters.map(serializeChapter);
}

export async function getChapter(projectId: string, chapterId: string): Promise<ChapterResponse | null> {
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, projectId } });
  return chapter ? serializeChapter(chapter) : null;
}

export async function createChapter(projectId: string, data: CreateChapterBody): Promise<ChapterResponse | null> {
  // Vérifier que le tome existe
  const tome = await prisma.tome.findFirst({ where: { id: data.tomeId, projectId } });
  if (!tome) throw new Error("chapter_missing_tome");

  const slug = await generateUniqueSlug(projectId, data.title, "chapter");
  const now = new Date();

  const chapter = await prisma.chapter.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      tomeId: data.tomeId,
      slug,
      title: data.title,
      synopsis: data.synopsis ?? "",
      status: data.status ?? "draft",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeChapter(chapter);
}

export async function updateChapter(
  projectId: string,
  chapterId: string,
  data: UpdateChapterBody
): Promise<ChapterResponse | null> {
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, projectId } });
  if (!chapter) return null;

  // Si on change le tomeId, vérifier qu'il existe
  if (data.tomeId && data.tomeId !== chapter.tomeId) {
    const tome = await prisma.tome.findFirst({ where: { id: data.tomeId, projectId } });
    if (!tome) throw new Error("chapter_missing_tome");
  }

  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      tomeId: data.tomeId,
      title: data.title,
      synopsis: data.synopsis,
      status: data.status,
      orderIndex: data.orderIndex,
      updatedAt: new Date(),
    },
  });

  return serializeChapter(updated);
}

export async function deleteChapter(projectId: string, chapterId: string): Promise<boolean> {
  const chapter = await prisma.chapter.findFirst({ where: { id: chapterId, projectId } });
  if (!chapter) return false;

  await prisma.chapter.delete({ where: { id: chapterId } });
  return true;
}

// ============================================================================
// Scenes
// ============================================================================

export async function listScenes(projectId: string, chapterId?: string): Promise<SceneResponse[]> {
  const scenes = await prisma.scene.findMany({
    where: { projectId, ...(chapterId && { chapterId }) },
    orderBy: { orderIndex: "asc" },
  });
  return scenes.map(serializeScene);
}

export async function getScene(projectId: string, sceneId: string): Promise<SceneResponse | null> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  return scene ? serializeScene(scene) : null;
}

export async function createScene(projectId: string, data: CreateSceneBody): Promise<SceneResponse | null> {
  // Vérifier la hiérarchie
  const [tome, chapter] = await Promise.all([
    prisma.tome.findFirst({ where: { id: data.tomeId, projectId } }),
    prisma.chapter.findFirst({ where: { id: data.chapterId, projectId } }),
  ]);

  if (!tome || !chapter || chapter.tomeId !== data.tomeId) {
    throw new Error("scene_hierarchy_mismatch");
  }

  const slug = await generateUniqueSlug(projectId, data.title, "scene");
  const now = new Date();

  const scene = await prisma.$transaction(async (tx) => {
    const created = await tx.scene.create({
      data: {
        id: randomUUIDv7(),
        projectId,
        tomeId: data.tomeId,
        chapterId: data.chapterId,
        slug,
        title: data.title,
        sceneType: data.sceneType ?? "",
        location: data.location ?? "",
        summary: data.summary ?? "",
        content: data.content ?? "",
        notes: data.notes ?? "",
        charactersJson: (data.charactersJson as string[]) ?? [],
        tagsJson: (data.tagsJson as string[]) ?? [],
        metadataJson: mergeSceneMetadata({}, data.metadataJson),
        status: data.status ?? "draft",
        orderIndex: data.orderIndex ?? 0,
        createdAt: now,
        updatedAt: now,
      },
    });

    await syncSceneReferences(created.id, projectId, {
      summary: created.summary,
      content: created.content,
      notes: created.notes,
    }, tx);

    return created;
  });

  await runCoherenceScanIfEnabled(projectId);

  return serializeScene(scene);
}

export async function updateScene(
  projectId: string,
  sceneId: string,
  data: UpdateSceneBody
): Promise<SceneResponse | null> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return null;

  // Vérifier la hiérarchie si on change tomeId ou chapterId
  if (data.tomeId || data.chapterId) {
    const newTomeId = data.tomeId ?? scene.tomeId;
    const newChapterId = data.chapterId ?? scene.chapterId;

    const chapter = await prisma.chapter.findFirst({
      where: { id: newChapterId, projectId, tomeId: newTomeId },
    });

  if (!chapter) throw new Error("scene_hierarchy_mismatch");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextScene = await tx.scene.update({
      where: { id: sceneId },
      data: {
        tomeId: data.tomeId,
        chapterId: data.chapterId,
        title: data.title,
        sceneType: data.sceneType,
        location: data.location,
        summary: data.summary,
        content: data.content,
        notes: data.notes,
        charactersJson: data.charactersJson as string[],
        tagsJson: data.tagsJson as string[],
        metadataJson: mergeSceneMetadata(scene.metadataJson, data.metadataJson),
        status: data.status,
        orderIndex: data.orderIndex,
        updatedAt: new Date(),
      },
    });

    await syncSceneReferences(nextScene.id, projectId, {
      summary: nextScene.summary,
      content: nextScene.content,
      notes: nextScene.notes,
    }, tx);

    return nextScene;
  });

  await runCoherenceScanIfEnabled(projectId);

  return serializeScene(updated);
}

export async function deleteScene(projectId: string, sceneId: string): Promise<boolean> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return false;

  await prisma.scene.delete({ where: { id: sceneId } });
  await runCoherenceScanIfEnabled(projectId);
  return true;
}

// ============================================================================
// Reference Suggestions
// ============================================================================

export async function getReferenceSuggestions(
  projectId: string,
  type: string,
  query: string
): Promise<ReferenceSuggestion[]> {
  const q = query.toLowerCase().trim();
  const canonicalType = normalizeReferenceKind(type);

  switch (canonicalType) {
    case "character": {
      const chars = await prisma.character.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      });
      return chars
        .filter(c => c.slug.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map((character) => buildReferenceSuggestion({
          kind: "character",
          slug: character.slug,
          label: character.name,
          entityId: character.id,
          href: `/projects/${projectId}/characters/${character.id}`,
          description: "character",
        }));
    }
    case "scene": {
      const scenes = await prisma.scene.findMany({ where: { projectId }, orderBy: { title: "asc" } });
      return scenes
        .filter(s => s.slug.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map((scene) => buildReferenceSuggestion({
          kind: "scene",
          slug: scene.slug,
          label: scene.title,
          entityId: scene.id,
          href: `/projects/${projectId}/story/${scene.tomeId}/scenes/${scene.id}`,
          description: "scene",
        }));
    }
    case "chapter": {
      const chapters = await prisma.chapter.findMany({
        where: { projectId },
        orderBy: { title: "asc" },
      });
      return chapters
        .filter(c => c.slug.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map((chapter) => buildReferenceSuggestion({
          kind: "chapter",
          slug: chapter.slug,
          label: chapter.title,
          entityId: chapter.id,
          href: `/projects/${projectId}/story/${chapter.tomeId}/chapters/${chapter.id}`,
          description: "chapter",
        }));
    }
    case "tome": {
      const tomes = await prisma.tome.findMany({ where: { projectId }, orderBy: { title: "asc" } });
      return tomes
        .filter(t => t.slug.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map((tome) => buildReferenceSuggestion({
          kind: "tome",
          slug: tome.slug,
          label: tome.title,
          entityId: tome.id,
          href: `/projects/${projectId}/story/${tome.id}`,
          description: "tome",
        }));
    }
    case "asset": {
      const assets = await prisma.asset.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      });
      return assets
        .filter(a => a.slug.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map((asset) => buildReferenceSuggestion({
          kind: "asset",
          slug: asset.slug,
          label: asset.name,
          entityId: asset.id,
          href: `/projects/${projectId}/assets?asset=${encodeURIComponent(asset.slug)}`,
          description: "asset",
        }));
    }
    case "environment": {
      const [project, scenes] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { settingsJson: true },
        }),
        prisma.scene.findMany({
          where: { projectId },
          select: { location: true },
        }),
      ]);

      const settings = (project?.settingsJson as Record<string, unknown> | null) ?? {};
      const projectLocations = Array.isArray(settings.locationsJson)
        ? (settings.locationsJson as string[])
        : [];
      const sceneLocations = scenes.map((scene) => scene.location).filter(Boolean);

      const uniqueLocations = new Map<string, string>();
      for (const location of [...projectLocations, ...sceneLocations]) {
        const label = location.trim();
        if (!label) continue;
        const slug = normalizeLocationSlug(label);
        if (!uniqueLocations.has(slug)) {
          uniqueLocations.set(slug, label);
        }
      }

      return Array.from(uniqueLocations.entries())
        .filter(([slug, label]) => slug.includes(q) || label.toLowerCase().includes(q))
        .slice(0, 10)
        .map(([slug, label]) => buildReferenceSuggestion({
          kind: "environment",
          slug,
          label,
          entityId: slug,
          href: `/projects/${projectId}/settings?location=${encodeURIComponent(slug)}`,
          description: "environment",
        }));
    }
    default:
      return [];
  }
}

// ============================================================================
// Story Completion
// ============================================================================

export function listStoryCompletionModels() {
  return getStoryCompletionModels();
}

async function buildCompletionContext(projectId: string, body: CompleteStoryFieldBody) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("project_not_found");

  if (body.targetKind === "tome") {
    const tome = await prisma.tome.findFirst({ where: { id: body.targetId, projectId } });
    if (!tome) throw new Error("tome_not_found");
    const [chapters, scenes] = await Promise.all([
      prisma.chapter.findMany({ where: { projectId, tomeId: tome.id }, orderBy: { orderIndex: "asc" } }),
      prisma.scene.findMany({ where: { projectId, tomeId: tome.id }, orderBy: { orderIndex: "asc" } }),
    ]);
    return {
      project: { name: project.name, slug: project.slug },
      tome: serializeTome(tome),
      chapters: chapters.map(serializeChapter),
      scenes: scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        summary: scene.summary,
        orderIndex: scene.orderIndex,
      })),
    };
  }

  if (body.targetKind === "chapter") {
    const chapter = await prisma.chapter.findFirst({ where: { id: body.targetId, projectId } });
    if (!chapter) throw new Error("chapter_not_found");
    const [tome, scenes] = await Promise.all([
      prisma.tome.findFirst({ where: { id: chapter.tomeId, projectId } }),
      prisma.scene.findMany({ where: { projectId, chapterId: chapter.id }, orderBy: { orderIndex: "asc" } }),
    ]);
    return {
      project: { name: project.name, slug: project.slug },
      tome: tome ? serializeTome(tome) : null,
      chapter: serializeChapter(chapter),
      scenes: scenes.map(serializeScene),
    };
  }

  const scene = await prisma.scene.findFirst({ where: { id: body.targetId, projectId } });
  if (!scene) throw new Error("scene_not_found");
  const [tome, chapter, characters] = await Promise.all([
    prisma.tome.findFirst({ where: { id: scene.tomeId, projectId } }),
    prisma.chapter.findFirst({ where: { id: scene.chapterId, projectId } }),
    prisma.character.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
  ]);

  return {
    project: { name: project.name, slug: project.slug },
    tome: tome ? serializeTome(tome) : null,
    chapter: chapter ? serializeChapter(chapter) : null,
    scene: serializeScene(scene),
    characters: characters.map((character) => ({
      id: character.id,
      slug: character.slug,
      name: character.name,
      narrativeRole: character.narrativeRole,
      description: character.description,
      personality: character.personality,
    })),
  };
}

export async function completeStoryField(projectId: string, body: CompleteStoryFieldBody) {
  const context = await buildCompletionContext(projectId, body);
  const result = await completeStoryFieldWithProvider({
    targetKind: body.targetKind,
    field: body.field,
    currentValue: body.currentValue,
    instruction: body.instruction,
    modelKey: body.modelKey,
    context,
  });

  return {
    targetKind: body.targetKind,
    targetId: body.targetId,
    field: body.field,
    modelKey: result.modelKey,
    text: result.text,
  };
}
