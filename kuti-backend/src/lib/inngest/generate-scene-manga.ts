/**
 * Fonction Inngest pour la génération de manga de scène
 * Remplace le background thread de génération de scène du backend v1
 */

import { randomUUIDv7 } from "bun";
import { db } from "../db";
import type { GenerationJobStatus, GenerationSourceKind, GenerationStepStatus } from "../db/generated/enums";
import { getFileStats, writeFile } from "../filesystem";
import { generateImage } from "../model-providers";
import { getProjectDir } from "../paths";
import { inngest } from "./client";

type CharacterForPrompt = {
  id: string;
  name: string;
  description: string;
  images?: Array<{ filePath: string; publicUrl: string; fileName: string }>;
};

type SelectedImageForPrompt = {
  id: string;
  characterId: string;
  filePath: string;
  publicUrl: string;
  fileName: string;
};

// ============================================================================
// Fonction Inngest
// ============================================================================

export const generateSceneMangaFunction = inngest.createFunction(
  {
    id: "generate-scene-manga",
    name: "Generate Scene Manga",
    retries: 1,
    triggers: [{ event: "kuti/generate-scene-manga" }],
  },
  async ({ event, step }) => {
    const { projectId, sceneId, jobId, configId, modelKey, imageCount, characterImageRefs, additionalContext } = event.data;

    // ============================================================================
    // Step 1: Récupérer le contexte (scène, projet, config)
    // ============================================================================
    const context = await step.run("fetch-context", async () => {
      const [scene, project, sceneConfig] = await Promise.all([
        db.scene.findUnique({
          where: { id: sceneId },
          include: {
            tome: true,
            chapter: true,
          },
        }),
        db.project.findUnique({ where: { id: projectId } }),
        configId
          ? db.sceneGenerationConfig.findUnique({ where: { id: configId } })
          : db.sceneGenerationConfig.findFirst({
              where: { projectId, isDefault: true },
            }),
      ]);

      if (!scene) throw new Error(`Scene ${sceneId} not found`);
      if (!project) throw new Error(`Project ${projectId} not found`);

      const sceneCharacterRefs = jsonStringArray(scene.charactersJson);
      const selectedCharacterIds = Object.keys(characterImageRefs ?? {});
      const selectedImageIds = Object.values(characterImageRefs ?? {}).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      );
      const characterLookupValues = Array.from(new Set([...sceneCharacterRefs, ...selectedCharacterIds]));

      const characterDetails: CharacterForPrompt[] = characterLookupValues.length > 0
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
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
          })
        : [];

      const selectedImages: SelectedImageForPrompt[] = selectedImageIds.length > 0
        ? await db.characterImage.findMany({ where: { projectId, id: { in: selectedImageIds } } })
        : [];

      return { scene, project, sceneConfig, characterDetails, selectedImages };
    });

    const { scene, project, sceneConfig, characterDetails, selectedImages } = context;

    // ============================================================================
    // Step 2: Utiliser le job créé par l'API
    // ============================================================================
    const job = await step.run("mark-generation-job-running", async () => {
      const existing = await db.generationJob.findFirst({ where: { id: jobId, projectId, sourceId: sceneId } });
      if (!existing) throw new Error(`Generation job ${jobId} not found`);

      return await db.generationJob.update({
        where: { id: existing.id },
        data: {
          sourceKind: "scene" as GenerationSourceKind,
          sourceLabel: `${scene.tome?.title || "Tome"} > ${scene.chapter?.title || "Chapter"} > ${scene.title}`,
          strategy: "intermediate",
          entrypoint: modelKey || "gpt_images_2",
          title: `Manga: ${scene.title}`,
          prompt: buildScenePrompt(scene, characterDetails, additionalContext),
          summary: "",
          status: "running" as GenerationJobStatus,
          progress: 5,
          metadataJson: {
            ...(existing.metadataJson as Record<string, unknown>),
            sceneId,
            configId: sceneConfig?.id,
            modelKey,
            characterCount: characterDetails.length,
          },
        },
      });
    });

    // ============================================================================
    // Step 3: Générer le storyboard (découper en panels)
    // ============================================================================
    const storyboard = await step.run("generate-storyboard", async () => {
      // Simuler un storyboard basé sur le contenu de la scène
      // Dans une vraie implémentation, on pourrait appeler une API LLM
      const panels = generatePanelsFromContent(scene.content || scene.summary, imageCount || 6, scene.title);

      await db.generationJob.update({
        where: { id: job.id },
        data: { progress: 15 },
      });

      return panels;
    });

    // ============================================================================
    // Step 4: Créer le board et les steps
    // ============================================================================
    const board = await step.run("create-board", async () => {
      const newBoard = await db.generationBoard.create({
        data: {
          projectId,
          jobId: job.id,
          sourceKind: "scene" as GenerationSourceKind,
          strategy: "intermediate",
          title: `Manga: ${scene.title}`,
          summary: scene.summary || "",
          status: "draft",
          metadataJson: {
            sceneId,
            tomeId: scene.tomeId,
            chapterId: scene.chapterId,
          },
        },
      });

      // Créer les panels du board
      for (let i = 0; i < storyboard.length; i++) {
        const panel = storyboard[i];
        await db.generationBoardPanel.create({
          data: {
            boardId: newBoard.id,
            orderIndex: i,
            title: panel.title,
            caption: panel.caption,
            prompt: panel.prompt,
            status: "draft",
            imagePath: "",
            imageName: "",
            metadataJson: {
              description: panel.description,
            },
          },
        });
      }

      // Créer les steps du job
      for (let i = 0; i < storyboard.length; i++) {
        await db.generationJobStep.create({
          data: {
            jobId: job.id,
            orderIndex: i,
            title: `Panel ${i + 1}: ${storyboard[i].title}`,
            status: "pending" as GenerationStepStatus,
            prompt: storyboard[i].prompt,
          },
        });
      }

      return newBoard;
    });

    // ============================================================================
    // Step 5: Générer chaque image de panel
    // ============================================================================
    const panels = await db.generationBoardPanel.findMany({
      where: { boardId: board.id },
      orderBy: { orderIndex: "asc" },
    });

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];

      await step.run(`generate-panel-${i}`, async () => {
        // Mettre à jour le step correspondant
        const stepRecord = await db.generationJobStep.findFirst({
          where: { jobId: job.id, orderIndex: i },
        });

        if (stepRecord) {
          await db.generationJobStep.update({
            where: { id: stepRecord.id },
            data: { status: "running" as GenerationStepStatus },
          });
        }

        try {
          // Construire le prompt amélioré avec les refs de personnages
          const prompt = buildPanelPrompt(panel.prompt, characterDetails, characterImageRefs, selectedImages, sceneConfig);

          const generatedImage = await generateImage(prompt, {
            modelKey,
            size: "1024x1536",
            timeoutSeconds: 180,
          });

          // Sauvegarder l'image
          const fileName = `panel-${panel.orderIndex}_${randomUUIDv7("base64url")}${generatedImage.fileExtension}`;
          const filePath = `${getProjectDir(project.slug)}/generation/${job.id}/${fileName}`;

          await writeFile(filePath, generatedImage.content);

          const stats = await getFileStats(filePath);

          // Mettre à jour le panel
          await db.generationBoardPanel.update({
            where: { id: panel.id },
            data: {
              imagePath: filePath,
              imageName: fileName,
              metadataJson: {
                ...(panel.metadataJson as Record<string, unknown>),
                mimeType: generatedImage.mimeType,
                sizeBytes: stats.size,
              },
            },
          });

          // Mettre à jour le step
          if (stepRecord) {
            await db.generationJobStep.update({
              where: { id: stepRecord.id },
              data: {
                status: "ready" as GenerationStepStatus,
                artifactPath: filePath,
                artifactName: fileName,
                metadataJson: {
                  ...(stepRecord.metadataJson as Record<string, unknown>),
                  mimeType: generatedImage.mimeType,
                  sizeBytes: stats.size,
                },
                completedAt: new Date(),
              },
            });
          }

          return { success: true, panelId: panel.id };
        } catch (error) {
          // Mettre à jour le step en erreur
          if (stepRecord) {
            await db.generationJobStep.update({
              where: { id: stepRecord.id },
              data: {
                status: "failed" as GenerationStepStatus,
                failedAt: new Date(),
                errorMessage: error instanceof Error ? error.message : "Unknown error",
              },
            });
          }

          return { success: false, panelId: panel.id, error: String(error) };
        }
      });

      // Mettre à jour la progression
      const progress = 15 + Math.floor(((i + 1) / panels.length) * 75);
      await step.run(`update-progress-${i}`, async () => {
        await db.generationJob.update({
          where: { id: job.id },
          data: { progress },
        });
      });
    }

    // ============================================================================
    // Step 6: Créer les SceneMangaPage
    // ============================================================================
    await step.run("create-manga-pages", async () => {
      const updatedPanels = await db.generationBoardPanel.findMany({
        where: { boardId: board.id },
        orderBy: { orderIndex: "asc" },
      });

      for (let i = 0; i < updatedPanels.length; i++) {
        const panel = updatedPanels[i];
        if (panel.imagePath) {
          await db.sceneMangaPage.create({
            data: {
              projectId,
              sceneId,
              tomeId: scene.tomeId,
              chapterId: scene.chapterId,
              jobId: job.id,
              boardId: board.id,
              panelId: panel.id,
              pageNumber: i + 1,
              label: panel.title,
              status: "draft",
              imageUrl: panel.imagePath,
              caption: panel.caption,
              prompt: panel.prompt,
            },
          });
        }
      }
    });

    // ============================================================================
    // Step 7: Finaliser le job
    // ============================================================================
    await step.run("finalize-job", async () => {
      const allSteps = await db.generationJobStep.findMany({
        where: { jobId: job.id },
      });

      const failedSteps = allSteps.filter((s) => s.status === "failed");
      const successSteps = allSteps.filter((s) => s.status === "ready");

      if (failedSteps.length > 0 && successSteps.length === 0) {
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: "failed" as GenerationJobStatus,
            progress: 100,
            failedAt: new Date(),
            errorMessage: `All ${failedSteps.length} panel generations failed`,
          },
        });
      } else {
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: "ready" as GenerationJobStatus,
            progress: 100,
            completedAt: new Date(),
            summary: `Generated ${successSteps.length}/${panels.length} panels`,
          },
        });
      }
    });

    return {
      success: true,
      jobId: job.id,
      boardId: board.id,
      panelsGenerated: panels.length,
    };
  },
);

