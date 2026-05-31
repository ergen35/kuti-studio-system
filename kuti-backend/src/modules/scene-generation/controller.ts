/**
 * Controller Scene Generation - Logique métier
 */

import { db } from "@lib/db";
import { randomUUIDv7 } from "bun";
import { readFile } from "@lib/filesystem";
import { sendGenerateDramaVideoEvent, sendGenerateSceneMangaEvent } from "@lib/inngest";
import type {
  CreateSceneConfigBody,
  UpdateSceneConfigBody,
  GenerateSceneMangaBody,
  PreviewPromptBody,
  UpdateMangaPageBody,
  GenerateDramaVideoBody,
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
  // Vérifier que la scène existe
  const scene = await db.scene.findFirst({
    where: { id: sceneId, projectId },
    include: { tome: true, chapter: true },
  });
  if (!scene) throw new Error("Scene not found");

  // Récupérer la config
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

  // Construire le prompt système
  const systemPrompt = config?.systemPrompt || buildDefaultSystemPrompt();

  // Déterminer le style
  const styleDescription = buildStyleDescription(
    config?.stylePreset || "generic",
    config?.colorMode || "bw"
  );

  // Générer les prévisualisations de panels
  const prompts = generatePanelPreviews(
    scene,
    data.panelCount,
    config,
    data.characterImageRefs
  );

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
  if (page.imageUrl.startsWith("http://") || page.imageUrl.startsWith("https://") || page.imageUrl.startsWith("/api/")) {
    return page.imageUrl;
  }
  return `/api/projects/${projectId}/generation/boards/${page.boardId}/panels/${page.panelId}/image`;
}

