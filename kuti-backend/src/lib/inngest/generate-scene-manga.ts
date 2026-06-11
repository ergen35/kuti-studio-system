/**
 * Fonction Inngest pour la génération de manga de scène
 * Remplace le background thread de génération de scène du backend v1
 */

import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { db } from "../db";
import type { GenerationJobStatus, GenerationSourceKind, GenerationStepStatus } from "../db/generated/enums";
import { getFileStats, saveCharacterImage, writeFile } from "../filesystem";
import { generateImage } from "../model-providers";
import { getProjectDir } from "../paths";
import {
  buildCharacterImagePrompt,
  buildScenePanelPrompt,
  buildSceneStoryboardPrompt,
  buildStyleDescription,
  type PromptCharacterAnchor,
  type PromptImageAnchor,
  type PromptReferenceAnchor,
  selectActiveCharacterSheet,
} from "../manga-prompts";
import { normalizeReferenceKind } from "../story-references";
import { parseSceneContentBeats, requireSceneContent } from "../../modules/scene-generation/content";
import { inngest } from "./client";

type CharacterForPrompt = {
  id: string;
  slug: string;
  name: string;
  alias: string | null;
  narrativeRole: string | null;
  description: string;
  physicalDescription: string;
  personality: string;
  narrativeArc: string;
  keyTraitsJson: unknown;
  colorPaletteJson: unknown;
  costumeElementsJson: unknown;
  tagsJson: unknown;
  images: PromptImageAnchor[];
};

