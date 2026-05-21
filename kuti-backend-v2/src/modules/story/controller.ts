/**
 * Controller pour le module Story
 */

import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { prisma } from "@lib/db";
import type {
  TomeResponse,
  ChapterResponse,
  SceneResponse,
  CreateTomeBody,
  UpdateTomeBody,
  CreateChapterBody,
  UpdateChapterBody,
  CreateSceneBody,
  UpdateSceneBody,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

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
    project_id: t.projectId,
    title: t.title,
    slug: t.slug,
    synopsis: t.synopsis,
    status: t.status as "active" | "draft" | "archived",
    order_index: t.orderIndex,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
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
    project_id: c.projectId,
    tome_id: c.tomeId,
    title: c.title,
    slug: c.slug,
    synopsis: c.synopsis,
    status: c.status as "active" | "draft" | "archived",
    order_index: c.orderIndex,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
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
    project_id: s.projectId,
    tome_id: s.tomeId,
    chapter_id: s.chapterId,
    title: s.title,
    slug: s.slug,
    scene_type: s.sceneType,
    location: s.location,
    summary: s.summary,
    content: s.content,
    notes: s.notes,
    characters_json: characters,
    tags_json: tags,
    status: s.status as "active" | "draft" | "archived",
    order_index: s.orderIndex,
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
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
    prisma.storyReference.findMany({ where: { projectId } }),
  ]);

  // Vérifier les références orphelines
  const sceneSlugs = new Set(scenes.map(s => s.slug));
  const charSlugs = new Set((await prisma.character.findMany({ where: { projectId } })).map(c => c.slug));
  const tomeSlugs = new Set(tomes.map(t => t.slug));
  const chapterSlugs = new Set(chapters.map(c => c.slug));

  const orphanReferences = references
    .map(ref => {
      let reason = "";
      switch (ref.referenceKind) {
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
      }
      return { ref, reason };
    })
    .filter(({ reason }) => reason !== "")
    .map(({ ref, reason }) => ({
      reference: {
        id: ref.id,
        projectId: ref.projectId,
        sceneId: ref.sceneId,
        referenceKind: ref.referenceKind,
        targetSlug: ref.targetSlug,
        rawToken: ref.rawToken,
        createdAt: ref.createdAt.toISOString(),
      },
      reason,
    }));

  return {
    tomes: tomes.map(serializeTome),
    chapters: chapters.map(serializeChapter),
    scenes: scenes.map(serializeScene),
    orphan_references: orphanReferences,
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

  const scene = await prisma.scene.create({
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
      status: data.status ?? "draft",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    },
  });

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

  const updated = await prisma.scene.update({
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
      status: data.status,
      orderIndex: data.orderIndex,
      updatedAt: new Date(),
    },
  });

  return serializeScene(updated);
}

export async function deleteScene(projectId: string, sceneId: string): Promise<boolean> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return false;

  await prisma.scene.delete({ where: { id: sceneId } });
  return true;
}

// ============================================================================
// Reference Suggestions
// ============================================================================

export async function getReferenceSuggestions(
  projectId: string,
  type: string,
  query: string
): Promise<Array<{ slug: string; label: string }>> {
  const q = query.toLowerCase();

  switch (type) {
    case "character": {
      const chars = await prisma.character.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      });
      return chars
        .filter(c => c.slug.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map(c => ({ slug: c.slug, label: c.name }));
    }
    case "scene": {
      const scenes = await prisma.scene.findMany({ where: { projectId }, orderBy: { title: "asc" } });
      return scenes
        .filter(s => s.slug.toLowerCase().includes(q) || s.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map(s => ({ slug: s.slug, label: s.title }));
    }
    case "chapter": {
      const chapters = await prisma.chapter.findMany({
        where: { projectId },
        orderBy: { title: "asc" },
      });
      return chapters
        .filter(c => c.slug.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map(c => ({ slug: c.slug, label: c.title }));
    }
    case "tome": {
      const tomes = await prisma.tome.findMany({ where: { projectId }, orderBy: { title: "asc" } });
      return tomes
        .filter(t => t.slug.toLowerCase().includes(q) || t.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map(t => ({ slug: t.slug, label: t.title }));
    }
    case "asset": {
      const assets = await prisma.asset.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      });
      return assets
        .filter(a => a.slug.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
        .slice(0, 10)
        .map(a => ({ slug: a.slug, label: a.name }));
    }
    default:
      return [];
  }
}