// ============================================================================
// Helpers
// ============================================================================

function buildScenePrompt(
  scene: {
    title: string;
    content: string;
    summary: string;
    location: string;
  },
  characters: Array<{ name: string; description: string }>,
  additionalContext?: string,
): string {
  const parts: string[] = [];

  parts.push(`Scene: ${scene.title}`);

  if (scene.summary) {
    parts.push(`Summary: ${scene.summary}`);
  }

  if (scene.location) {
    parts.push(`Location: ${scene.location}`);
  }

  if (characters.length > 0) {
    parts.push(`Characters: ${characters.map((c) => `${c.name}${c.description ? ` (${c.description})` : ""}`).join(", ")}`);
  }

  if (scene.content) {
    parts.push(`Content:\n${scene.content.substring(0, 2000)}`);
  }

  if (additionalContext) {
    parts.push(`Additional context: ${additionalContext}`);
  }

  return parts.join("\n\n");
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildPanelPrompt(
  basePrompt: string,
  characters: Array<{
    id: string;
    name: string;
    description: string;
    images?: Array<{ filePath: string; publicUrl: string; fileName: string }>;
  }>,
  characterImageRefs?: Record<string, string>,
  selectedImages?: Array<{ id: string; characterId: string; filePath: string; publicUrl: string; fileName: string }>,
  config?: {
    systemPrompt?: string;
    stylePreset?: string;
    colorMode?: string;
  } | null,
): string {
  const parts: string[] = [];

  // System prompt si configuré
  if (config?.systemPrompt) {
    parts.push(config.systemPrompt);
  }

  // Instructions de style manga
  parts.push("Manga panel illustration, professional quality.");

  // Mode couleur
  if (config?.colorMode === "bw") {
    parts.push("Black and white ink style, manga screentone.");
  } else if (config?.colorMode === "color") {
    parts.push("Full color illustration, vibrant.");
  } else if (config?.colorMode === "spot_color") {
    parts.push("Spot color style, limited palette.");
  }

  // Style preset
  switch (config?.stylePreset) {
    case "shonen":
      parts.push("Shonen manga style, dynamic action lines.");
      break;
    case "shojo":
      parts.push("Shojo manga style, elegant and emotional.");
      break;
    case "seinen":
      parts.push("Seinen manga style, detailed and mature.");
      break;
    default:
      parts.push("Generic manga style.");
  }

  // Références des personnages (si disponibles)
  const selectedImageById = new Map((selectedImages ?? []).map((image) => [image.id, image]));
  if (characters.length > 0) {
    parts.push("Character references:");
    for (const char of characters) {
      const selectedImageId = characterImageRefs?.[char.id];
      const selectedImage = selectedImageId ? selectedImageById.get(selectedImageId) : null;
      const fallbackImage = char.images?.[0] ?? null;
      const imageRef = selectedImage?.publicUrl || selectedImage?.filePath || fallbackImage?.publicUrl || fallbackImage?.filePath || "no visual reference selected";
      parts.push(`- ${char.name}${char.description ? ` (${char.description})` : ""}: ${imageRef}`);
    }
  }

  // Prompt principal
  parts.push(`\nScene description: ${basePrompt}`);

  return parts.join("\n");
}

interface PanelDefinition {
  title: string;
  caption: string;
  prompt: string;
  description: string;
}

function generatePanelsFromContent(content: string, targetCount: number, sceneTitle = "Scene"): PanelDefinition[] {
  const beats = extractVisualBeats(content, sceneTitle);

  const panels: PanelDefinition[] = [];
  const count = Math.max(1, targetCount);

  for (let i = 0; i < count; i++) {
    const beat = beats[i] || beats[i % beats.length] || `${sceneTitle} - visual beat ${i + 1}`;
    panels.push({
      title: `Panel ${i + 1}`,
      caption: beat.substring(0, 140),
      prompt: `Illustrate this manga story beat: ${beat}`,
      description: beat,
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