type SelectedImageForPrompt = {
  id: string;
  characterId: string;
  filePath: string;
  publicUrl: string;
  fileName: string;
  prompt: string;
  kind: string;
  isActive: boolean;
  style: string | null;
  strategy: string | null;
  variationIndex: number | null;
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
      const [scene, project, sceneConfig, sceneReferences, projectSceneLocations] = await Promise.all([
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
        db.storyReference.findMany({
          where: { projectId, sceneId },
          orderBy: { createdAt: "asc" },
        }),
        db.scene.findMany({
          where: { projectId },
          select: { location: true },
        }),
      ]);

      if (!scene) throw new Error(`Scene ${sceneId} not found`);
      if (!project) throw new Error(`Project ${projectId} not found`);

      const sceneCharacterRefs = jsonStringArray(scene.charactersJson);
      const selectedCharacterIds = Object.keys(characterImageRefs ?? {});
      const selectedImageIds = Object.values(characterImageRefs ?? {}).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      );
      const referenceCharacterSlugs = sceneReferences
        .map((reference) => normalizeReferenceKind(reference.referenceKind) === "character" ? reference.targetSlug : null)
        .filter((value): value is string => Boolean(value));
      const characterLookupValues = Array.from(new Set([...sceneCharacterRefs, ...selectedCharacterIds, ...referenceCharacterSlugs]));

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

      const selectedImages: SelectedImageForPrompt[] = selectedImageIds.length > 0
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
      const projectLocations = Array.isArray((project.settingsJson as Record<string, unknown> | null)?.locationsJson)
        ? ((project.settingsJson as Record<string, unknown>).locationsJson as string[])
        : [];

      for (const location of [...projectLocations, ...projectSceneLocations.map((entry) => entry.location)]) {
        const trimmed = typeof location === "string" ? location.trim() : "";
        if (!trimmed) continue;
        sceneLocationMap.set(normalizeLocationSlug(trimmed), trimmed);
      }

      const characterBySlug = new Map(characterDetails.map((character) => [character.slug, character]));
      const sceneBySlug = new Map(referencedScenes.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
      const chapterBySlug = new Map(referencedChapters.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
      const tomeBySlug = new Map(referencedTomes.map((entry: { slug: string; title: string }) => [entry.slug, entry]));
      const assetBySlug = new Map(referencedAssets.map((entry: { slug: string; name: string }) => [entry.slug, entry]));
      const selectedImageByCharacterId = new Map(selectedImages.map((image) => [image.characterId, image]));
      const generatedCharacterSheetAnchors = new Map<string, PromptImageAnchor>();
      const sceneStyleDescription = buildStyleDescription(
        sceneConfig?.stylePreset || "generic",
        sceneConfig?.colorMode || "bw",
      );

      for (const character of characterDetails) {
        const existingSheet = selectActiveCharacterSheet(character.images);
        if (existingSheet) continue;

        const referenceImage = selectedImageByCharacterId.get(character.id) ?? null;
        const sheetPrompt = buildCharacterImagePrompt({
          character: {
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
          },
          kind: "character_sheet",
          strategy: "sheet",
          style: sceneStyleDescription,
          activeCharacterSheet: null,
          referenceImage,
          variationIndex: 0,
          totalCount: 1,
        });

        const generatedSheet = await generateImage(sheetPrompt, {
          modelKey,
          size: "1024x1024",
          timeoutSeconds: 180,
        });

        const savedSheet = await saveCharacterImage(projectId, character.id, generatedSheet.content, {
          kind: "character_sheet",
          strategy: "sheet",
          style: sceneStyleDescription,
        });

        const createdSheet = await db.characterImage.create({
          data: {
            projectId,
            characterId: character.id,
            kind: "character_sheet",
            isActive: true,
            sourceImageId: referenceImage?.id ?? null,
            boardPanelId: null,
            filePath: savedSheet.filePath,
            publicUrl: savedSheet.publicUrl,
            fileName: savedSheet.fileName,
            fileSize: savedSheet.fileSize,
            mimeType: generatedSheet.mimeType,
            prompt: sheetPrompt,
            strategy: "sheet",
            style: sceneStyleDescription,
            variationIndex: null,
          },
        });

        await db.characterImage.updateMany({
          where: {
            projectId,
            characterId: character.id,
            kind: "character_sheet",
            isActive: true,
            id: { not: createdSheet.id },
          },
          data: { isActive: false },
        });

        generatedCharacterSheetAnchors.set(character.id, {
          id: createdSheet.id,
          fileName: savedSheet.fileName,
          publicUrl: savedSheet.publicUrl,
          prompt: sheetPrompt,
          style: sceneStyleDescription,
          strategy: "sheet",
          variationIndex: null,
          kind: "character_sheet",
          isActive: true,
        });
      }

      const characterAnchors: PromptCharacterAnchor[] = characterDetails.map((character) => {
        const activeSheet = selectActiveCharacterSheet(character.images) ?? generatedCharacterSheetAnchors.get(character.id) ?? null;
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

      const brokenCharacterReferences = referenceAnchors.filter((reference) => (
        normalizeReferenceKind(reference.referenceKind) === "character" && reference.isBroken
      ));

      if (brokenCharacterReferences.length > 0) {
        const brokenLabels = brokenCharacterReferences.map((reference) => reference.rawToken || reference.targetSlug).join(", ");
        throw new Error(`Scene contains unresolved character references: ${brokenLabels}`);
      }

      const sceneContext = {
        title: scene.title,
        location: scene.location,
        content: requireSceneContent(
          scene.content,
          "Scene content is required before manga generation",
        ),
        notes: scene.notes,
        tomeTitle: scene.tome?.title ?? null,
        chapterTitle: scene.chapter?.title ?? null,
      };

      return {
        scene,
        project,
        sceneConfig,
        characterDetails: characterAnchors,
        referenceAnchors,
        sceneContext,
        generatedCharacterSheetCount: generatedCharacterSheetAnchors.size,
      };
    });

    const { scene, project, sceneConfig, characterDetails, referenceAnchors, sceneContext, generatedCharacterSheetCount } = context;
    const styleContext = {
      systemPrompt: sceneConfig?.systemPrompt,
      stylePreset: sceneConfig?.stylePreset,
      colorMode: sceneConfig?.colorMode,
      allowMultiPage: sceneConfig?.allowMultiPage,
    };

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
          prompt: buildSceneStoryboardPrompt({
            style: styleContext,
            context: sceneContext,
            characters: characterDetails,
            references: referenceAnchors,
            additionalContext,
          }),
          summary: "",
          status: "running" as GenerationJobStatus,
          progress: 5,
          metadataJson: {
            ...(existing.metadataJson as Record<string, unknown>),
            sceneId,
            configId: sceneConfig?.id,
            modelKey,
            characterCount: characterDetails.length,
            preflightGeneratedCharacterSheetCount: generatedCharacterSheetCount,
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
      const panels = generatePanelsFromContent(sceneContext.content, imageCount || 6, scene.title);

      await db.generationJob.update({
        where: { id: job.id },
        data: { progress: 15 },
      });

      return panels;
    });

    const storyboardWithPrompts = storyboard.map((panel, index) => ({
      ...panel,
      prompt: buildScenePanelPrompt({
        style: styleContext,
        context: sceneContext,
        characters: characterDetails,
        references: referenceAnchors,
        panelIndex: index,
        panelCount: storyboard.length,
        beat: panel.description,
        additionalContext,
      }),
    }));

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
      for (let i = 0; i < storyboardWithPrompts.length; i++) {
        const panel = storyboardWithPrompts[i];
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
      for (let i = 0; i < storyboardWithPrompts.length; i++) {
        await db.generationJobStep.create({
          data: {
            jobId: job.id,
            orderIndex: i,
            title: `Panel ${i + 1}: ${storyboardWithPrompts[i].title}`,
            status: "pending" as GenerationStepStatus,
            prompt: storyboardWithPrompts[i].prompt,
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
          const generatedImage = await generateImage(panel.prompt, {
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
              metadataJson: {
                readyForExport: false,
              },
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

interface PanelDefinition {
  title: string;
  caption: string;
  prompt: string;
  description: string;
}

function generatePanelsFromContent(content: string, targetCount: number, sceneTitle = "Scene"): PanelDefinition[] {
  const beats = parseSceneContentBeats(content, sceneTitle);

  const panels: PanelDefinition[] = [];
  const fallbackBeat = beats[0] ?? parseSceneContentBeats(null, sceneTitle)[0]!;
  const count = Math.max(1, targetCount);

  for (let i = 0; i < count; i++) {
    const beat = beats[i] || beats[i % beats.length] || fallbackBeat;
    panels.push({
      title: `Panel ${i + 1}`,
      caption: beat.promptLine.substring(0, 140),
      prompt: `Illustrate this manga story beat: ${beat.promptLine}`,
      description: beat.promptLine,
    });
  }

  return panels;
}
