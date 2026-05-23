/**
 * Fonction Inngest pour la génération d'images de personnages
 * Remplace le background thread de génération du backend v1
 */

import { config, resolveModelProvider } from "../config";
import { db } from "../db";
import type { GenerationJobStatus, GenerationStepStatus } from "../db/generated/enums";
import { saveCharacterImage } from "../filesystem";
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
    const { projectId, characterId, jobId, strategy, style, imageCount, modelKey } = event.data;

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

      return { job, character, project };
    });

    const { job, character, project } = context;

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
    const count = imageCount || 4;

    for (let i = 0; i < count; i++) {
      const stepRecord = await step.run(`create-step-${i}`, async () => {
        return await db.generationJobStep.create({
          data: {
            jobId,
            orderIndex: i,
            title: `Variation ${i + 1}`,
            status: "pending" as GenerationStepStatus,
            prompt: buildCharacterPrompt(character, strategy, style),
          },
        });
      });
      steps.push({ id: stepRecord.id, index: i });
    }

    // ============================================================================
    // Step 4: Générer chaque image
    // ============================================================================
    const provider = resolveModelProvider(modelKey, "image");
    const generatedImages: Array<{
      stepId: string;
      filePath: string;
      publicUrl: string;
      fileName: string;
      fileSize: number;
      variationIndex: number;
    }> = [];

    for (const { id: stepId, index } of steps) {
      const result = await step.run(`generate-image-${index}`, async () => {
        // Mettre à jour le step à "running"
        await db.generationJobStep.update({
          where: { id: stepId },
          data: { status: "running" as GenerationStepStatus },
        });

        try {
          // Construire le prompt
          const prompt = buildCharacterPrompt(character, strategy, style);

          // Appeler l'API de génération d'images
          const imageData = await callImageGenerationAPI(provider, prompt, style);

          // Sauvegarder l'image
          const saved = await saveCharacterImage(projectId, characterId, imageData, strategy, style, index);

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
            filePath: saved.filePath,
            publicUrl: saved.publicUrl,
            fileName: saved.fileName,
            fileSize: saved.fileSize,
            variationIndex: index,
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
      const progress = 10 + Math.floor(((index + 1) / count) * 70);
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
      for (const img of generatedImages) {
        await db.characterImage.create({
          data: {
            projectId,
            characterId,
            filePath: img.filePath,
            publicUrl: img.publicUrl,
            fileName: img.fileName,
            fileSize: img.fileSize,
            mimeType: "image/png",
            prompt: buildCharacterPrompt(character, strategy, style),
            strategy,
            style,
            variationIndex: img.variationIndex,
          },
        });
      }
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
            summary: `Generated ${successSteps.length}/${count} images`,
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

function buildCharacterPrompt(
  character: {
    name: string;
    alias?: string | null;
    description: string;
    physicalDescription: string;
    personality: string;
    colorPaletteJson: unknown;
    costumeElementsJson: unknown;
  },
  strategy: string,
  style?: string,
): string {
  const parts: string[] = [];

  // Nom et identité
  parts.push(`Character: ${character.name}`);
  if (character.alias) {
    parts.push(`Also known as: ${character.alias}`);
  }

  // Description
  if (character.description) {
    parts.push(`Description: ${character.description}`);
  }

  // Apparence physique
  if (character.physicalDescription) {
    parts.push(`Physical appearance: ${character.physicalDescription}`);
  }

  // Personnalité
  if (character.personality) {
    parts.push(`Personality: ${character.personality}`);
  }

  // Palette de couleurs
  const colors = character.colorPaletteJson as string[];
  if (colors && colors.length > 0) {
    parts.push(`Color palette: ${colors.join(", ")}`);
  }

  // Éléments de costume
  const costumeElements = character.costumeElementsJson as string[];
  if (costumeElements && costumeElements.length > 0) {
    parts.push(`Costume elements: ${costumeElements.join(", ")}`);
  }

  // Style spécifique
  if (style) {
    parts.push(`Style: ${style}`);
  }

  // Instructions selon la stratégie
  switch (strategy) {
    case "portrait":
      parts.push("Generate a character portrait, head and shoulders, facing forward.");
      break;
    case "full_body":
      parts.push("Generate a full body character illustration, standing pose.");
      break;
    case "expression":
      parts.push("Generate an expressive close-up of the character face showing emotion.");
      break;
    case "action":
      parts.push("Generate the character in an action pose, dynamic composition.");
      break;
    default:
      parts.push("Generate a detailed character illustration.");
  }

  // Style manga
  parts.push("Manga/anime art style, detailed, high quality.");

  return parts.join("\n");
}

async function callImageGenerationAPI(
  provider: {
    baseUrl: string | null;
    apiKey: string | null;
    apiModel: string | null;
  },
  prompt: string,
  style?: string,
): Promise<Buffer> {
  console.log("[callImageGenerationAPI] Starting image generation call");
  console.log(`[callImageGenerationAPI] Provider baseUrl: ${provider.baseUrl ? provider.baseUrl : "NOT SET"}`);
  console.log(`[callImageGenerationAPI] Provider apiKey: ${provider.apiKey ? "set (" + provider.apiKey + ")" : "NOT SET"}`);
  console.log(`[callImageGenerationAPI] Provider apiModel: ${provider.apiModel || "default (gpt-image-2)"}`);
  console.log(`[callImageGenerationAPI] Style: ${style || "default (vivid)"}`);
  console.log(`[callImageGenerationAPI] Prompt length: ${prompt.length} characters`);

  if (!provider.baseUrl || !provider.apiKey) {
    console.error("[callImageGenerationAPI] ERROR: Provider not configured");
    throw new Error("Provider not configured");
  }

  const baseUrl = provider.baseUrl.replace(/\/$/, "");
  const urlPath = config.gptImages2UrlPath;
  const requestUrl = `${baseUrl}${urlPath}`;
  console.log(`[callImageGenerationAPI] Sending POST request to: ${requestUrl}`);

  const requestBody = {
    model: provider.apiModel || "gpt-image-2",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "high",
    style: style || "vivid",
  };
  console.log(`[callImageGenerationAPI] Request body: ${JSON.stringify(requestBody, null, 2)}`);

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
    console.log(`[callImageGenerationAPI] Response received - Status: ${response.status} ${response.statusText}`);
  } catch (fetchError) {
    console.error("[callImageGenerationAPI] FETCH ERROR:", fetchError);
    throw new Error(`Network error during fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[callImageGenerationAPI] ERROR - Response not OK`);
    console.error(`[callImageGenerationAPI] Status: ${response.status} ${response.statusText}`);
    console.error(`[callImageGenerationAPI] Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
    console.error(`[callImageGenerationAPI] Response body: ${errorText}`);
    throw new Error(`Image generation failed: HTTP ${response.status} - ${errorText || "No error message"}`);
  }

  console.log("[callImageGenerationAPI] Response OK, parsing JSON...");
  let result;
  try {
    result = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };
    console.log("[callImageGenerationAPI] Response parsed successfully");
    console.log(`[callImageGenerationAPI] Result has ${result.data?.length || 0} image(s)`);
  } catch (jsonError) {
    console.error("[callImageGenerationAPI] JSON PARSE ERROR:", jsonError);
    throw new Error(`Failed to parse API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
  }

  const imageData = result.data[0];

  if (!imageData) {
    console.error("[callImageGenerationAPI] ERROR: No image data in response");
    console.error(`[callImageGenerationAPI] Full result: ${JSON.stringify(result)}`);
    throw new Error("No image data received from API - empty data array");
  }

  console.log(`[callImageGenerationAPI] Image data received - has b64_json: ${!!imageData.b64_json}, has url: ${!!imageData.url}`);

  if (imageData.b64_json) {
    console.log("[callImageGenerationAPI] Processing base64 image data");
    try {
      const buffer = Buffer.from(imageData.b64_json, "base64");
      console.log(`[callImageGenerationAPI] Base64 decoded successfully - buffer size: ${buffer.length} bytes`);
      return buffer;
    } catch (bufferError) {
      console.error("[callImageGenerationAPI] BUFFER ERROR (base64):", bufferError);
      throw new Error(`Failed to decode base64 image: ${bufferError instanceof Error ? bufferError.message : String(bufferError)}`);
    }
  }

  if (imageData.url) {
    console.log(`[callImageGenerationAPI] Processing URL image: ${imageData.url}`);
    try {
      const imageResponse = await fetch(imageData.url);
      console.log(`[callImageGenerationAPI] Image download response - Status: ${imageResponse.status}`);
      if (!imageResponse.ok) {
        console.error(`[callImageGenerationAPI] Failed to download image from URL: ${imageResponse.status} ${imageResponse.statusText}`);
        throw new Error(`Failed to download generated image: HTTP ${imageResponse.status}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`[callImageGenerationAPI] Image downloaded successfully - size: ${buffer.length} bytes`);
      return buffer;
    } catch (downloadError) {
      console.error("[callImageGenerationAPI] DOWNLOAD ERROR:", downloadError);
      throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
    }
  }

  console.error("[callImageGenerationAPI] ERROR: Image data has neither b64_json nor url");
  console.error(`[callImageGenerationAPI] Image data: ${JSON.stringify(imageData)}`);
  throw new Error("No image data received from API - missing b64_json and url");
}
