import { randomUUIDv7 } from "bun";
import { config } from "../config";
import { db } from "../db";
import type { DramaVideoStatus, GenerationJobStatus, GenerationStepStatus } from "../db/generated/enums";
import { getFileStats, readFile, writeFile } from "../filesystem";
import { generateVideo, GenerationError } from "../model-providers";
import { getProjectDir } from "../paths";
import { inngest } from "./client";

type GenerateDramaVideoEventData = {
  projectId: string;
  sceneId: string;
  pageId: string;
  dramaVideoId: string;
  jobId: string;
  modelKey?: string;
  prompt?: string;
};

export async function sendGenerateDramaVideoEvent(data: GenerateDramaVideoEventData): Promise<void> {
  await inngest.send({
    id: `drama-video-generate-${data.dramaVideoId}`,
    name: "kuti/drama-video.generate",
    data,
  });
}

export const generateDramaVideoFunction = inngest.createFunction(
  {
    id: "generate-drama-video",
    name: "Generate Korean Drama Video",
    retries: 1,
    triggers: [{ event: "kuti/drama-video.generate" }],
  },
  async ({ event, step }) => {
    const { projectId, sceneId, pageId, dramaVideoId, jobId, modelKey, prompt } = event.data;

    const context = await step.run("fetch-context", async () => {
      const [project, page, scene, video, job] = await Promise.all([
        db.project.findUnique({ where: { id: projectId } }),
        db.sceneMangaPage.findFirst({ where: { id: pageId, projectId, sceneId } }),
        db.scene.findFirst({ where: { id: sceneId, projectId }, include: { tome: true, chapter: true } }),
        db.dramaVideo.findFirst({ where: { id: dramaVideoId, projectId } }),
        db.generationJob.findFirst({ where: { id: jobId, projectId } }),
      ]);

      if (!project) throw new Error(`Project ${projectId} not found`);
      if (!page) throw new Error(`Scene manga page ${pageId} not found`);
      if (!scene) throw new Error(`Scene ${sceneId} not found`);
      if (!video) throw new Error(`Drama video ${dramaVideoId} not found`);
      if (!job) throw new Error(`Generation job ${jobId} not found`);

      return { project, page, scene, video, job };
    });

    const { project, page, scene, video } = context;

    await step.run("mark-running", async () => {
      const now = new Date();
      await Promise.all([
        db.dramaVideo.update({
          where: { id: dramaVideoId },
          data: { status: "running" as DramaVideoStatus, updatedAt: now },
        }),
        db.generationJob.update({
          where: { id: jobId },
          data: { status: "running" as GenerationJobStatus, progress: 10, updatedAt: now },
        }),
        db.generationJobStep.create({
          data: {
            jobId,
            orderIndex: 0,
            title: "Generate Korean drama video",
            status: "running" as GenerationStepStatus,
            prompt: prompt || buildDramaPrompt(scene, page),
          },
        }),
      ]);
    });

    try {
      const sourceImageRef = await step.run("resolve-source-page", async () => {
        if (!page.imageUrl) throw new Error("Manga page has no image URL");
        return page.imageUrl;
      });

      const generated = await step.run("generate-and-save-video", async () => {
        const sourceImage = await readSourceImage(sourceImageRef);
        const videoPrompt = prompt || buildDramaPrompt(scene, page);
        let sourceImageUsed = true;
        let localFallbackUsed = false;
        let providerFailureMessage: string | null = null;
        let sourceImageRetryAttempted = false;
        let result;
        try {
          result = await generateVideo(videoPrompt, {
            modelKey,
            sourceImage: sourceImage.content,
            sourceImageMimeType: sourceImage.mimeType,
            timeoutSeconds: 300,
          });
        } catch (error) {
          if (!shouldRetryWithoutSourceImage(error)) throw error;
          sourceImageUsed = false;
          sourceImageRetryAttempted = true;
          providerFailureMessage = errorMessage(error);
          try {
            result = await generateVideo(
              [
                videoPrompt,
                "The source manga page image could not be sent to the video provider because the request payload was rejected.",
                "Use the page description, caption, original manga prompt, and narrative context above as the visual source.",
              ].join("\n"),
              { modelKey, timeoutSeconds: 300 },
            );
          } catch (fallbackError) {
            providerFailureMessage = errorMessage(fallbackError);
            localFallbackUsed = true;
            result = await generateLocalDramaAnimatic(project.slug, dramaVideoId, sourceImage.content, sourceImage.mimeType);
          }
        }
        const fileName = `drama-${dramaVideoId}-${randomUUIDv7("base64url")}${result.fileExtension}`;
        const filePath = `${getProjectDir(project.slug)}/generation/drama-videos/${fileName}`;
        await writeFile(filePath, result.content);
        const stats = await getFileStats(filePath);
        return {
          fileName,
          filePath,
          size: stats.size,
          mimeType: result.mimeType,
          sourceImageUsed,
          sourceImageRetryAttempted,
          providerFailureMessage,
          localFallbackUsed,
        };
      });

      await step.run("finalize", async () => {
        const now = new Date();
        const previousMetadata = metadataRecord(video.metadataJson);
        await Promise.all([
          db.dramaVideo.update({
            where: { id: dramaVideoId },
            data: {
              status: "ready" as DramaVideoStatus,
              videoPath: generated.filePath,
              videoUrl: `/api/projects/${projectId}/story/scenes/${sceneId}/drama-videos/${dramaVideoId}/file`,
              completedAt: now,
              updatedAt: now,
              metadataJson: {
                ...previousMetadata,
                projectId,
                sceneId,
                tomeId: scene.tomeId,
                chapterId: scene.chapterId,
                sourcePageId: pageId,
                sourceMangaPageId: pageId,
                sourceImageUrl: publicMangaPageImageUrl(projectId, page),
                sourceImageUsed: generated.sourceImageUsed,
                sourceImageRetryAttempted: generated.sourceImageRetryAttempted,
                sourceImageFallbackReason: generated.sourceImageUsed ? null : "provider_rejected_source_image_payload",
                providerFailureMessage: generated.providerFailureMessage,
                localFallbackUsed: generated.localFallbackUsed,
                localFallbackKind: generated.localFallbackUsed ? "local_drama_preview_from_manga_page" : null,
                pageNumber: page.pageNumber,
                pageLabel: page.label,
                pageCaption: page.caption,
                pagePrompt: page.prompt,
                modelKey: modelKey ?? video.modelKey,
                stylePreset: video.stylePreset,
                fileName: generated.fileName,
                sizeBytes: generated.size,
                mimeType: generated.mimeType,
              },
            },
          }),
          db.generationJobStep.updateMany({
            where: { jobId, orderIndex: 0 },
            data: {
              status: "ready" as GenerationStepStatus,
              artifactPath: generated.filePath,
              artifactName: generated.fileName,
              completedAt: now,
            },
          }),
          db.generationJob.update({
            where: { id: jobId },
            data: {
              status: "ready" as GenerationJobStatus,
              progress: 100,
              completedAt: now,
              updatedAt: now,
              summary: "Korean drama video generated",
            },
          }),
        ]);
      });

      return { success: true, dramaVideoId, jobId };
    } catch (error) {
      await step.run("mark-failed", async () => {
        const now = new Date();
        const message = error instanceof Error ? error.message : String(error);
        await Promise.all([
          db.dramaVideo.update({
            where: { id: dramaVideoId },
            data: {
              status: "failed" as DramaVideoStatus,
              failedAt: now,
              updatedAt: now,
              errorMessage: message,
            },
          }),
          db.generationJobStep.updateMany({
            where: { jobId, orderIndex: 0 },
            data: {
              status: "failed" as GenerationStepStatus,
              failedAt: now,
              errorMessage: message,
            },
          }),
          db.generationJob.update({
            where: { id: jobId },
            data: {
              status: "failed" as GenerationJobStatus,
              progress: 100,
              failedAt: now,
              updatedAt: now,
              errorMessage: message,
            },
          }),
        ]);
      });
      throw error;
    }
  },
);

