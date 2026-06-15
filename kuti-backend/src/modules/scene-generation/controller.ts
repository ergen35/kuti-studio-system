/**
 * Controller Scene Generation - Logique métier
 */

import { db } from "@lib/db";
import slugify from "slugify";
import { sendGenerateSceneMangaEvent } from "@lib/inngest";
import {
  buildScenePanelPrompt,
  buildSceneSystemPrompt,
  buildStyleDescription,
  type PromptCharacterAnchor,
  type PromptReferenceAnchor,
  selectActiveCharacterSheet,
} from "@lib/manga-prompts";
import { normalizeReferenceKind } from "@lib/story-references";
import { parseSceneContentBeats, requireSceneContent } from "./content";
import type {
  CreateSceneConfigBody,
  UpdateSceneConfigBody,
  GenerateSceneMangaBody,
  PreviewPromptBody,
  UpdateMangaPageBody,
} from "./dto";

// ============================================================================
// Scene Generation Configs
// ============================================================================

export async function listSceneConfigs(projectId: string, sceneId: string) {
  // Vérifier que la scène existe
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) throw new Error("Scene not found");

  // Récupérer toutes les configs du projet (elles sont partagées)
  const configs = await db.sceneGenerationConfig.findMany({
    where: { projectId },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" },
    ],
  });

  return configs.map((config) => ({
    ...config,
    metadata: config.metadataJson as Record<string, unknown>,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  }));
}

