/**
 * Fonction Inngest pour la génération d'images de personnages
 * Remplace le background thread de génération du backend v1
 */

import { config, resolveModelProvider } from "../config";
import { db } from "../db";
import type { GenerationJobStatus, GenerationStepStatus } from "../db/generated/enums";
import { saveCharacterImage } from "../filesystem";
import { buildCharacterImagePrompt, selectActiveCharacterSheet } from "../manga-prompts";
import { inngest } from "./client";

// ============================================================================
// Fonction Inngest
// ============================================================================

export const generateImageFunction = inngest.createFunction(
  {
    id: "generate-character-image",
    name: "Generate Character Image",
    retries: 2,
    triggers: [{ event: "kuti/generate-image" }],
  },
  async ({ event, step }) => {
    const {
      projectId,
      characterId,
      jobId,
      kind,
      strategy,
      style,
      imageCount,
      modelKey,
    } = event.data;

    // ============================================================================
    // Step 1: Récupérer les informations du job et du personnage
    // ============================================================================
    const context = await step.run("fetch-context", async () => {
      const [job, character, project] = await Promise.all([
        db.generationJob.findUnique({ where: { id: jobId } }),
        db.character.findUnique({
          where: { id: characterId },
          include: { images: true },
        }),
        db.project.findUnique({ where: { id: projectId } }),
      ]);

      if (!job) throw new Error(`Job ${jobId} not found`);
      if (!character) throw new Error(`Character ${characterId} not found`);
      if (!project) throw new Error(`Project ${projectId} not found`);

      const activeCharacterSheet =
        selectActiveCharacterSheet(character.images);

      return { job, character, project, activeCharacterSheet };
    });

    const { job, character, project, activeCharacterSheet } = context;
    void job;
    void project;

    const totalCount = kind === "character_sheet" ? 1 : Math.min(Math.max(imageCount || 4, 1), 12);

    // ============================================================================
    // Step 2: Mettre à jour le statut du job à "running"
    // ============================================================================
    await step.run("update-job-running", async () => {
      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: "running" as GenerationJobStatus,
          progress: 10,
        },
      });
    });

    // ============================================================================
    // Step 3: Créer les steps pour chaque image à générer
    // ============================================================================
    const steps: Array<{ id: string; index: number }> = [];
    const promptPlans = Array.from({ length: totalCount }, (_, index) => ({
      index,
      prompt: buildCharacterImagePrompt({
        character,
        kind,
        strategy,
        style,
        activeCharacterSheet,
        variationIndex: index,
        totalCount,
      }),
    }));

    for (const plan of promptPlans) {
      const stepRecord = await step.run(`create-step-${plan.index}`, async () => {
        return await db.generationJobStep.create({
          data: {
            jobId,
            orderIndex: plan.index,
            title:
              kind === "character_sheet"
                ? "Character sheet"
                : `Variation ${plan.index + 1}`,
            status: "pending" as GenerationStepStatus,
            prompt: plan.prompt,
          },
        });
      });
      steps.push({ id: stepRecord.id, index: plan.index });
    }

    // ============================================================================
    // Step 4: Générer chaque image
    // ============================================================================
    const provider = resolveModelProvider(modelKey, "image");
    const generatedImages: Array<{
      stepId: string;
      prompt: string;
      filePath: string;
      publicUrl: string;
      fileName: string;
      fileSize: number;
      variationIndex: number;
      sourceImageId: string | null;
    }> = [];

    for (const { id: stepId, index } of steps) {
      const result = await step.run(`generate-image-${index}`, async (): Promise<{
        stepId: string;
        prompt: string;
        filePath: string;
        publicUrl: string;
        fileName: string;
        fileSize: number;
        variationIndex: number;
        sourceImageId: string | null;
      }> => {
        // Mettre à jour le step à "running"
        await db.generationJobStep.update({
          where: { id: stepId },
          data: { status: "running" as GenerationStepStatus },
        });

        try {
          // Construire le prompt
          const prompt = buildCharacterImagePrompt({
            character,
            kind,
            strategy,
            style,
            activeCharacterSheet,
            variationIndex: index,
            totalCount,
          });

          // Appeler l'API de génération d'images
          const imageData = await callImageGenerationAPI(provider, prompt, style);

          // Sauvegarder l'image
          const saved = await saveCharacterImage(projectId, characterId, imageData, {
            kind,
            strategy: kind === "character_sheet" ? "sheet" : strategy,
            style,
            variationIndex: kind === "character_sheet" ? undefined : index,
          });

          // Mettre à jour le step à "ready"
          await db.generationJobStep.update({
            where: { id: stepId },
            data: {
              status: "ready" as GenerationStepStatus,
              artifactPath: saved.filePath,
              artifactName: saved.fileName,
              completedAt: new Date(),
            },
          });

          return {
            stepId,
            prompt,
            filePath: saved.filePath,
            publicUrl: saved.publicUrl,
            fileName: saved.fileName,
            fileSize: saved.fileSize,
            variationIndex: index,
            sourceImageId:
              kind === "free_image" && activeCharacterSheet
                ? activeCharacterSheet.id ?? null
                : null,
          };
        } catch (error) {
          // Mettre à jour le step à "failed"
          await db.generationJobStep.update({
            where: { id: stepId },
            data: {
              status: "failed" as GenerationStepStatus,
              failedAt: new Date(),
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            },
          });
          throw error;
        }
      });

      generatedImages.push(result);

      // Mettre à jour la progression
      const progress = 10 + Math.floor(((index + 1) / totalCount) * 70);
      await step.run(`update-progress-${index}`, async () => {
        await db.generationJob.update({
          where: { id: jobId },
          data: { progress },
        });
      });
    }

    // ============================================================================
    // Step 5: Créer les records CharacterImage
    // ============================================================================
    await step.run("create-character-images", async () => {
      await db.$transaction(async (tx) => {
        for (const img of generatedImages) {
          const created = await tx.characterImage.create({
            data: {
              projectId,
              characterId,
              kind,
              isActive: true,
              sourceImageId: img.sourceImageId,
              boardPanelId: null,
              filePath: img.filePath,
              publicUrl: img.publicUrl,
              fileName: img.fileName,
              fileSize: img.fileSize,
              mimeType: "image/png",
              prompt: img.prompt,
              strategy: kind === "character_sheet" ? "sheet" : strategy,
              style,
              variationIndex: kind === "character_sheet" ? null : img.variationIndex,
            },
          });

          if (kind === "character_sheet") {
            await tx.characterImage.updateMany({
              where: {
                projectId,
                characterId,
                kind: "character_sheet",
                isActive: true,
                id: { not: created.id },
              },
              data: { isActive: false },
            });
          }
        }
      });
    });

    // ============================================================================
    // Step 6: Finaliser le job
    // ============================================================================
    await step.run("finalize-job", async () => {
      const allSteps = await db.generationJobStep.findMany({
        where: { jobId },
      });

      const failedSteps = allSteps.filter((s) => s.status === "failed");
      const successSteps = allSteps.filter((s) => s.status === "ready");

      if (failedSteps.length > 0 && successSteps.length === 0) {
        // Tous les steps ont échoué
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "failed" as GenerationJobStatus,
            progress: 100,
            failedAt: new Date(),
            errorMessage: `All ${failedSteps.length} generation steps failed`,
          },
        });
      } else {
        // Au moins une image générée avec succès
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "ready" as GenerationJobStatus,
            progress: 100,
            completedAt: new Date(),
            summary:
              kind === "character_sheet"
                ? "Generated character sheet"
                : `Generated ${successSteps.length}/${totalCount} free images`,
          },
        });
      }
    });

    return {
      success: true,
      jobId,
      generatedCount: generatedImages.length,
      images: generatedImages.map((img) => ({
        filePath: img.filePath,
        fileName: img.fileName,
        variationIndex: img.variationIndex,
      })),
    };
  },
);

