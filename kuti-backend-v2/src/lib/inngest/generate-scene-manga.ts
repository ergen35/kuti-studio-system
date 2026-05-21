/**
 * Fonction Inngest pour la génération de manga de scène
 * Remplace le background thread de génération de scène du backend v1
 */

import { randomUUIDv7 } from "bun";
import { resolveModelProvider } from "../config";
import { db } from "../db";
import type { GenerationJobStatus, GenerationSourceKind, GenerationStepStatus } from "../db/generated/enums";
import { getFileStats, writeFile } from "../filesystem";
import { inngest } from "./client";
import { getProjectDir } from "../paths";

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
    const { projectId, sceneId, configId, imageCount, characterImageRefs, additionalContext } = event.data;

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

      // Récupérer les personnages de la scène
      const characters = scene.charactersJson as string[];
      const characterDetails =
        characters.length > 0
          ? await db.character.findMany({
              where: {
                id: { in: characters },
                projectId,
              },
              include: {
                images: {
                  take: 1,
                  orderBy: { createdAt: "desc" },
                },
              },
            })
          : [];

      return { scene, project, sceneConfig, characterDetails };
    });

    const { scene, project, sceneConfig, characterDetails } = context;

    // ============================================================================
    // Step 2: Créer un job de génération
    // ============================================================================
    const job = await step.run("create-generation-job", async () => {
      return await db.generationJob.create({
        data: {
          projectId,
          sourceKind: "scene" as GenerationSourceKind,
          sourceId: sceneId,
          sourceLabel: `${scene.tome?.title || "Tome"} > ${scene.chapter?.title || "Chapter"} > ${scene.title}`,
          sourceVersionId: null,
          strategy: "intermediate",
          entrypoint: "gpt-2-images",
          title: `Manga: ${scene.title}`,
          prompt: buildScenePrompt(scene, characterDetails, additionalContext),
          summary: "",
          status: "running" as GenerationJobStatus,
          progress: 5,
          metadataJson: {
            sceneId,
            configId: sceneConfig?.id,
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
      const panels = generatePanelsFromContent(scene.content, imageCount || 6);

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
    const provider = resolveModelProvider(undefined, "image");
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
          const prompt = buildPanelPrompt(panel.prompt, characterDetails, characterImageRefs, sceneConfig);

          // Appeler l'API de génération
          const imageData = await callImageGenerationAPI(provider, prompt);

          // Sauvegarder l'image
          const ext = ".png";
          const fileName = `panel-${panel.orderIndex}_${randomUUIDv7("base64url")}${ext}`;
          const filePath = `${getProjectDir(project.slug)}/generation/${job.id}/${fileName}`;

          await writeFile(filePath, imageData);

          const stats = await getFileStats(filePath);

          // Mettre à jour le panel
          await db.generationBoardPanel.update({
            where: { id: panel.id },
            data: {
              imagePath: filePath,
              imageName: fileName,
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

function buildPanelPrompt(
  basePrompt: string,
  characters: Array<{ name: string; description: string }>,
  characterImageRefs?: Record<string, string>,
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
  if (characterImageRefs && Object.keys(characterImageRefs).length > 0) {
    parts.push("Character references:");
    for (const [charId, imageRef] of Object.entries(characterImageRefs)) {
      const char = characters.find((c) => c.id === charId);
      if (char) {
        parts.push(`- ${char.name}: ${imageRef}`);
      }
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

function generatePanelsFromContent(content: string, targetCount: number): PanelDefinition[] {
  // Découper le contenu en segments
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const panels: PanelDefinition[] = [];
  const count = Math.min(targetCount, Math.max(3, sentences.length));

  for (let i = 0; i < count; i++) {
    const sentence = sentences[i] || `Scene part ${i + 1}`;
    panels.push({
      title: `Panel ${i + 1}`,
      caption: sentence.substring(0, 100),
      prompt: `Illustrate this moment: ${sentence}`,
      description: sentence,
    });
  }

  return panels;
}

async function callImageGenerationAPI(
  provider: {
    baseUrl: string | null;
    apiKey: string | null;
    apiModel: string | null;
  },
  prompt: string,
): Promise<Buffer> {
  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error("Provider not configured");
  }

  const response = await fetch(`${provider.baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.apiModel || "gpt-image-2",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Image generation failed: ${error}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const imageData = result.data[0];

  if (imageData.b64_json) {
    return Buffer.from(imageData.b64_json, "base64");
  }

  if (imageData.url) {
    const imageResponse = await fetch(imageData.url);
    if (!imageResponse.ok) {
      throw new Error("Failed to download generated image");
    }
    return Buffer.from(await imageResponse.arrayBuffer());
  }

  throw new Error("No image data received from API");
}
