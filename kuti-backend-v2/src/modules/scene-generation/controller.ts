/**
 * Controller Scene Generation - Logique métier
 */

import { db } from "@lib/db";
import { sendGenerateSceneMangaEvent } from "@lib/inngest";
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
      entrypoint: "gpt-2-images",
      title: `Manga: ${scene.title}`,
      prompt: "", // Sera rempli par la fonction Inngest
      summary: `Queued with ${data.imageCount} images${config ? `, config: ${config.name}` : ""}`,
      status: "pending",
      progress: 0,
      metadataJson: {
        sceneId,
        configId: config?.id || data.configId,
        requestedImageCount: data.imageCount,
      },
    },
  });

  // Envoyer l'événement à Inngest
  await sendGenerateSceneMangaEvent({
    projectId,
    sceneId,
    configId: config?.id || data.configId,
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

  return pages.map((page) => ({
    ...page,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  }));
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

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
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

  // Découper le contenu en segments pour chaque panel
  const content = scene.content || scene.summary || "Scene content";
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const count = Math.min(panelCount, Math.max(3, sentences.length));

  for (let i = 0; i < count; i++) {
    const sentence = sentences[i] || `Panel ${i + 1}`;

    panels.push({
      panelIndex: i,
      title: `Panel ${i + 1}`,
      prompt: buildPanelPrompt(
        sentence,
        scene.location,
        config?.stylePreset || "generic",
        config?.colorMode || "bw",
        characterImageRefs
      ),
      caption: sentence.substring(0, 100),
    });
  }

  return panels;
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
