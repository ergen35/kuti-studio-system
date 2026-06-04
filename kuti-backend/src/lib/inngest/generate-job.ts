/**
 * Fonction Inngest générique pour les jobs de génération
 *
 * Cette fonction couvre les demandes `scene`, `chapter`, `tome` et `custom`.
 * Elle crée un board consultable, des steps traçables et met à jour le job
 * principal au fil de l'exécution pour éviter les états bloqués en `pending`.
 */

import { randomUUIDv7 } from "bun";
import { mkdir } from "node:fs/promises";
import { db } from "../db";
import type { Prisma } from "../db/generated/client";
import type {
  GenerationJobStatus,
  GenerationStepStatus,
} from "../db/generated/enums";
import { generateImage } from "../model-providers";
import { getFileStats, writeFile } from "../filesystem";
import { getGenerationBoardDir, getProjectDir } from "../paths";
import { inngest } from "./client";
import { buildChildState, buildChildrenFromResults, progressForIndex, type GeneratedPanel, type SourceUnit, type SourceUnitKind, type TaskChildState } from "./generate-job-core";
export { sendGenerationRunEvent } from "./generate-job-events";

type JobMetadata = Record<string, unknown>;

export const generateGenerationFunction = inngest.createFunction(
  {
    id: "generate-generic-job",
    name: "Generate Generic Job",
    retries: 1,
    triggers: [{ event: "kuti/generation.run" }],
  },
  async ({ event, step }) => {
    const { jobId } = event.data;

    try {
      const context = await step.run("fetch-context", async () => {
        const job = await db.generationJob.findUnique({ where: { id: jobId } });
        if (!job) {
          throw new Error(`Generation job ${jobId} not found`);
        }

        const project = await db.project.findUnique({ where: { id: job.projectId } });
        if (!project) {
          throw new Error(`Project ${job.projectId} not found`);
        }

        return { job, project };
      });

      const { job, project } = context;
      const metadata = record(job.metadataJson);

      await step.run("mark-running", async () => {
        const now = new Date();
        await db.generationJob.update({
          where: { id: job.id },
          data: {
            status: "running",
            updatedAt: now,
          },
        });
      });

      const sourceContext = await step.run("resolve-source", async () => {
        return resolveSourceContext(job.projectId, job.sourceKind, job.sourceId, metadata, job.title, job.summary);
      });

      const targetCount = Math.max(sourceContext.units.length, resolvePanelCount(metadata, sourceContext.units.length));
      const units = expandUnits(sourceContext.units, targetCount);
      const boardId = await step.run("create-board", async () => {
        const board = await db.generationBoard.create({
          data: {
            projectId: project.id,
            jobId: job.id,
            sourceKind: job.sourceKind,
            strategy: job.strategy,
            title: sourceContext.boardTitle,
            summary: sourceContext.boardSummary,
            status: "draft",
            metadataJson: {
              sourceKind: job.sourceKind,
              sourceId: job.sourceId,
              sourceLabel: job.sourceLabel,
              modelKey: job.entrypoint,
              mode: metadata.mode ?? null,
              gridRows: metadata.gridRows ?? null,
              gridCols: metadata.gridCols ?? null,
              imageCount: metadata.imageCount ?? null,
              unitCount: units.length,
              children: [],
            },
          },
        });

        await mkdir(getGenerationBoardDir(project.slug, job.id), { recursive: true });
        return board.id;
      });

      const seeded = await step.run("seed-panels-and-steps", async () => {
        const created: Array<{
          unit: SourceUnit;
          stepId: string;
          panelId: string;
        }> = [];

      for (let index = 0; index < units.length; index += 1) {
        const unit = units[index];
        const prompt = buildPanelPrompt({
          job,
          sourceContext,
          unit,
          panelIndex: index,
          panelCount: units.length,
        });

        const stepRecord = await db.generationJobStep.create({
          data: {
            jobId: job.id,
            orderIndex: index,
            title: unit.title,
            status: "pending" as GenerationStepStatus,
            prompt,
            metadataJson: {
              sourceKind: unit.kind,
              sourceId: unit.sourceId,
              sourceLabel: unit.sourceLabel,
              orderIndex: index,
              total: units.length,
            },
          },
        });

        const panel = await db.generationBoardPanel.create({
          data: {
            boardId,
            stepId: stepRecord.id,
            orderIndex: index,
            title: unit.title,
            caption: unit.summary,
            prompt,
            status: "draft",
            imagePath: "",
            imageName: "",
            metadataJson: {
              sourceKind: unit.kind,
              sourceId: unit.sourceId,
              sourceLabel: unit.sourceLabel,
              orderIndex: index,
              total: units.length,
              context: unit.context as Prisma.InputJsonValue,
            } as Prisma.InputJsonValue,
          },
        });

        created.push({ unit, stepId: stepRecord.id, panelId: panel.id });
      }

      await syncJobSnapshot(job.id, metadata, boardId, created.map((item) => buildChildState(item, "pending", 0, null)), 0, units.length);

        return created;
      });

      const generatedPanels: GeneratedPanel[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (let index = 0; index < seeded.length; index += 1) {
        const item = seeded[index];
        const cancelled = await isJobCancelled(job.id);
        if (cancelled) {
          const errorMessage = "Cancelled by user";
          await markRemainingAsFailed(job.id, boardId, seeded.slice(index), errorMessage);
          generatedPanels.push(...seeded.slice(index).map((remaining, remainingIndex) => ({
            stepId: remaining.stepId,
            panelId: remaining.panelId,
            title: remaining.unit.title,
            caption: remaining.unit.summary,
            prompt: remaining.unit.content,
            imagePath: null,
            imageName: null,
            status: "failed" as const,
            errorMessage,
          })));
          failedCount += seeded.length - index;
          break;
        }

        const result = await step.run(`generate-panel-${index}`, async () => {
          const startedAt = new Date();

        await Promise.all([
          db.generationJobStep.update({
            where: { id: item.stepId },
            data: {
              status: "running" as GenerationStepStatus,
              updatedAt: startedAt,
            },
          }),
          db.generationBoardPanel.update({
            where: { id: item.panelId },
            data: {
              updatedAt: startedAt,
            },
          }),
        ]);

        await syncJobSnapshot(job.id, metadata, boardId, seeded.map((entry, entryIndex) => {
          if (entryIndex < index) {
            return buildChildState(entry, "ready", 100, null);
          }
          if (entryIndex === index) {
            return buildChildState(entry, "running", 50, null);
          }
          return buildChildState(entry, "pending", 0, null);
        }), progressForIndex(index, seeded.length, 5, 80), seeded.length);

        try {
          const prompt = buildPanelPrompt({
            job,
            sourceContext,
            unit: item.unit,
            panelIndex: index,
            panelCount: seeded.length,
          });

          const artifact = await generateImage(prompt, {
            modelKey: job.entrypoint,
            size: "1024x1536",
            timeoutSeconds: 180,
          });

          const fileName = `panel-${index + 1}_${randomUUIDv7("base64url")}${artifact.fileExtension}`;
          const filePath = `${getProjectDir(project.slug)}/generation/${job.id}/${fileName}`;

          await writeFile(filePath, artifact.content);
          const stats = await getFileStats(filePath);

          await Promise.all([
            db.generationJobStep.update({
              where: { id: item.stepId },
              data: {
                status: "ready" as GenerationStepStatus,
                artifactPath: filePath,
                artifactName: fileName,
                outputText: prompt.substring(0, 4000),
                metadataJson: {
                  sourceKind: item.unit.kind,
                  sourceId: item.unit.sourceId,
                  sourceLabel: item.unit.sourceLabel,
                  mimeType: artifact.mimeType,
                  sizeBytes: stats.size,
                },
                completedAt: new Date(),
              },
            }),
            db.generationBoardPanel.update({
              where: { id: item.panelId },
              data: {
                status: "selected",
                imagePath: filePath,
                imageName: fileName,
                metadataJson: {
                  sourceKind: item.unit.kind,
                  sourceId: item.unit.sourceId,
                  sourceLabel: item.unit.sourceLabel,
                  mimeType: artifact.mimeType,
                  sizeBytes: stats.size,
                },
                updatedAt: new Date(),
              },
            }),
          ]);

          return {
            stepId: item.stepId,
            panelId: item.panelId,
            title: item.unit.title,
            caption: item.unit.summary,
            prompt,
            imagePath: filePath,
            imageName: fileName,
            status: "ready" as const,
            errorMessage: null,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          await Promise.all([
            db.generationJobStep.update({
              where: { id: item.stepId },
              data: {
                status: "failed" as GenerationStepStatus,
                failedAt: new Date(),
                errorMessage: message,
              },
            }),
            db.generationBoardPanel.update({
              where: { id: item.panelId },
              data: {
                status: "rejected",
                metadataJson: {
                  sourceKind: item.unit.kind,
                  sourceId: item.unit.sourceId,
                  sourceLabel: item.unit.sourceLabel,
                  errorMessage: message,
                },
                updatedAt: new Date(),
              },
            }),
          ]);

          return {
            stepId: item.stepId,
            panelId: item.panelId,
            title: item.unit.title,
            caption: item.unit.summary,
            prompt: item.unit.content,
            imagePath: null,
            imageName: null,
            status: "failed" as const,
            errorMessage: message,
          };
        }
      });

        generatedPanels.push(result);
        if (result.status === "ready") {
          successCount += 1;
        } else {
          failedCount += 1;
        }

        await syncJobSnapshot(job.id, metadata, boardId, buildChildrenFromResults(seeded, generatedPanels, seeded.length), progressForIndex(index + 1, seeded.length, 5, 80), seeded.length);
      }

      const boardArtifact = await step.run("write-board-artifact", async () => {
        const boardRecord = await db.generationBoard.findUnique({
          where: { id: boardId },
          include: { panels: { orderBy: { orderIndex: "asc" } } },
        });

        if (!boardRecord) {
          throw new Error(`Board ${boardId} not found`);
        }

        const artifact = {
          boardId,
          jobId: job.id,
          projectId: project.id,
          sourceKind: job.sourceKind,
          sourceId: job.sourceId,
          sourceLabel: job.sourceLabel,
          title: boardRecord.title,
          summary: boardRecord.summary,
          strategy: boardRecord.strategy,
          createdAt: boardRecord.createdAt.toISOString(),
          updatedAt: new Date().toISOString(),
          units: units.map((unit, index) => ({
            ...unit,
            index,
          })),
          panels: boardRecord.panels.map((panel) => ({
            id: panel.id,
            stepId: panel.stepId,
            orderIndex: panel.orderIndex,
            title: panel.title,
            caption: panel.caption,
            prompt: panel.prompt,
            status: panel.status,
            imagePath: panel.imagePath,
            imageName: panel.imageName,
            metadataJson: panel.metadataJson,
          })),
          steps: await db.generationJobStep.findMany({
            where: { jobId: job.id },
            orderBy: { orderIndex: "asc" },
          }),
        };

        const filePath = `${getGenerationBoardDir(project.slug, job.id)}/board.json`;
        await writeFile(filePath, JSON.stringify(artifact, null, 2));
        return {
          filePath,
          fileName: `board-${job.id}.json`,
        };
      });

      await step.run("finalize-job", async () => {
        const now = new Date();
        const finalStatus: GenerationJobStatus = successCount > 0 ? "ready" : "failed";
        const summary = successCount > 0
          ? `Generated ${successCount}/${seeded.length} panels`
          : `Generation failed for ${failedCount || seeded.length} panels`;

        await Promise.all([
          db.generationJob.update({
            where: { id: job.id },
            data: {
              status: finalStatus,
              progress: 100,
              completedAt: successCount > 0 ? now : null,
              failedAt: successCount > 0 ? null : now,
              updatedAt: now,
              summary,
              errorMessage: successCount > 0 ? null : summary,
              metadataJson: {
                ...metadata,
                boardId,
                artifactPath: boardArtifact.filePath,
                artifactName: boardArtifact.fileName,
                sourceKind: job.sourceKind,
                sourceId: job.sourceId,
                sourceLabel: job.sourceLabel,
                completed: successCount,
                total: seeded.length,
                children: buildChildrenFromResults(seeded, generatedPanels, seeded.length),
              } as Prisma.InputJsonValue,
            },
          }),
          db.generationBoard.update({
            where: { id: boardId },
            data: {
              artifactPath: boardArtifact.filePath,
              artifactName: boardArtifact.fileName,
              updatedAt: now,
              metadataJson: {
                sourceKind: job.sourceKind,
                sourceId: job.sourceId,
                sourceLabel: job.sourceLabel,
                modelKey: job.entrypoint,
                completed: successCount,
                total: seeded.length,
                children: buildChildrenFromResults(seeded, generatedPanels, seeded.length),
              } as Prisma.InputJsonValue,
            },
          }),
        ]);
      });

      return {
        success: true,
        jobId,
        boardId,
        generatedCount: successCount,
        failedCount,
        boardArtifact,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await db.generationJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          failedAt: new Date(),
          errorMessage: message,
          updatedAt: new Date(),
        },
      });

      throw error;
    }
  },
);