export async function createSceneConfig(
  projectId: string,
  sceneId: string,
  data: CreateSceneConfigBody
) {
  // Vérifier que la scène existe
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) throw new Error("Scene not found");

  // Si c'est la première config ou qu'elle est marquée comme default,
  // désactiver les autres configs default
  const existingDefault = await db.sceneGenerationConfig.findFirst({
    where: { projectId, isDefault: true },
  });

  const isDefault = !existingDefault;

  const config = await db.sceneGenerationConfig.create({
    data: {
      projectId,
      name: data.name,
      isDefault,
      systemPrompt: data.systemPrompt,
      stylePreset: data.stylePreset,
      colorMode: data.colorMode,
      defaultImageCount: data.defaultImageCount,
      allowMultiPage: data.allowMultiPage,
      metadataJson: {},
    },
  });

  return {
    ...config,
    metadata: config.metadataJson as Record<string, unknown>,
    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function updateSceneConfig(
  projectId: string,
  sceneId: string,
  configId: string,
  data: UpdateSceneConfigBody
) {
  // Vérifier que la config existe et appartient au projet
  const config = await db.sceneGenerationConfig.findFirst({
    where: { id: configId, projectId },
  });
  if (!config) return null;

  const updated = await db.sceneGenerationConfig.update({
    where: { id: configId },
    data: {
      name: data.name,
      systemPrompt: data.systemPrompt,
      stylePreset: data.stylePreset,
      colorMode: data.colorMode,
      defaultImageCount: data.defaultImageCount,
      allowMultiPage: data.allowMultiPage,
    },
  });

  return {
    ...updated,
    metadata: updated.metadataJson as Record<string, unknown>,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function deleteSceneConfig(
  projectId: string,
  sceneId: string,
  configId: string
) {
  // Vérifier que la config existe
  const config = await db.sceneGenerationConfig.findFirst({
    where: { id: configId, projectId },
  });
  if (!config) return false;

  await db.sceneGenerationConfig.delete({
    where: { id: configId },
  });

  return true;
}

export async function setDefaultConfig(
  projectId: string,
  sceneId: string,
  configId: string,
  isDefault: boolean
) {
  // Vérifier que la config existe
  const config = await db.sceneGenerationConfig.findFirst({
    where: { id: configId, projectId },
  });
  if (!config) return null;

  if (isDefault) {
    // Désactiver l'ancienne config par défaut
    await db.sceneGenerationConfig.updateMany({
      where: { projectId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const updated = await db.sceneGenerationConfig.update({
    where: { id: configId },
    data: { isDefault },
  });

  return {
    ...updated,
    metadata: updated.metadataJson as Record<string, unknown>,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// ============================================================================
// Scene Manga Generation
// ============================================================================

export async function generateSceneManga(
  projectId: string,
  sceneId: string,
  data: GenerateSceneMangaBody
) {
  // Vérifier que la scène existe
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
    include: { tome: true, chapter: true },
  });
  if (!scene) throw new Error("Scene not found");

  requireSceneContent(
    scene.content,
    "Scene content is required before manga generation",
  );

  // Récupérer la config (par défaut ou spécifiée)
  let config = null;
  if (data.configId) {
    config = await db.sceneGenerationConfig.findFirst({
      where: { id: data.configId, projectId },
    });
  } else {
    config = await db.sceneGenerationConfig.findFirst({
      where: { projectId, isDefault: true },
    });
  }

  // Créer un job immédiatement (pending status)
  const job = await db.generationJob.create({
    data: {
      projectId,
      sourceKind: "scene",
      sourceId: sceneId,
      sourceLabel: `${scene.tome?.title || "Tome"} > ${scene.chapter?.title || "Chapter"} > ${scene.title}`,
      strategy: "intermediate",
      entrypoint: "gpt_images_2",
      title: `Manga: ${scene.title}`,
      prompt: "", // Sera rempli par la fonction Inngest
      summary: `Queued with ${data.imageCount} images${config ? `, config: ${config.name}` : ""}`,
      status: "pending",
      progress: 0,
      metadataJson: {
        sceneId,
        configId: config?.id || data.configId,
        modelKey: data.modelKey,
        requestedImageCount: data.imageCount,
      },
    },
  });

  // Envoyer l'événement à Inngest
  await sendGenerateSceneMangaEvent({
    projectId,
    sceneId,
    jobId: job.id,
    configId: config?.id || data.configId,
    modelKey: data.modelKey,
    imageCount: data.imageCount,
    characterImageRefs: data.characterImageRefs,
    additionalContext: data.additionalContext,
  });

  return {
    success: true,
    jobId: job.id,
    message: "Generation job queued",
  };
}

export async function previewPrompt(
  projectId: string,
  sceneId: string,
  data: PreviewPromptBody
) {
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
    include: { tome: true, chapter: true },
  });

  if (!scene) throw new Error("Scene not found");

  const sceneContent = requireSceneContent(
    scene.content,
    "Scene content is required before manga preview",
  );

  const [sceneReferences, project] = await Promise.all([
    db.storyReference.findMany({
      where: { projectId, sceneId },
      orderBy: { createdAt: "asc" },
    }),
    db.project.findFirst({
      where: { id: projectId },
      select: { settingsJson: true },
    }),
  ]);

  const config = data.configId
    ? await db.sceneGenerationConfig.findFirst({
        where: { id: data.configId, projectId },
      })
    : await db.sceneGenerationConfig.findFirst({
        where: { projectId, isDefault: true },
      });

  const sceneCharacterRefs = jsonStringArray(scene.charactersJson);
  const selectedCharacterIds = Object.keys(data.characterImageRefs ?? {});
  const selectedImageIds = Object.values(data.characterImageRefs ?? {}).filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  const referenceCharacterSlugs = sceneReferences
    .map((reference) => normalizeReferenceKind(reference.referenceKind) === "character" ? reference.targetSlug : null)
    .filter((value): value is string => Boolean(value));
  const characterLookupValues = Array.from(new Set([...sceneCharacterRefs, ...selectedCharacterIds, ...referenceCharacterSlugs]));

  const characterRecords = characterLookupValues.length > 0
    ? await db.character.findMany({
        where: {
          projectId,
          OR: [
            { id: { in: characterLookupValues } },
            { slug: { in: characterLookupValues } },
            { name: { in: characterLookupValues } },
          ],
        },
        include: {
          images: {
            take: 6,
            orderBy: [
              { kind: "asc" },
              { isActive: "desc" },
              { createdAt: "desc" },
            ],
          },
        },
      })
    : [];

  const selectedImages = selectedImageIds.length > 0
    ? await db.characterImage.findMany({
        where: { projectId, id: { in: selectedImageIds } },
        select: {
          id: true,
          characterId: true,
          filePath: true,
          publicUrl: true,
          fileName: true,
          prompt: true,
          kind: true,
          isActive: true,
          style: true,
          strategy: true,
          variationIndex: true,
        },
      })
    : [];

  const referencedSceneSlugs = sceneReferences
    .map((reference) => normalizeReferenceKind(reference.referenceKind) === "scene" ? reference.targetSlug : null)
    .filter((value): value is string => Boolean(value));
  const referencedChapterSlugs = sceneReferences
    .map((reference) => normalizeReferenceKind(reference.referenceKind) === "chapter" ? reference.targetSlug : null)
    .filter((value): value is string => Boolean(value));
  const referencedTomeSlugs = sceneReferences
    .map((reference) => normalizeReferenceKind(reference.referenceKind) === "tome" ? reference.targetSlug : null)
    .filter((value): value is string => Boolean(value));
  const referencedAssetSlugs = sceneReferences
    .map((reference) => normalizeReferenceKind(reference.referenceKind) === "asset" ? reference.targetSlug : null)
    .filter((value): value is string => Boolean(value));

  const [referencedScenes, referencedChapters, referencedTomes] = await Promise.all([
    referencedSceneSlugs.length > 0
      ? db.scene.findMany({
          where: { projectId, slug: { in: referencedSceneSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
    referencedChapterSlugs.length > 0
      ? db.chapter.findMany({
          where: { projectId, slug: { in: referencedChapterSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
    referencedTomeSlugs.length > 0
      ? db.tome.findMany({
          where: { projectId, slug: { in: referencedTomeSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const referencedAssets: Array<{ slug: string; name: string }> = [];

  const sceneLocationMap = new Map<string, string>();
  const projectLocations = Array.isArray((project?.settingsJson as Record<string, unknown> | null)?.locationsJson)
    ? ((project?.settingsJson as Record<string, unknown>).locationsJson as string[])
    : [];

  for (const location of [...projectLocations, scene.location]) {
    const trimmed = typeof location === "string" ? location.trim() : "";
    if (!trimmed) continue;
    sceneLocationMap.set(normalizeLocationSlug(trimmed), trimmed);
  }

  const characterBySlug = new Map(characterRecords.map((character) => [character.slug, character]));
  const sceneBySlug = new Map(referencedScenes.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
  const chapterBySlug = new Map(referencedChapters.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
  const tomeBySlug = new Map(referencedTomes.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
  const assetBySlug = new Map(referencedAssets.map((entry: { slug: string; name: string }) => [entry.slug, entry]));
  const selectedImageByCharacterId = new Map(selectedImages.map((image) => [image.characterId, image]));

  const characterAnchors: PromptCharacterAnchor[] = characterRecords.map((character) => {
    const activeSheet = selectActiveCharacterSheet(character.images);
    const selectedImage = selectedImageByCharacterId.get(character.id);

    return {
      name: character.name,
      alias: character.alias,
      narrativeRole: character.narrativeRole,
      description: character.description,
      physicalDescription: character.physicalDescription,
      personality: character.personality,
      narrativeArc: character.narrativeArc,
      keyTraitsJson: character.keyTraitsJson,
      colorPaletteJson: character.colorPaletteJson,
      costumeElementsJson: character.costumeElementsJson,
      tagsJson: character.tagsJson,
      activeSheet: activeSheet
        ? {
            id: activeSheet.id,
            fileName: activeSheet.fileName,
            publicUrl: activeSheet.publicUrl,
            prompt: activeSheet.prompt,
            style: activeSheet.style,
            strategy: activeSheet.strategy,
            variationIndex: activeSheet.variationIndex,
            kind: activeSheet.kind,
            isActive: activeSheet.isActive,
          }
        : null,
      selectedImage: selectedImage
        ? {
            id: selectedImage.id,
            fileName: selectedImage.fileName,
            publicUrl: selectedImage.publicUrl,
            prompt: selectedImage.prompt,
            style: selectedImage.style,
            strategy: selectedImage.strategy,
            variationIndex: selectedImage.variationIndex,
            kind: selectedImage.kind,
            isActive: selectedImage.isActive,
          }
        : null,
    };
  });

  const referenceAnchors: PromptReferenceAnchor[] = sceneReferences.map((reference) => {
    const canonicalKind = normalizeReferenceKind(reference.referenceKind);

    switch (canonicalKind) {
      case "character": {
        const character = characterBySlug.get(reference.targetSlug);
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: character?.slug ?? null,
          resolvedLabel: character?.name ?? null,
          description: character ? "character" : "missing character",
          isBroken: !character,
        };
      }
      case "scene": {
        const target = sceneBySlug.get(reference.targetSlug);
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: target?.slug ?? null,
          resolvedLabel: target?.title ?? null,
          description: target ? "scene" : "missing scene",
          isBroken: !target,
        };
      }
      case "chapter": {
        const target = chapterBySlug.get(reference.targetSlug);
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: target?.slug ?? null,
          resolvedLabel: target?.title ?? null,
          description: target ? "chapter" : "missing chapter",
          isBroken: !target,
        };
      }
      case "tome": {
        const target = tomeBySlug.get(reference.targetSlug);
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: target?.slug ?? null,
          resolvedLabel: target?.title ?? null,
          description: target ? "tome" : "missing tome",
          isBroken: !target,
        };
      }
      case "asset": {
        const target = assetBySlug.get(reference.targetSlug);
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: target?.slug ?? null,
          resolvedLabel: target?.name ?? null,
          description: target ? "asset" : "missing asset",
          isBroken: !target,
        };
      }
      case "environment": {
        const targetLabel = sceneLocationMap.get(reference.targetSlug) ?? null;
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: targetLabel ?? reference.targetSlug,
          resolvedLabel: targetLabel,
          description: targetLabel ? "environment" : "missing environment",
          isBroken: !targetLabel,
        };
      }
      default:
        return {
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          label: reference.targetSlug,
          resolvedLabel: null,
          description: "unsupported reference kind",
          isBroken: true,
        };
    }
  });

  const sceneContext = {
    title: scene.title,
    location: scene.location,
    content: sceneContent,
    tomeTitle: scene.tome?.title ?? null,
    chapterTitle: scene.chapter?.title ?? null,
  };

  const styleContext = {
    systemPrompt: config?.systemPrompt,
    stylePreset: config?.stylePreset,
    colorMode: config?.colorMode,
    allowMultiPage: config?.allowMultiPage,
  };

  const systemPrompt = buildSceneSystemPrompt(styleContext);

  const styleDescription = buildStyleDescription(
    config?.stylePreset || "generic",
    config?.colorMode || "bw"
  );

  const prompts = generatePanelPreviews({
    context: sceneContext,
    style: styleContext,
    characters: characterAnchors,
    references: referenceAnchors,
    beats: parseSceneContentBeats(sceneContent, scene.title),
    panelCount: data.panelCount,
    additionalContext: null,
  });

  return {
    prompts,
    systemPrompt,
    styleDescription,
  };
}

// ============================================================================
// Scene Manga Pages
// ============================================================================

function publicMangaPageImageUrl(projectId: string, page: { imageUrl: string | null; boardId: string; panelId: string }) {
  if (!page.imageUrl) return null;

  // Si c'est déjà une URL complète (http, https, /projects/, /api/)
  if (
    page.imageUrl.startsWith("http://") ||
    page.imageUrl.startsWith("https://") ||
    page.imageUrl.startsWith("/projects/") ||
    page.imageUrl.startsWith("/api/")
  ) {
    return page.imageUrl;
  }

  // Fallback vers l'API pour les anciens panels (chemin kuti-data)
  return `/api/projects/${projectId}/generation/boards/${page.boardId}/panels/${page.panelId}/image`;
}

type MangaPageMetadataRecord = {
  readyForExport: boolean;
};

const DEFAULT_MANGA_PAGE_METADATA: MangaPageMetadataRecord = {
  readyForExport: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readMangaPageMetadata(metadataJson: unknown): MangaPageMetadataRecord {
  const metadata = isRecord(metadataJson) ? metadataJson : {};

  return {
    readyForExport: metadata.readyForExport === true,
  };
}

function readMangaPageMetadataPatch(metadataJson: unknown): Partial<MangaPageMetadataRecord> {
  const metadata = isRecord(metadataJson) ? metadataJson : {};
  const patch: Partial<MangaPageMetadataRecord> = {};

  if (typeof metadata.readyForExport === "boolean") {
    patch.readyForExport = metadata.readyForExport;
  }

  return patch;
}

function mergeMangaPageMetadata(baseMetadataJson: unknown, nextMetadataJson: unknown | undefined): MangaPageMetadataRecord {
  return {
    ...DEFAULT_MANGA_PAGE_METADATA,
    ...readMangaPageMetadata(baseMetadataJson),
    ...readMangaPageMetadataPatch(nextMetadataJson),
  };
}

function serializeMangaPage(projectId: string, page: Awaited<ReturnType<typeof db.sceneMangaPage.findFirst>> & {}) {
  return {
    ...page,
    metadataJson: readMangaPageMetadata(page.metadataJson),
    imageUrl: publicMangaPageImageUrl(projectId, page),
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function listSceneMangaPages(projectId: string, sceneId: string) {
  // Vérifier que la scène existe
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) throw new Error("Scene not found");

  const pages = await db.sceneMangaPage.findMany({
    where: { projectId, sceneId },
    orderBy: { pageNumber: "asc" },
  });

  return pages.map((page) => serializeMangaPage(projectId, page));
}

export async function updateSceneMangaPage(
  projectId: string,
  sceneId: string,
  pageId: string,
  data: UpdateMangaPageBody
) {
  // Vérifier que la page existe
  const page = await db.sceneMangaPage.findFirst({
    where: { id: pageId, projectId, sceneId },
  });
  if (!page) return null;

  const updated = await db.$transaction(async (tx) => {
    const desiredPageNumber = typeof data.pageNumber === "number"
      ? Math.max(1, Math.floor(data.pageNumber))
      : null;

    if (desiredPageNumber !== null && desiredPageNumber !== page.pageNumber) {
      const orderedPages = await tx.sceneMangaPage.findMany({
        where: { projectId, sceneId },
        select: { id: true, pageNumber: true },
        orderBy: { pageNumber: "asc" },
      });

      const maxPageNumber = orderedPages.length > 0 ? orderedPages[orderedPages.length - 1].pageNumber : page.pageNumber;
      const targetPageNumber = Math.min(desiredPageNumber, maxPageNumber);

      if (targetPageNumber > page.pageNumber) {
        const pagesToShift = orderedPages.filter((entry) => entry.pageNumber > page.pageNumber && entry.pageNumber <= targetPageNumber);
        for (const entry of pagesToShift) {
          await tx.sceneMangaPage.update({
            where: { id: entry.id },
            data: { pageNumber: entry.pageNumber - 1 },
          });
        }
      } else {
        const pagesToShift = orderedPages.filter((entry) => entry.pageNumber >= targetPageNumber && entry.pageNumber < page.pageNumber);
        for (const entry of pagesToShift) {
          await tx.sceneMangaPage.update({
            where: { id: entry.id },
            data: { pageNumber: entry.pageNumber + 1 },
          });
        }
      }
    }

    return await tx.sceneMangaPage.update({
      where: { id: pageId },
      data: {
        label: data.label,
        status: data.status,
        imageUrl: data.imageUrl,
        caption: data.caption,
        prompt: data.prompt,
        pageNumber: typeof data.pageNumber === "number" ? Math.max(1, Math.floor(data.pageNumber)) : undefined,
        metadataJson: mergeMangaPageMetadata(page.metadataJson, data.metadataJson),
      },
    });
  });

  return serializeMangaPage(projectId, updated);
}

export async function deleteSceneMangaPage(
  projectId: string,
  sceneId: string,
  pageId: string
) {
  // Vérifier que la page existe
  const page = await db.sceneMangaPage.findFirst({
    where: { id: pageId, projectId, sceneId },
  });
  if (!page) return false;

  await db.sceneMangaPage.delete({
    where: { id: pageId },
  });

  return true;
}

function generatePanelPreviews({
  context,
  style,
  characters,
  references,
  beats,
  panelCount,
  additionalContext,
}: {
  context: {
    title: string;
    location: string;
    content: string;
    notes?: string | null;
    tomeTitle?: string | null;
    chapterTitle?: string | null;
  };
  style: {
    systemPrompt?: string | null;
    stylePreset?: string | null;
    colorMode?: string | null;
    allowMultiPage?: boolean | null;
  };
  characters: PromptCharacterAnchor[];
  references: PromptReferenceAnchor[];
  beats: ReturnType<typeof parseSceneContentBeats>;
  panelCount: number;
  additionalContext?: string | null;
}): Array<{ panelIndex: number; title: string; prompt: string; caption: string }> {
  const panels: Array<{ panelIndex: number; title: string; prompt: string; caption: string }> = [];
  const fallbackBeat = beats[0] ?? parseSceneContentBeats(null, context.title)[0]!;

  const count = Math.max(1, panelCount);

  for (let i = 0; i < count; i++) {
    const beat = beats[i] || beats[i % beats.length] || fallbackBeat;

    panels.push({
      panelIndex: i,
      title: `Panel ${i + 1}`,
      prompt: buildScenePanelPrompt({
        style,
        context,
        characters,
        references,
        panelIndex: i,
        panelCount: count,
        beat: beat.promptLine,
        additionalContext,
      }),
      caption: beat.promptLine.substring(0, 140),
    });
  }

  return panels;
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeLocationSlug(value: string): string {
  return slugify(value.trim(), {
    lower: true,
    strict: true,
    replacement: "-",
  });
}