function serializeMangaPage(projectId: string, page: Awaited<ReturnType<typeof db.sceneMangaPage.findFirst>> & {}) {
  return {
    ...page,
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

  const updated = await db.sceneMangaPage.update({
    where: { id: pageId },
    data: {
      label: data.label,
      status: data.status,
      imageUrl: data.imageUrl,
      caption: data.caption,
      prompt: data.prompt,
    },
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

// ============================================================================
// Drama Videos
// ============================================================================

function serializeDramaVideo(video: Awaited<ReturnType<typeof db.dramaVideo.findFirst>> & {}) {
  return {
    id: video.id,
    projectId: video.projectId,
    sourceMangaPageId: video.sourceMangaPageId,
    jobId: video.jobId,
    title: video.title,
    prompt: video.prompt,
    modelKey: video.modelKey,
    stylePreset: video.stylePreset,
    status: video.status,
    videoUrl: video.videoUrl,
    durationSeconds: video.durationSeconds,
    metadata: video.metadataJson as Record<string, unknown>,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    completedAt: video.completedAt?.toISOString() ?? null,
    failedAt: video.failedAt?.toISOString() ?? null,
    errorMessage: video.errorMessage,
  };
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function listDramaVideos(projectId: string, sceneId: string) {
  const scene = await db.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) throw new Error("Scene not found");

  const pageIds = await db.sceneMangaPage.findMany({
    where: { projectId, sceneId },
    select: { id: true },
  });
  const currentPageIds = pageIds.map((page) => page.id);

  const videos = await db.dramaVideo.findMany({
    where: {
      projectId,
      OR: [
        { sourceMangaPageId: { in: currentPageIds } },
        { metadataJson: { path: ["sceneId"], equals: sceneId } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return videos.map(serializeDramaVideo);
}

export async function listMangaPageDramaVideos(projectId: string, sceneId: string, pageId: string) {
  const page = await db.sceneMangaPage.findFirst({ where: { id: pageId, projectId, sceneId } });
  if (!page) throw new Error("Page not found");

  const videos = await db.dramaVideo.findMany({
    where: { projectId, sourceMangaPageId: pageId },
    orderBy: { createdAt: "desc" },
  });

  return videos.map(serializeDramaVideo);
}

export async function generateDramaVideo(
  projectId: string,
  sceneId: string,
  pageId: string,
  data: GenerateDramaVideoBody,
) {
  const [page, scene] = await Promise.all([
    db.sceneMangaPage.findFirst({ where: { id: pageId, projectId, sceneId } }),
    db.scene.findFirst({ where: { id: sceneId, projectId }, include: { tome: true, chapter: true } }),
  ]);

  if (!page) throw new Error("Page not found");
  if (!scene) throw new Error("Scene not found");
  if (page.status !== "selected") throw new Error("Page must be selected before drama generation");

  const prompt = data.prompt || buildDramaVideoPrompt(scene, page);
  const title = data.title || `Drama: ${scene.title} - Page ${page.pageNumber}`;
  const jobId = randomUUIDv7();

  const job = await db.generationJob.create({
    data: {
      id: jobId,
      projectId,
      sourceKind: "manga_page",
      sourceId: pageId,
      sourceLabel: `${scene.tome?.title || "Tome"} > ${scene.chapter?.title || "Chapter"} > ${scene.title} > Page ${page.pageNumber}`,
      strategy: "direct",
      entrypoint: "korean-drama-video",
      title,
      prompt,
      summary: "Queued Korean drama video generation",
      status: "pending",
      progress: 0,
      metadataJson: {
        sceneId,
        pageId,
        modelKey: data.modelKey,
        stylePreset: "korean_drama",
      },
    },
  });

  const video = await db.dramaVideo.create({
    data: {
      projectId,
      sourceMangaPageId: pageId,
      jobId: job.id,
      title,
      prompt,
      modelKey: data.modelKey ?? "",
      stylePreset: "korean_drama",
      status: "queued",
      metadataJson: {
        sceneId,
        tomeId: scene.tomeId,
        chapterId: scene.chapterId,
        sourcePageId: pageId,
        sourceMangaPageId: pageId,
        sourceImageUrl: publicMangaPageImageUrl(projectId, page),
        pageNumber: page.pageNumber,
        pageLabel: page.label,
        pageCaption: page.caption,
        pagePrompt: page.prompt,
        modelKey: data.modelKey,
        stylePreset: "korean_drama",
      },
    },
  });

  await sendGenerateDramaVideoEvent({
    projectId,
    sceneId,
    pageId,
    dramaVideoId: video.id,
    jobId: job.id,
    modelKey: data.modelKey,
    prompt,
  });

  return {
    success: true,
    dramaVideoId: video.id,
    jobId: job.id,
    message: "Drama video generation queued",
  };
}

export async function getDramaVideoFile(projectId: string, sceneId: string, dramaVideoId: string) {
  const video = await db.dramaVideo.findFirst({ where: { id: dramaVideoId, projectId } });
  if (!video?.videoPath) return null;

  const metadata = metadataRecord(video.metadataJson);
  const sourcePage = video.sourceMangaPageId
    ? await db.sceneMangaPage.findFirst({ where: { id: video.sourceMangaPageId, projectId, sceneId } })
    : null;
  const metadataSceneId = metadataString(metadata, "sceneId");
  const metadataProjectId = metadataString(metadata, "projectId");
  const belongsToRouteScene = Boolean(sourcePage) || metadataSceneId === sceneId;
  const belongsToRouteProject = !metadataProjectId || metadataProjectId === projectId;
  if (!belongsToRouteScene || !belongsToRouteProject) return null;

  const content = await readFile(video.videoPath);
  const mimeType = metadataString(metadata, "mimeType") ?? "video/mp4";
  const fileName = metadataString(metadata, "fileName") ?? `${video.id}.mp4`;

  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `inline; filename=\"${fileName}\"`,
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

function buildDefaultSystemPrompt(): string {
  return `You are a professional manga artist. Generate high-quality manga panels that tell the story visually.
Style guidelines:
- Use dynamic compositions with strong visual flow
- Include appropriate manga screentones and effects
- Maintain character consistency across panels
- Focus on emotional expression and atmosphere`;
}

function buildDramaVideoPrompt(
  scene: {
    title: string;
    summary: string;
    content: string;
    location: string;
    tome?: { title: string } | null;
    chapter?: { title: string } | null;
  },
  page: { label: string; caption: string | null; prompt: string | null; pageNumber: number },
) {
  return [
    "Create a cinematic Korean drama style video from the selected manga page.",
    "Use live-action drama aesthetics: emotional close-ups, natural skin tones, realistic wardrobe, soft urban or interior lighting, deliberate pauses, and subtle camera movement.",
    "Preserve the story beat, composition, character emotion, and continuity from the manga page.",
    "Avoid anime/cartoon rendering. The output should feel like a premium Korean television drama adaptation.",
    `Tome: ${scene.tome?.title || "Unknown"}`,
    `Chapter: ${scene.chapter?.title || "Unknown"}`,
    `Scene: ${scene.title}`,
    scene.location ? `Location: ${scene.location}` : "",
    scene.summary ? `Summary: ${scene.summary}` : "",
    scene.content ? `Scene content: ${scene.content.slice(0, 1500)}` : "",
    `Manga page ${page.pageNumber}: ${page.label}`,
    page.caption ? `Caption: ${page.caption}` : "",
    page.prompt ? `Manga prompt: ${page.prompt}` : "",
  ].filter(Boolean).join("\n");
}

function buildStyleDescription(stylePreset: string, colorMode: string): string {
  const styleDescriptions: Record<string, string> = {
    shonen: "Shonen manga style: dynamic action lines, energetic compositions, bold expressions",
    shojo: "Shojo manga style: elegant linework, emotional focus, decorative flourishes",
    seinen: "Seinen manga style: mature themes, detailed artwork, realistic proportions",
    generic: "Generic manga style: clean lines, balanced composition, versatile approach",
  };

  const colorDescriptions: Record<string, string> = {
    bw: "Black and white ink style with screentones",
    color: "Full color illustration",
    spot_color: "Black and white with selective color accents",
  };

  return `${styleDescriptions[stylePreset] || styleDescriptions.generic}. ${colorDescriptions[colorMode] || colorDescriptions.bw}.`;
}

function generatePanelPreviews(
  scene: {
    title: string;
    content: string;
    summary: string;
    location: string;
  },
  panelCount: number,
  config: { stylePreset?: string; colorMode?: string } | null,
  characterImageRefs?: Record<string, string>
): Array<{ panelIndex: number; title: string; prompt: string; caption: string }> {
  const panels: Array<{ panelIndex: number; title: string; prompt: string; caption: string }> = [];

  const content = scene.content || scene.summary || "Scene content";
  const beats = extractVisualBeats(content, scene.title);

  const count = Math.max(1, panelCount);

  for (let i = 0; i < count; i++) {
    const beat = beats[i] || beats[i % beats.length] || `${scene.title} - visual beat ${i + 1}`;

    panels.push({
      panelIndex: i,
      title: `Panel ${i + 1}`,
      prompt: buildPanelPrompt(
        beat,
        scene.location,
        config?.stylePreset || "generic",
        config?.colorMode || "bw",
        characterImageRefs
      ),
      caption: beat.substring(0, 140),
    });
  }

  return panels;
}

function extractVisualBeats(content: string, fallbackTitle: string): string[] {
  const source = content.replace(/\r/g, "").trim();
  if (!source) return [`${fallbackTitle} - visual beat 1`];

  const lineBeats = source
    .split(/\n+/)
    .map(cleanVisualBeat)
    .filter((line) => line.length >= 18 && !isDialogueOnly(line) && !isSoundOnly(line));

  if (lineBeats.length >= 2) return uniqueBeats(lineBeats);

  const paragraphBeats = source
    .split(/\n\s*\n+/)
    .flatMap((paragraph) => paragraph.split(/(?<=[.!?。！？])\s+/))
    .map(cleanVisualBeat)
    .filter((beat) => beat.length >= 18 && !isDialogueOnly(beat) && !isSoundOnly(beat));

  const beats = uniqueBeats([...lineBeats, ...paragraphBeats]);
  return beats.length > 0 ? beats : [`${fallbackTitle} - visual beat 1`];
}

function cleanVisualBeat(value: string): string {
  return value
    .replace(/^[-*•]\s+/, "")
    .replace(/^\[(.+?)\]\s*[-—:]?\s*/u, "$1. ")
    .replace(/[\[\]]/g, "")
    .replace(/\.\s*([.!?])/g, "$1")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function isDialogueOnly(value: string): boolean {
  return /^[A-ZÀ-ÖØ-Þ0-9 _'’.-]{2,}\s*[:：]/.test(value) && value.length < 160;
}

function isSoundOnly(value: string): boolean {
  return /^Son\s*[—:-]/i.test(value) || /^SFX\s*[—:-]/i.test(value);
}

function uniqueBeats(beats: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const beat of beats) {
    const key = beat.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(beat);
  }
  return result;
}

function buildPanelPrompt(
  content: string,
  location: string,
  stylePreset: string,
  colorMode: string,
  characterImageRefs?: Record<string, string>
): string {
  const parts: string[] = [];

  // Style
  const styleInstructions: Record<string, string> = {
    shonen: "Shonen manga style, dynamic action lines, energetic",
    shojo: "Shojo manga style, elegant linework, emotional",
    seinen: "Seinen manga style, detailed, mature",
    generic: "Manga style, clean lines, balanced",
  };

  parts.push(styleInstructions[stylePreset] || styleInstructions.generic);

  // Color mode
  const colorInstructions: Record<string, string> = {
    bw: "Black and white ink with screentones",
    color: "Full color illustration",
    spot_color: "Black and white with spot color accents",
  };

  parts.push(colorInstructions[colorMode] || colorInstructions.bw);

  // Location
  if (location) {
    parts.push(`Setting: ${location}`);
  }

  // Character refs
  if (characterImageRefs && Object.keys(characterImageRefs).length > 0) {
    parts.push("Character references provided");
  }

  // Content
  parts.push(`Scene: ${content}`);

  return parts.join(". ");
}