function record(value: unknown): JobMetadata {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JobMetadata : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function syncJobSnapshot(
  jobId: string,
  baseMetadata: JobMetadata,
  boardId: string,
  children: TaskChildState[],
  progress: number,
  total: number,
): Promise<void> {
  const completed = children.filter((child) => child.status === "ready").length;
  await db.generationJob.update({
    where: { id: jobId },
    data: {
      progress,
      metadataJson: {
        ...baseMetadata,
        boardId,
        completed,
        total,
        children,
      } as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}

async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await db.generationJob.findUnique({ where: { id: jobId } });
  return job?.status === "failed" && job.errorMessage === "Cancelled by user";
}

async function markRemainingAsFailed(
  jobId: string,
  boardId: string,
  remaining: Array<{ unit: SourceUnit; stepId: string; panelId: string }>,
  errorMessage: string,
): Promise<void> {
  const now = new Date();
  await Promise.all([
    db.generationJobStep.updateMany({
      where: { jobId, id: { in: remaining.map((entry) => entry.stepId) } },
      data: {
        status: "failed" as GenerationStepStatus,
        failedAt: now,
        errorMessage,
      },
    }),
    db.generationBoardPanel.updateMany({
      where: { boardId, id: { in: remaining.map((entry) => entry.panelId) } },
      data: {
        status: "rejected",
        updatedAt: now,
        metadataJson: {
          cancelled: true,
          errorMessage,
        },
      },
    }),
  ]);
}

function expandUnits(units: SourceUnit[], targetCount: number): SourceUnit[] {
  if (units.length === 0) {
    return Array.from({ length: targetCount }, (_, index) => ({
      kind: "custom" as const,
      sourceId: `custom-${index + 1}`,
      title: `Panel ${index + 1}`,
      sourceLabel: `Panel ${index + 1}`,
      summary: "Generated from custom context",
      content: "",
      notes: "",
      orderIndex: index,
      context: { variation: index + 1 },
    }));
  }

  return Array.from({ length: targetCount }, (_, index) => {
    const base = units[index % units.length];
    const variation = Math.floor(index / units.length);
    if (variation === 0) {
      return base;
    }

    return {
      ...base,
      title: `${base.title} · Variation ${variation + 1}`,
      summary: `${base.summary} (variation ${variation + 1})`,
      context: {
        ...base.context,
        variation: variation + 1,
      },
      orderIndex: index,
    };
  });
}

async function resolveSourceContext(
  projectId: string,
  sourceKind: string,
  sourceId: string,
  metadata: JobMetadata,
  fallbackTitle: string,
  fallbackSummary: string,
): Promise<{
  boardTitle: string;
  boardSummary: string;
  units: SourceUnit[];
}> {
  switch (sourceKind) {
    case "scene": {
      const scene = await db.scene.findFirst({
        where: { id: sourceId, projectId },
        include: {
          tome: true,
          chapter: true,
        },
      });

      if (!scene) {
        throw new Error("Scene not found");
      }

      const panelCount = resolvePanelCount(metadata, 4);
      const sceneBase: SourceUnit = {
        kind: "panel",
        sourceId: scene.id,
        title: scene.title,
        sourceLabel: scene.title,
        summary: scene.summary || scene.title,
        content: scene.content,
        notes: scene.notes,
        orderIndex: scene.orderIndex,
        context: {
          sceneId: scene.id,
          tomeId: scene.tomeId,
          tomeTitle: scene.tome?.title ?? null,
          chapterId: scene.chapterId,
          chapterTitle: scene.chapter?.title ?? null,
          sceneType: scene.sceneType,
          location: scene.location,
          characters: scene.charactersJson,
          tags: scene.tagsJson,
        },
      };

      return {
        boardTitle: `Generation: ${scene.title}`,
        boardSummary: scene.summary || fallbackSummary || `Storyboard for ${scene.title}`,
        units: expandUnits([sceneBase], panelCount),
      };
    }

    case "chapter": {
      const chapter = await db.chapter.findFirst({
        where: { id: sourceId, projectId },
        include: {
          tome: true,
          scenes: {
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      if (!chapter) {
        throw new Error("Chapter not found");
      }

      const units = chapter.scenes.length > 0
        ? chapter.scenes.map((scene, index) => ({
            kind: "scene" as const,
            sourceId: scene.id,
            title: scene.title,
            sourceLabel: scene.title,
            summary: scene.summary || scene.title,
            content: scene.content,
            notes: scene.notes,
            orderIndex: index,
            context: {
              sceneId: scene.id,
              tomeId: chapter.tomeId,
              tomeTitle: chapter.tome?.title ?? null,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
              sceneType: scene.sceneType,
              location: scene.location,
              characters: scene.charactersJson,
              tags: scene.tagsJson,
            },
          }))
        : [{
            kind: "chapter" as const,
            sourceId: chapter.id,
            title: chapter.title,
            sourceLabel: chapter.title,
            summary: chapter.synopsis || chapter.title,
            content: chapter.synopsis,
            notes: "",
            orderIndex: 0,
            context: {
              chapterId: chapter.id,
              tomeId: chapter.tomeId,
              tomeTitle: chapter.tome?.title ?? null,
            },
          }];

      const targetCount = Math.max(units.length, resolvePanelCount(metadata, units.length));

      return {
        boardTitle: `Chapter board: ${chapter.title}`,
        boardSummary: chapter.synopsis || fallbackSummary || `Storyboard for chapter ${chapter.title}`,
        units: expandUnits(units, targetCount),
      };
    }

    case "tome": {
      const tome = await db.tome.findFirst({
        where: { id: sourceId, projectId },
        include: {
          chapters: {
            orderBy: { orderIndex: "asc" },
            include: {
              scenes: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      });

      if (!tome) {
        throw new Error("Tome not found");
      }

      const scenes = tome.chapters.flatMap((chapter) => chapter.scenes.map((scene, index) => ({
        kind: "scene" as const,
        sourceId: scene.id,
        title: scene.title,
        sourceLabel: scene.title,
        summary: scene.summary || scene.title,
        content: scene.content,
        notes: scene.notes,
        orderIndex: index,
        context: {
          sceneId: scene.id,
          tomeId: tome.id,
          tomeTitle: tome.title,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sceneType: scene.sceneType,
          location: scene.location,
          characters: scene.charactersJson,
          tags: scene.tagsJson,
        },
      })));

      if (scenes.length > 0) {
        const targetCount = Math.max(scenes.length, resolvePanelCount(metadata, scenes.length));
        return {
          boardTitle: `Tome board: ${tome.title}`,
          boardSummary: fallbackSummary || `Storyboard for tome ${tome.title}`,
          units: expandUnits(scenes, targetCount),
        };
      }

      if (tome.chapters.length > 0) {
        const targetCount = Math.max(tome.chapters.length, resolvePanelCount(metadata, tome.chapters.length));
        return {
          boardTitle: `Tome board: ${tome.title}`,
          boardSummary: fallbackSummary || `Storyboard for tome ${tome.title}`,
          units: expandUnits(tome.chapters.map((chapter, index) => ({
            kind: "chapter" as const,
            sourceId: chapter.id,
            title: chapter.title,
            sourceLabel: chapter.title,
            summary: chapter.synopsis || chapter.title,
            content: chapter.synopsis,
            notes: "",
            orderIndex: index,
            context: {
              tomeId: tome.id,
              tomeTitle: tome.title,
              chapterId: chapter.id,
              chapterTitle: chapter.title,
            },
          })), targetCount),
        };
      }

      return {
        boardTitle: `Tome board: ${tome.title}`,
        boardSummary: fallbackSummary || `Storyboard for tome ${tome.title}`,
        units: [{
          kind: "tome" as const,
          sourceId: tome.id,
          title: tome.title,
          sourceLabel: tome.title,
          summary: tome.synopsis || tome.title,
          content: tome.synopsis,
          notes: "",
          orderIndex: 0,
          context: {
            tomeId: tome.id,
            tomeTitle: tome.title,
          },
        }],
      };
    }

    case "custom": {
      const customTitle = fallbackTitle || "Custom generation";
      const customSummary = fallbackSummary || customTitle;
      const units = expandUnits([{
        kind: "custom" as const,
        sourceId,
        title: customTitle,
        sourceLabel: customTitle,
        summary: customSummary,
        content: customSummary,
        notes: stringValue(metadata.notes),
        orderIndex: 0,
        context: {
          sourceId,
          notes: metadata.notes ?? null,
        },
      }], resolvePanelCount(metadata, 4));

      return {
        boardTitle: customTitle,
        boardSummary: customSummary,
        units,
      };
    }

    default:
      throw new Error(`Unsupported source kind: ${sourceKind}`);
  }
}

function resolveGridCount(metadata: JobMetadata): number | null {
  const rows = numberValue(metadata.gridRows);
  const cols = numberValue(metadata.gridCols);
  if (!rows || !cols) return null;
  return rows * cols;
}

function resolvePanelCount(metadata: JobMetadata, fallback: number): number {
  return Math.max(1, numberValue(metadata.imageCount) ?? resolveGridCount(metadata) ?? fallback);
}

function buildPanelPrompt(params: {
  job: { title: string; summary: string; sourceLabel: string; sourceKind: string; strategy: string; entrypoint: string; metadataJson: unknown };
  sourceContext: { boardTitle: string; boardSummary: string };
  unit: SourceUnit;
  panelIndex: number;
  panelCount: number;
}): string {
  const { job, sourceContext, unit, panelIndex, panelCount } = params;
  const metadata = record(job.metadataJson);
  const notes = stringValue(unit.notes);
  const extras = [
    `Job title: ${job.title}`,
    `Job summary: ${job.summary || sourceContext.boardSummary}`,
    `Source kind: ${job.sourceKind}`,
    `Strategy: ${job.strategy}`,
    `Model: ${job.entrypoint}`,
    `Board: ${sourceContext.boardTitle}`,
    `Unit: ${unit.sourceLabel}`,
    `Panel ${panelIndex + 1}/${panelCount}`,
  ];

  if (unit.summary) {
    extras.push(`Unit summary: ${unit.summary}`);
  }

  if (unit.content) {
    extras.push(`Content:\n${unit.content.substring(0, 2200)}`);
  }

  if (notes) {
    extras.push(`Notes: ${notes}`);
  }

  const serializedContext = JSON.stringify({
    sourceKind: job.sourceKind,
    sourceLabel: job.sourceLabel,
    mode: metadata.mode ?? null,
    gridRows: metadata.gridRows ?? null,
    gridCols: metadata.gridCols ?? null,
    imageCount: metadata.imageCount ?? null,
    unitContext: unit.context,
  }, null, 2);

  extras.push("Context JSON:", serializedContext);
  extras.push("Create a polished manga-style storyboard panel with cinematic composition, clear focal action, readable spatial relationships, and no watermark or caption text.");

  return extras.join("\n\n");
}
