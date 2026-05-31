import { db } from "@lib/db";

type DramaVideoRecord = NonNullable<Awaited<ReturnType<typeof db.dramaVideo.findFirst>>>;

function publicMangaPageImageUrl(projectId: string, page: { imageUrl: string | null; boardId: string; panelId: string }) {
  if (!page.imageUrl) return null;
  if (page.imageUrl.startsWith("http://") || page.imageUrl.startsWith("https://") || page.imageUrl.startsWith("/api/")) {
    return page.imageUrl;
  }
  return `/api/projects/${projectId}/generation/boards/${page.boardId}/panels/${page.panelId}/image`;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function serializeDramaVideo(video: DramaVideoRecord, source: Awaited<ReturnType<typeof buildSourceContext>>) {
  const metadata = metadataRecord(video.metadataJson);
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
    metadata,
    source,
    createdAt: video.createdAt.toISOString(),
    updatedAt: video.updatedAt.toISOString(),
    completedAt: video.completedAt?.toISOString() ?? null,
    failedAt: video.failedAt?.toISOString() ?? null,
    errorMessage: video.errorMessage,
  };
}

async function buildSourceContext(
  projectId: string,
  sourceMangaPageId: string | null,
  metadata: Record<string, unknown>,
) {
  const fallbackPageId = metadataString(metadata, "sourceMangaPageId") ?? metadataString(metadata, "sourcePageId");
  const pageId = sourceMangaPageId ?? fallbackPageId;

  const page = pageId ? await db.sceneMangaPage.findFirst({ where: { id: pageId, projectId } }) : null;

  const sceneId = page?.sceneId ?? metadataString(metadata, "sceneId");
  const tomeId = page?.tomeId ?? metadataString(metadata, "tomeId");
  const chapterId = page?.chapterId ?? metadataString(metadata, "chapterId");
  if (!sceneId || !tomeId || !chapterId) return null;

  const [scene, tome, chapter] = await Promise.all([
    db.scene.findFirst({ where: { id: sceneId, projectId } }),
    db.tome.findFirst({ where: { id: tomeId, projectId } }),
    db.chapter.findFirst({ where: { id: chapterId, projectId } }),
  ]);

  return {
    sceneId,
    sceneTitle: scene?.title ?? "Scene",
    tomeId,
    tomeTitle: tome?.title ?? "Tome",
    chapterId,
    chapterTitle: chapter?.title ?? "Chapter",
    pageNumber: page?.pageNumber ?? metadataNumber(metadata, "pageNumber") ?? 0,
    pageLabel: page?.label ?? metadataString(metadata, "pageLabel") ?? "Manga page",
    pageImageUrl: page ? publicMangaPageImageUrl(projectId, page) : metadataString(metadata, "sourceImageUrl"),
  };
}

export async function listProjectDramaVideos(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  const videos = await db.dramaVideo.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return await Promise.all(
    videos.map(async (video) => {
      const metadata = metadataRecord(video.metadataJson);
      return serializeDramaVideo(video, await buildSourceContext(projectId, video.sourceMangaPageId, metadata));
    }),
  );
}
