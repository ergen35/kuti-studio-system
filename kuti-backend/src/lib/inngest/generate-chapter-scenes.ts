import { db } from "../db";
import type { GenerationJobStatus } from "../db/generated/enums";
import { runCoherenceScanIfEnabled } from "../coherence-scan";
import { inngest } from "./client";
import {
  requestChapterSceneGeneration,
  replaceChapterScenesWithDrafts,
  resolveChapterSceneGenerationReferences,
} from "../../modules/story/chapter-auto-generation";

type GenerateChapterScenesEventData = {
  projectId: string;
  chapterId: string;
  jobId: string;
};

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function metadataInteger(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

export async function sendGenerateChapterScenesEvent(
  data: GenerateChapterScenesEventData,
): Promise<void> {
  await inngest.send({
    id: `chapter-scenes-${data.jobId}`,
    name: "kuti/chapter-scenes.generate",
    data,
  });
}

export const generateChapterScenesFunction = inngest.createFunction(
  {
    id: "generate-chapter-scenes",
    name: "Generate Chapter Scenes",
    retries: 1,
    triggers: [{ event: "kuti/chapter-scenes.generate" }],
  },
  async ({ event, step }) => {
    const { projectId, chapterId, jobId } = event.data;

    let jobMetadata: Record<string, unknown> = {};
    try {
      const context = await step.run("fetch-context", async () => {
        const [job, chapter, project] = await Promise.all([
          db.generationJob.findFirst({
            where: { id: jobId, projectId, sourceKind: "chapter", sourceId: chapterId },
          }),
          db.chapter.findFirst({
            where: { id: chapterId, projectId },
            include: { tome: true },
          }),
          db.project.findUnique({
            where: { id: projectId },
            select: { id: true, slug: true },
          }),
        ]);

        if (!job) {
          throw new Error(`Generation job ${jobId} not found`);
        }
        if (!chapter) {
          throw new Error(`Chapter ${chapterId} not found`);
        }
        if (!project) {
          throw new Error(`Project ${projectId} not found`);
        }

        const metadata = metadataRecord(job.metadataJson);
        const chapterSummary = metadataString(metadata, "chapterSummary");
        const sceneCount = metadataInteger(metadata, "sceneCount");
        const modelKey = metadataString(metadata, "modelKey");

        if (!chapterSummary) {
          throw new Error("Chapter summary missing from job metadata");
        }

        if (!sceneCount || sceneCount < 1 || sceneCount > 8) {
          throw new Error("Invalid chapter scene count in job metadata");
        }

        jobMetadata = metadata;

        return {
          job,
          chapter,
          chapterSummary,
          sceneCount,
          modelKey,
        };
      });

      await step.run("mark-running", async () => {
        const now = new Date();
        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "running" as GenerationJobStatus,
            progress: 10,
            updatedAt: now,
          },
        });
      });

      const generated = await step.run("generate-scenes", async () => {
        const references = await resolveChapterSceneGenerationReferences(
          projectId,
          context.chapterSummary,
        );

        const result = await requestChapterSceneGeneration({
          chapterTitle: context.chapter.title,
          tomeTitle: context.chapter.tome?.title ?? null,
          chapterSummary: context.chapterSummary,
          sceneCount: context.sceneCount,
          references,
          modelKey: context.modelKey ?? undefined,
        });

        return {
          ...result,
          references,
        };
      });

      const persisted = await step.run("replace-scenes", async () => {
        return await replaceChapterScenesWithDrafts(
          projectId,
          chapterId,
          generated.scenes,
          {
            jobId,
            archiveReason: "Chapter auto-generation replacement",
          },
        );
      });

      const coherenceScanTriggered = await step.run("coherence-scan", async () => {
        return await runCoherenceScanIfEnabled(projectId);
      });

      await step.run("finalize-job", async () => {
        const now = new Date();

        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "ready" as GenerationJobStatus,
            progress: 100,
            entrypoint: generated.modelKey,
            prompt: generated.prompt,
            summary: `Generated ${persisted.createdSceneIds.length} scene${persisted.createdSceneIds.length > 1 ? "s" : ""} for chapter ${context.chapter.title}`,
            completedAt: now,
            updatedAt: now,
            metadataJson: {
              ...jobMetadata,
              jobKind: "chapter_auto_generation",
              chapterId,
              chapterTitle: context.chapter.title,
              tomeId: context.chapter.tomeId,
              tomeTitle: context.chapter.tome?.title ?? null,
              chapterSummaryLength: context.chapterSummary.trim().length,
              sceneCount: context.sceneCount,
              modelKey: generated.modelKey,
              references: generated.references,
              referenceCount: generated.references.length,
              createdSceneIds: persisted.createdSceneIds,
              deletedSceneIds: persisted.deletedSceneIds,
              deletedPageIds: persisted.deletedPageIds,
              coherenceScanTriggered,
            },
          },
        });
      });

      return {
        success: true,
        jobId,
        projectId,
        chapterId,
        createdSceneIds: persisted.createdSceneIds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await step.run("mark-failed", async () => {
        const now = new Date();
        const existingJob = await db.generationJob.findFirst({
          where: { id: jobId, projectId },
        });

        if (!existingJob) {
          return;
        }

        await db.generationJob.update({
          where: { id: jobId },
          data: {
            status: "failed" as GenerationJobStatus,
            failedAt: now,
            updatedAt: now,
            errorMessage: message,
            metadataJson: {
              ...metadataRecord(existingJob.metadataJson),
              jobKind: "chapter_auto_generation",
              chapterId,
              errorMessage: message,
              failedAt: now.toISOString(),
            },
          },
        });
      });

      throw error;
    }
  },
);