// ============================================================================
// Helpers
// ============================================================================

async function callImageGenerationAPI(
  provider: {
    baseUrl: string | null;
    apiKey: string | null;
    apiModel: string | null;
  },
  prompt: string,
  style?: string,
): Promise<Buffer> {
  if (!provider.baseUrl || !provider.apiKey) {
    throw new Error("Provider not configured");
  }

  const baseUrl = provider.baseUrl.replace(/\/$/, "");
  const urlPath = config.gptImages2UrlPath;
  const requestUrl = `${baseUrl}${urlPath}`;

  const requestBody = {
    model: provider.apiModel || "gpt-image-2",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
    style: style || "vivid",
  };

  let response;
  try {
    response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (fetchError) {
    throw new Error(`Network error during fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image generation failed: HTTP ${response.status} - ${errorText || "No error message"}`);
  }

  let result;
  try {
    result = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };
  } catch (jsonError) {
    throw new Error(`Failed to parse API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
  }

  const imageData = result.data[0];

  if (!imageData) {
    throw new Error("No image data received from API - empty data array");
  }

  if (imageData.b64_json) {
    try {
      return Buffer.from(imageData.b64_json, "base64");
    } catch (bufferError) {
      throw new Error(`Failed to decode base64 image: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`);
    }
  }

  if (imageData.url) {
    try {
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download generated image: HTTP ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (downloadError) {
      throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
    }
  }

  throw new Error("No image data received from API - missing b64_json and url");
}