async function readSourceImage(ref: string): Promise<{ content: Buffer; mimeType: string }> {
  if (ref.startsWith("data:")) {
    const match = ref.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid source image data URL");
    return { content: Buffer.from(match[2], "base64"), mimeType: match[1] };
  }

  if (ref.startsWith("http://") || ref.startsWith("https://") || ref.startsWith("/api/")) {
    const url = ref.startsWith("/api/") ? `http://127.0.0.1:${config.port}${ref}` : ref;
    const response = await fetch(url, { headers: { Accept: "image/*,*/*" } });
    if (!response.ok) throw new Error(`Unable to fetch source image: ${response.status}`);
    const mimeType = response.headers.get("content-type") || guessImageMimeType(ref);
    return { content: Buffer.from(await response.arrayBuffer()), mimeType };
  }

  return { content: await readFile(ref), mimeType: guessImageMimeType(ref) };
}

function guessImageMimeType(ref: string): string {
  const path = ref.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function publicMangaPageImageUrl(projectId: string, page: { imageUrl: string | null; boardId: string; panelId: string }) {
  if (!page.imageUrl) return null;
  if (page.imageUrl.startsWith("http://") || page.imageUrl.startsWith("https://") || page.imageUrl.startsWith("/api/")) {
    return page.imageUrl;
  }
  return `/api/projects/${projectId}/generation/boards/${page.boardId}/panels/${page.panelId}/image`;
}

function shouldRetryWithoutSourceImage(error: unknown): boolean {
  if (error instanceof GenerationError) {
    return error.message.includes("413") || error.code === "generation_provider_failed" || error.code === "timeout";
  }
  return error instanceof Error && (error.message.includes("413") || error.message.includes("socket connection"));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function generateLocalDramaAnimatic(
  projectSlug: string,
  dramaVideoId: string,
  sourceImage: Buffer,
  sourceImageMimeType: string,
): Promise<{ content: Buffer; mimeType: string; fileExtension: string }> {
  const ext = sourceImageMimeType.includes("jpeg") ? ".jpg" : sourceImageMimeType.includes("webp") ? ".webp" : ".png";
  const dir = `${getProjectDir(projectSlug)}/generation/drama-videos/local-fallback`;
  const inputPath = `${dir}/${dramaVideoId}-source${ext}`;
  const outputPath = `${dir}/${dramaVideoId}.mp4`;
  await writeFile(inputPath, sourceImage);

  const process = Bun.spawn([
    "ffmpeg",
    "-y",
    "-loop",
    "1",
    "-i",
    inputPath,
    "-t",
    "6",
    "-vf",
    [
      "scale=1280:720:force_original_aspect_ratio=increase",
      "crop=1280:720",
      "zoompan=z='min(zoom+0.0012,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=144:s=1280x720:fps=24",
      "eq=contrast=1.06:saturation=0.92:brightness=-0.015",
      "vignette=PI/5",
      "fade=t=in:st=0:d=0.35",
      "fade=t=out:st=5.55:d=0.45",
      "format=yuv420p",
    ].join(","),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ], { stdout: "ignore", stderr: "pipe" });

  const exitCode = await process.exited;
  if (exitCode !== 0) {
    const errorText = await new Response(process.stderr).text();
    throw new Error(`Local drama animatic fallback failed: ${errorText}`);
  }

  return {
    content: await readFile(outputPath),
    mimeType: "video/mp4",
    fileExtension: ".mp4",
  };
}

function buildDramaPrompt(
  scene: {
    title: string;
    summary: string;
    content: string;
    location: string;
    tome?: { title: string } | null;
    chapter?: { title: string } | null;
  },
  page: { label: string; caption: string | null; prompt: string | null; pageNumber: number },
): string {
  return [
    "Create a cinematic Korean drama style video from this manga page.",
    "Use grounded live-action drama language: intimate framing, expressive pauses, soft realistic lighting, subtle camera movement, emotional tension.",
    "Keep continuity with the manga page composition and the narrative context.",
    "Avoid cartoon style. Preserve the story beat and character emotion.",
    `Tome: ${scene.tome?.title || "Unknown"}`,
    `Chapter: ${scene.chapter?.title || "Unknown"}`,
    `Scene: ${scene.title}`,
    scene.location ? `Location: ${scene.location}` : "",
    scene.summary ? `Scene summary: ${scene.summary}` : "",
    scene.content ? `Scene content: ${scene.content.slice(0, 1500)}` : "",
    `Manga page ${page.pageNumber}: ${page.label}`,
    page.caption ? `Page caption: ${page.caption}` : "",
    page.prompt ? `Original manga prompt: ${page.prompt}` : "",
  ].filter(Boolean).join("\n");
}
