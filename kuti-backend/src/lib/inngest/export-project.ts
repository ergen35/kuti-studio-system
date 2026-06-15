/**
 * Fonction Inngest pour l'export de projet
 * Export en JSON, arborescence, ou ZIP
 */

import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { PDFDocument } from "pdf-lib";
import { db } from "../db";
import type { ExportStatus } from "../db/generated/enums";
import { writeFile } from "../filesystem";
import { inngest } from "./client";
import { config } from "../config";
import { getExportsPublicDir, getExportPublicUrl, getProjectDir } from "../paths";

type ZipWriterLike = {
  add(path: string, data: Buffer): void;
  end(): Promise<Buffer>;
};

const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11),
    date: date.getDate() | ((date.getMonth() + 1) << 5) | ((year - 1980) << 9),
  };
}

class StoreZipWriter implements ZipWriterLike {
  private files: Array<{ path: string; data: Buffer }> = [];

  add(path: string, data: Buffer): void {
    this.files.push({ path: path.replace(/^\/+/, ""), data });
  }

  async end(): Promise<Buffer> {
    const localChunks: Buffer[] = [];
    const centralChunks: Buffer[] = [];
    const { time, date } = dosDateTime();
    let offset = 0;

    for (const file of this.files) {
      const name = Buffer.from(file.path, "utf8");
      const checksum = crc32(file.data);
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(0, 8);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(checksum, 14);
      local.writeUInt32LE(file.data.length, 18);
      local.writeUInt32LE(file.data.length, 22);
      local.writeUInt16LE(name.length, 26);
      local.writeUInt16LE(0, 28);
      localChunks.push(local, name, file.data);

      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x0800, 8);
      central.writeUInt16LE(0, 10);
      central.writeUInt16LE(time, 12);
      central.writeUInt16LE(date, 14);
      central.writeUInt32LE(checksum, 16);
      central.writeUInt32LE(file.data.length, 20);
      central.writeUInt32LE(file.data.length, 24);
      central.writeUInt16LE(name.length, 28);
      central.writeUInt16LE(0, 30);
      central.writeUInt16LE(0, 32);
      central.writeUInt16LE(0, 34);
      central.writeUInt16LE(0, 36);
      central.writeUInt32LE(0, 38);
      central.writeUInt32LE(offset, 42);
      centralChunks.push(central, name);

      offset += local.length + name.length + file.data.length;
    }

    const centralSize = centralChunks.reduce((total, chunk) => total + chunk.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(this.files.length, 8);
    end.writeUInt16LE(this.files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localChunks, ...centralChunks, end]);
  }
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

type ExportSourceSnapshot = Record<string, unknown>;

function readSourceSnapshot(value: unknown): ExportSourceSnapshot | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ExportSourceSnapshot
    : null;
}

function buildExportManifest(
  project: Record<string, unknown>,
  kind: "work" | "publication",
  format: string,
  sourceSnapshot: ExportSourceSnapshot | null,
) {
  return {
    name: project.name,
    slug: project.slug,
    exportedAt: new Date().toISOString(),
    kind,
    format,
    sourceSnapshot,
  };
}

type StorySceneContext = {
  tome: any;
  chapter: any;
  scene: any;
};

type PublicationPageEntry = {
  pageId: string;
  sceneId: string;
  sceneSlug: string;
  sceneTitle: string;
  tomeId: string;
  tomeSlug: string;
  tomeTitle: string;
  chapterId: string;
  chapterSlug: string;
  chapterTitle: string;
  pageNumber: number;
  label: string;
  caption: string;
  prompt: string;
  imagePath: string;
  mimeType: string;
  status: string;
  sourceKind: "scene_page" | "validated_board";
  boardId?: string;
  panelId?: string;
};

function safeStem(value: string): string {
  return slugify(value, { lower: true, strict: true, replacement: "_" }) || "export";
}

async function writeExportToPublic(
  projectId: string,
  fileName: string,
  content: Buffer | string
): Promise<{ filePath: string; publicUrl: string; fileName: string; fileSize: number }> {
  const dir = getExportsPublicDir(projectId);
  const fullPath = `${dir}/${fileName}`;
  const data = typeof content === "string" ? Buffer.from(content) : content;

  await writeFile(fullPath, data);
  const stats = await stat(fullPath);

  return {
    filePath: `projects/${projectId}/exports/${fileName}`,
    publicUrl: getExportPublicUrl(projectId, fileName),
    fileName,
    fileSize: stats.size,
  };
}

function normalizedPath(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function isRemotePath(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("/api/");
}

function resolveRemotePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, `http://127.0.0.1:${config.port}`).toString();
}

function mimeTypeFromPath(path: string): string {
  const ext = normalizedPath(path).split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";

  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

async function readBinarySource(path: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (isRemotePath(path)) {
    const response = await fetch(resolveRemotePath(path));
    if (!response.ok) {
      throw new Error(`Failed to read remote image: ${path}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") || mimeTypeFromPath(path),
    };
  }

  // Support des deux formats de chemins :
  // - Ancien : chemin absolu vers kuti-data/
  // - Nouveau : chemin relatif (projects/...) vers public/, ou URL statique (/projects/...)
  let resolvedPath = path;
  if (path.startsWith("/projects/")) {
    resolvedPath = `public${path}`;
  } else if (!path.startsWith("/") && !path.startsWith("./")) {
    resolvedPath = `public/${path}`;
  }

  return {
    buffer: Buffer.from(await Bun.file(resolvedPath).arrayBuffer()),
    mimeType: mimeTypeFromPath(path),
  };
}

function flattenStoryScenes(project: any): StorySceneContext[] {
  const tomes = Array.isArray(project?.tomes) ? [...project.tomes] : [];

  return tomes
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .flatMap((tome) => {
      const chapters = Array.isArray(tome.chapters) ? [...tome.chapters] : [];

      return chapters
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
        .flatMap((chapter) => {
          const scenes = Array.isArray(chapter.scenes) ? [...chapter.scenes] : [];

          return scenes
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
            .map((scene) => ({ tome, chapter, scene }));
        });
    });
}

function pageEntryFromScenePage(sceneContext: StorySceneContext, page: any, sourceKind: PublicationPageEntry["sourceKind"]): PublicationPageEntry | null {
  const imagePath = typeof page.imageUrl === "string" ? page.imageUrl.trim() : "";
  if (!imagePath) return null;

  return {
    pageId: page.id,
    sceneId: sceneContext.scene.id,
    sceneSlug: sceneContext.scene.slug,
    sceneTitle: sceneContext.scene.title,
    tomeId: sceneContext.tome.id,
    tomeSlug: sceneContext.tome.slug,
    tomeTitle: sceneContext.tome.title,
    chapterId: sceneContext.chapter.id,
    chapterSlug: sceneContext.chapter.slug,
    chapterTitle: sceneContext.chapter.title,
    pageNumber: page.pageNumber,
    label: page.label || `Page ${page.pageNumber}`,
    caption: page.caption || "",
    prompt: page.prompt || "",
    imagePath,
    mimeType: mimeTypeFromPath(imagePath),
    status: page.status,
    sourceKind,
    boardId: typeof page.boardId === "string" ? page.boardId : undefined,
    panelId: typeof page.panelId === "string" ? page.panelId : undefined,
  };
}

function pageEntryFromBoardPanel(sceneContext: StorySceneContext, board: any, panel: any): PublicationPageEntry | null {
  const imagePath = typeof panel.imagePath === "string" ? panel.imagePath.trim() : "";
  if (!imagePath) return null;

  const pageNumber = typeof panel.orderIndex === "number" ? panel.orderIndex + 1 : 1;

  return {
    pageId: `${board.id}:${panel.id}`,
    sceneId: sceneContext.scene.id,
    sceneSlug: sceneContext.scene.slug,
    sceneTitle: sceneContext.scene.title,
    tomeId: sceneContext.tome.id,
    tomeSlug: sceneContext.tome.slug,
    tomeTitle: sceneContext.tome.title,
    chapterId: sceneContext.chapter.id,
    chapterSlug: sceneContext.chapter.slug,
    chapterTitle: sceneContext.chapter.title,
    pageNumber,
    label: panel.title || `Page ${pageNumber}`,
    caption: panel.caption || "",
    prompt: panel.prompt || "",
    imagePath,
    mimeType: mimeTypeFromPath(imagePath),
    status: "selected",
    sourceKind: "validated_board",
    boardId: board.id,
    panelId: panel.id,
  };
}

function boardSourceSceneId(board: any): string | null {
  const metadata = objectRecord(board.metadataJson);
  const sourceId = metadata.sourceId ?? metadata.sceneId ?? metadata.source_id;

  return typeof sourceId === "string" && sourceId.trim().length > 0 ? sourceId : null;
}

function isPublicationReadyPage(page: any): boolean {
  return page.status === "selected" || objectRecord(page.metadataJson).readyForExport === true;
}

async function deriveSelectedPagesFromBoard(projectId: string, sceneContext: StorySceneContext, board: any): Promise<PublicationPageEntry[]> {
  const panels = Array.isArray(board.panels) ? [...board.panels] : [];
  const orderedPanels = panels.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const selectedPanels = orderedPanels.filter((panel) => panel.status === "selected");
  const exportPanels = selectedPanels.length > 0 || board.status !== "validated"
    ? selectedPanels
    : orderedPanels;
  const pages: PublicationPageEntry[] = [];

  for (const panel of exportPanels) {
    const existingPage = await db.sceneMangaPage.findFirst({
      where: {
        projectId,
        sceneId: sceneContext.scene.id,
        boardId: board.id,
        panelId: panel.id,
      },
    });

    const imagePath = typeof panel.imagePath === "string" ? panel.imagePath.trim() : "";
    if (!imagePath) continue;

    const pageData = {
      projectId,
      sceneId: sceneContext.scene.id,
      tomeId: sceneContext.tome.id,
      chapterId: sceneContext.chapter.id,
      jobId: board.jobId,
      boardId: board.id,
      panelId: panel.id,
      pageNumber: typeof panel.orderIndex === "number" ? panel.orderIndex + 1 : pages.length + 1,
      label: panel.title || `Page ${pages.length + 1}`,
      status: "selected" as const,
      imageUrl: imagePath,
      caption: panel.caption || "",
      prompt: panel.prompt || "",
    };

    const persistedPage = existingPage
      ? await db.sceneMangaPage.update({
          where: { id: existingPage.id },
          data: pageData,
        })
      : await db.sceneMangaPage.create({ data: pageData });

    const pageEntry = pageEntryFromScenePage(sceneContext, persistedPage, "validated_board");
    if (pageEntry) {
      pages.push(pageEntry);
    }
  }

  return pages.sort((a: PublicationPageEntry, b: PublicationPageEntry) => a.pageNumber - b.pageNumber);
}

async function collectPublicationPages(project: any): Promise<PublicationPageEntry[]> {
  const orderedScenes = flattenStoryScenes(project);
  const scenePages = Array.isArray(project?.sceneMangaPages) ? project.sceneMangaPages : [];
  const generationBoards = Array.isArray(project?.generationBoards) ? project.generationBoards : [];

  const pagesByScene = new Map<string, PublicationPageEntry[]>();

  for (const sceneContext of orderedScenes) {
    const publicationPages = scenePages
      .filter((page: any) => page.sceneId === sceneContext.scene.id && isPublicationReadyPage(page))
      .map((page: any) => pageEntryFromScenePage(sceneContext, page, "scene_page"))
      .filter((page: PublicationPageEntry | null): page is PublicationPageEntry => Boolean(page))
      .sort((a: PublicationPageEntry, b: PublicationPageEntry) => a.pageNumber - b.pageNumber);

    if (publicationPages.length > 0) {
      pagesByScene.set(sceneContext.scene.id, publicationPages);
      continue;
    }

    const validatedBoards = generationBoards.filter((board: any) => {
      if (board.sourceKind !== "scene" || board.status !== "validated") return false;
      return boardSourceSceneId(board) === sceneContext.scene.id;
    });

    if (validatedBoards.length === 0) {
      continue;
    }

    const latestBoard = [...validatedBoards].sort((a, b) => {
      const aDate = a.validatedAt ? new Date(a.validatedAt).getTime() : new Date(a.createdAt).getTime();
      const bDate = b.validatedAt ? new Date(b.validatedAt).getTime() : new Date(b.createdAt).getTime();
      return bDate - aDate;
    })[0];

    if (!latestBoard) continue;

    const derivedPages = await deriveSelectedPagesFromBoard(project.id, sceneContext, latestBoard);
    if (derivedPages.length > 0) {
      pagesByScene.set(sceneContext.scene.id, derivedPages);
    }
  }

  return orderedScenes.flatMap((sceneContext) => pagesByScene.get(sceneContext.scene.id) || []);
}

async function collectPublicationAssets(project: any, label: string, sourceSnapshot: ExportSourceSnapshot | null) {
  const pages = await collectPublicationPages(project);
  const labelStem = safeStem(label || String(project.name || project.slug || "export"));

  return {
    labelStem,
    pages,
    manifest: {
      name: project.name,
      slug: project.slug,
      exportedAt: new Date().toISOString(),
      kind: "publication",
      pages: pages.length,
      scenes: Array.from(new Set(pages.map((page) => page.sceneId))).length,
      sourceSnapshot,
    },
  };
}

// ============================================================================
// Fonction Inngest
// ============================================================================

export const exportProjectFunction = inngest.createFunction(
  {
    id: "export-project",
    name: "Export Project",
    retries: 2,
    triggers: [{ event: "kuti/export-project" }],
  },
  async ({ event, step }) => {
    const { projectId, exportId, kind, format } = event.data;
    try {
      // ============================================================================
      // Step 1: Récupérer les informations du projet et de l'export
      // ============================================================================
      const context = await step.run("fetch-context", async () => {
        const [project, exportRecord] = await Promise.all([
          db.project.findUnique({
            where: { id: projectId },
            include: {
              characters: {
                include: {
                  sourceRelations: true,
                  targetRelations: true,
                  voiceSamples: true,
                  images: true,
                },
              },
              characterRelations: true,
              tomes: {
                include: {
                  chapters: {
                    include: {
                      scenes: {
                        include: {
                          references: true,
                        },
                      },
                    },
                  },
                },
              },
              chapters: true,
              scenes: true,
              storyReferences: true,
              generationJobs: {
                include: {
                  steps: true,
                },
              },
              generationBoards: {
                include: {
                  panels: true,
                },
              },
              sceneGenerationConfigs: true,
              sceneMangaPages: true,
              warnings: true,
            },
          }),
          db.exportRecord.findUnique({ where: { id: exportId } }),
        ]);

        if (!project) throw new Error(`Project ${projectId} not found`);
        if (!exportRecord) throw new Error(`Export ${exportId} not found`);

        return { project, exportRecord };
      });

      const { project, exportRecord } = context;
      const sourceSnapshot = readSourceSnapshot(objectRecord(exportRecord.metadataJson).sourceSnapshot);

      // ============================================================================
      // Step 2: Mettre à jour le statut à running
      // ============================================================================
      await step.run("update-export-running", async () => {
        await db.exportRecord.update({
          where: { id: exportId },
          data: {
            summary: "Starting export...",
          },
        });
      });

      // ============================================================================
      // Step 3: Générer l'export selon le format
      // ============================================================================
      let result: { filePath: string; publicUrl: string; fileName: string; fileSize: number };

      type ExportResult = { filePath: string; publicUrl: string; fileName: string; fileSize: number };

      switch (format) {
        case "json":
          result = await step.run("export-json", async () => {
            return await exportAsJson(project, exportRecord.label, kind, sourceSnapshot);
          }) as ExportResult;
          break;

        case "tree":
          result = await step.run("export-tree", async () => {
            return await exportAsTree(project, exportRecord.label, kind, sourceSnapshot);
          }) as ExportResult;
          break;

        case "zip":
          result = await step.run("export-zip", async () => {
            return await exportAsZip(project, exportRecord.label, kind, sourceSnapshot);
          }) as ExportResult;
          break;

        case "paged_images":
          result = await step.run("export-paged-images", async () => {
            return await exportPublicationAsPagedImages(project, exportRecord.label, sourceSnapshot);
          }) as ExportResult;
          break;

        case "pdf":
          result = await step.run("export-pdf", async () => {
            return await exportPublicationAsPdf(project, exportRecord.label, sourceSnapshot);
          }) as ExportResult;
          break;

        case "cbz":
          result = await step.run("export-cbz", async () => {
            return await exportPublicationAsCbz(project, exportRecord.label, sourceSnapshot);
          }) as ExportResult;
          break;

        case "epub":
          result = await step.run("export-epub", async () => {
            return await exportPublicationAsEpub(project, exportRecord.label, sourceSnapshot);
          }) as ExportResult;
          break;

        default:
          throw new Error(`Unknown export format: ${format}`);
      }

      // ============================================================================
      // Step 4: Finaliser l'export
      // ============================================================================
      await step.run("finalize-export", async () => {
        await db.exportRecord.update({
          where: { id: exportId },
          data: {
            status: "ready" as ExportStatus,
            artifactPath: result.filePath,
            publicUrl: result.publicUrl,
            artifactName: result.fileName,
            sizeBytes: result.fileSize,
            completedAt: new Date(),
            summary: `${kind} export completed: ${format} format`,
            metadataJson: {
              ...objectRecord(exportRecord.metadataJson),
              exportedAt: new Date().toISOString(),
              entityCounts: {
                characters: project.characters.length,
                tomes: project.tomes.length,
                chapters: project.chapters.length,
                scenes: project.scenes.length,
              },
            },
          },
        });
      });

      return {
        success: true,
        exportId,
        format,
        kind,
        filePath: result.filePath,
        publicUrl: result.publicUrl,
        fileName: result.fileName,
        fileSize: result.fileSize,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      try {
        await db.exportRecord.update({
          where: { id: exportId },
          data: {
            status: "failed" as ExportStatus,
            failedAt: new Date(),
            summary: `Export failed: ${format}`,
            errorMessage: message,
          },
        });
      } catch (updateError) {
        console.error("Failed to persist export failure", updateError);
      }

      console.error("Export project failed", {
        projectId,
        exportId,
        kind,
        format,
        message,
      });

      throw error;
    }
  },
);

// ============================================================================
// Export en JSON
// ============================================================================

async function exportAsJson(
  project: Record<string, unknown>,
  label: string,
  kind: "work" | "publication",
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const exportData: Record<string, unknown> = {
    exportFormat: "json",
    exportKind: kind,
    exportedAt: new Date().toISOString(),
    label,
    sourceSnapshot,
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      settings: project.settingsJson,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    data: {},
  };

  if (kind === "work") {
    // Export travail: tout sauf les données sensibles ou trop volumineuses
    exportData.data = {
      characters: project.characters,
      characterRelations: project.characterRelations,
      voiceSamples: project.voiceSamples,
      tomes: project.tomes,
      chapters: project.chapters,
      scenes: project.scenes,
      storyReferences: project.storyReferences,
      assets: project.assets,
      assetLinks: project.assetLinks,
      sceneGenerationConfigs: project.sceneGenerationConfigs,
      sceneMangaPages: project.sceneMangaPages,
      generationJobs: project.generationJobs,
      generationBoards: project.generationBoards,
      warnings: project.warnings,
      versions: project.versions,
    };
  } else {
    // Export publication: uniquement les données de publication
    const publication = await collectPublicationAssets(project, label, sourceSnapshot);

    exportData.data = {
      tomes: project.tomes,
      sceneMangaPages: publication.pages,
    };
  }

  const jsonContent = JSON.stringify(exportData, null, 2);
  const fileName = `export_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.json`;

  return await writeExportToPublic(project.id as string, fileName, jsonContent);
}

// ============================================================================
// Export en arborescence de fichiers
// ============================================================================

async function exportAsTree(
  project: Record<string, unknown>,
  label: string,
  kind: "work" | "publication",
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const exportDir = `${getProjectDir(project.slug as string)}/exports/tree_${Date.now()}`;
  await mkdir(exportDir, { recursive: true });

  // Manifest du projet
  const publication = kind === "publication"
    ? await collectPublicationAssets(project, label, sourceSnapshot)
    : null;
  const manifest = publication
    ? {
        ...publication.manifest,
        label,
        format: "tree",
      }
    : buildExportManifest(project, kind, "tree", sourceSnapshot);
  await writeFile(`${exportDir}/manifest.json`, JSON.stringify(manifest, null, 2));

  if (kind === "work") {
    // Exporter les personnages
    const characters = project.characters as Array<Record<string, unknown>>;
    await mkdir(`${exportDir}/characters`, { recursive: true });
    for (const char of characters) {
      await writeFile(`${exportDir}/characters/${char.slug}.json`, JSON.stringify(char, null, 2));
    }

    // Exporter l'histoire
    const tomes = project.tomes as Array<Record<string, unknown>>;
    await mkdir(`${exportDir}/story`, { recursive: true });
    for (const tome of tomes) {
      const tomeDir = `${exportDir}/story/${tome.slug}`;
      await mkdir(tomeDir, { recursive: true });

      const chapters = (tome.chapters || []) as Array<Record<string, unknown>>;
      for (const chapter of chapters) {
        const chapterDir = `${tomeDir}/${chapter.slug}`;
        await mkdir(chapterDir, { recursive: true });

        const scenes = (chapter.scenes || []) as Array<Record<string, unknown>>;
        for (const scene of scenes) {
          await writeFile(`${chapterDir}/${scene.slug}.md`, generateSceneMarkdown(scene));
        }
      }
    }

    // Exporter les assets (références uniquement)
    const assets = project.assets as Array<Record<string, unknown>>;
    await mkdir(`${exportDir}/assets`, { recursive: true });
    await writeFile(`${exportDir}/assets/index.json`, JSON.stringify(assets, null, 2));
  } else {
    // Export publication: seulement les pages manga
    await mkdir(`${exportDir}/pages`, { recursive: true });

    for (const page of publication?.pages ?? []) {
      await mkdir(`${exportDir}/pages/${page.sceneId}`, { recursive: true });
      try {
        const { buffer, mimeType } = await readBinarySource(page.imagePath);
        const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
        const destPath = `${exportDir}/pages/${page.sceneId}/page_${String(page.pageNumber).padStart(3, "0")}${extension}`;
        await writeFile(destPath, buffer);
      } catch {
        // Ignorer si l'image n'est pas lisible
      }
    }
  }

  // Créer un ZIP de l'arborescence
  const zipFileName = `export_tree_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.zip`;

  const zip = new StoreZipWriter();
  await addDirectoryToZip(zip, exportDir, "");
  const zipBuffer = await zip.end();

  return await writeExportToPublic(project.id as string, zipFileName, zipBuffer);
}

// ============================================================================
// Export en ZIP (portable)
// ============================================================================

async function exportAsZip(
  project: Record<string, unknown>,
  label: string,
  kind: "work" | "publication",
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const zipFileName = `export_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.zip`;
  let zipBuffer: Buffer;

  if (kind === "work") {
    // Export travail: données JSON + assets
    const exportData = {
      manifest: {
        ...buildExportManifest(project, "work", "zip", sourceSnapshot),
        version: "1.0",
      },
      data: {
        project: {
          id: project.id,
          name: project.name,
          slug: project.slug,
          settings: project.settingsJson,
        },
        characters: project.characters,
        characterRelations: project.characterRelations,
        tomes: project.tomes,
        chapters: project.chapters,
        scenes: project.scenes,
        storyReferences: project.storyReferences,
        assets: project.assets,
        sceneGenerationConfigs: project.sceneGenerationConfigs,
        sceneMangaPages: project.sceneMangaPages,
        generationJobs: project.generationJobs,
        generationBoards: project.generationBoards,
        versions: project.versions,
        warnings: project.warnings,
      },
    };

    const zip = new StoreZipWriter();

    // Ajouter le manifest et les données
    zip.add("manifest.json", Buffer.from(JSON.stringify(exportData.manifest, null, 2)));
    zip.add("data.json", Buffer.from(JSON.stringify(exportData.data, null, 2)));

    // Ajouter les fichiers d'assets si disponibles
    const assets = project.assets as Array<Record<string, unknown>>;

    for (const asset of assets) {
      const storagePath = asset.storagePath as string;
      if (storagePath) {
        try {
          const buffer = await Bun.file(storagePath).arrayBuffer();
          zip.add(`assets/${asset.slug}`, Buffer.from(buffer));
        } catch {
          // Ignorer si le fichier n'existe pas
        }
      }
    }

    // Ajouter les images générées
    const characters = project.characters as Array<Record<string, unknown>>;
    for (const char of characters) {
      const images = (char.images || []) as Array<Record<string, unknown>>;
      for (const image of images) {
        const imagePath = image.filePath as string;
        if (imagePath) {
          try {
            // Support des deux formats de chemins (ancien et nouveau)
            const resolvedPath = imagePath.startsWith("/") || imagePath.startsWith("./")
              ? imagePath
              : `public/${imagePath}`;
            const buffer = await Bun.file(resolvedPath).arrayBuffer();
            zip.add(`characters/${char.slug}/${image.fileName}`, Buffer.from(buffer));
          } catch {
            // Ignorer si le fichier n'existe pas
          }
        }
      }
    }

    zipBuffer = await zip.end();
  } else {
    // Export publication: uniquement les pages manga en format lisible
    const publication = await collectPublicationAssets(project, label, sourceSnapshot);
    const zip = new StoreZipWriter();

    // Manifest
    const manifest = {
      ...publication.manifest,
      label,
      format: "zip",
    };
    zip.add("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));

    // Pages manga
    for (const page of publication.pages) {
      try {
        const { buffer, mimeType } = await readBinarySource(page.imagePath);
        const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
        zip.add(`pages/${safeStem(page.tomeSlug)}/${safeStem(page.chapterSlug)}/${safeStem(page.sceneSlug)}/page_${String(page.pageNumber).padStart(3, "0")}${extension}`, buffer);
      } catch {
        // Ignorer si le fichier n'est pas lisible
      }
    }

    zipBuffer = await zip.end();
  }

  return await writeExportToPublic(project.id as string, zipFileName, zipBuffer);
}

// ============================================================================
// Publication exports
// ============================================================================

async function exportPublicationAsPagedImages(
  project: Record<string, unknown>,
  label: string,
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const publication = await collectPublicationAssets(project, label, sourceSnapshot);
  const zip = new StoreZipWriter();

  zip.add(
    "manifest.json",
    Buffer.from(
      JSON.stringify({
        ...publication.manifest,
        label,
        format: "paged_images",
      }, null, 2),
    ),
  );

  zip.add(
    "pages/index.json",
    Buffer.from(JSON.stringify({
      exportedAt: publication.manifest.exportedAt,
      pages: publication.pages.map((page) => ({
        sceneId: page.sceneId,
        sceneSlug: page.sceneSlug,
        sceneTitle: page.sceneTitle,
        tomeSlug: page.tomeSlug,
        chapterSlug: page.chapterSlug,
        pageNumber: page.pageNumber,
        label: page.label,
        caption: page.caption,
        prompt: page.prompt,
        status: page.status,
      })),
    }, null, 2)),
  );

  for (const page of publication.pages) {
    const { buffer, mimeType } = await readBinarySource(page.imagePath);
    const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
    const filePath = [
      "pages",
      safeStem(page.tomeSlug),
      safeStem(page.chapterSlug),
      safeStem(page.sceneSlug),
      `page_${String(page.pageNumber).padStart(3, "0")}${extension}`,
    ].join("/");

    zip.add(filePath, buffer);
  }

  const fileName = `publication_${publication.labelStem}_${Date.now()}.zip`;
  const zipBuffer = await zip.end();

  return await writeExportToPublic(project.id as string, fileName, zipBuffer);
}

async function exportPublicationAsCbz(
  project: Record<string, unknown>,
  label: string,
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const publication = await collectPublicationAssets(project, label, sourceSnapshot);
  const zip = new StoreZipWriter();

  zip.add(
    "manifest.json",
    Buffer.from(
      JSON.stringify({
        ...publication.manifest,
        label,
        format: "cbz",
      }, null, 2),
    ),
  );

  zip.add(
    "pages/index.json",
    Buffer.from(JSON.stringify({
      exportedAt: publication.manifest.exportedAt,
      pages: publication.pages.map((page) => ({
        sceneId: page.sceneId,
        sceneSlug: page.sceneSlug,
        sceneTitle: page.sceneTitle,
        tomeSlug: page.tomeSlug,
        chapterSlug: page.chapterSlug,
        pageNumber: page.pageNumber,
        label: page.label,
        status: page.status,
      })),
    }, null, 2)),
  );

  for (const page of publication.pages) {
    const { buffer, mimeType } = await readBinarySource(page.imagePath);
    const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
    const filePath = `page_${String(page.pageNumber).padStart(3, "0")}${extension}`;
    zip.add(filePath, buffer);
  }

  const fileName = `publication_${publication.labelStem}_${Date.now()}.cbz`;
  const zipBuffer = await zip.end();

  return await writeExportToPublic(project.id as string, fileName, zipBuffer);
}

async function exportPublicationAsPdf(
  project: Record<string, unknown>,
  label: string,
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const publication = await collectPublicationAssets(project, label, sourceSnapshot);
  const pdf = await PDFDocument.create();

  for (const page of publication.pages) {
    const { buffer, mimeType } = await readBinarySource(page.imagePath);
    if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
      throw new Error(`Unsupported image format for PDF export: ${mimeType}`);
    }

    const embeddedImage = mimeType === "image/jpeg"
      ? await pdf.embedJpg(buffer)
      : await pdf.embedPng(buffer);

    const pdfPage = pdf.addPage([embeddedImage.width, embeddedImage.height]);
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    });
  }

  const fileName = `publication_${publication.labelStem}_${Date.now()}.pdf`;
  const pdfBytes = await pdf.save();

  return await writeExportToPublic(project.id as string, fileName, Buffer.from(pdfBytes));
}

async function exportPublicationAsEpub(
  project: Record<string, unknown>,
  label: string,
  sourceSnapshot: ExportSourceSnapshot | null,
): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const publication = await collectPublicationAssets(project, label, sourceSnapshot);
  const zip = new StoreZipWriter();
  const title = String(project.name || project.slug || label);
  const bookId = `urn:uuid:${randomUUIDv7()}`;

  zip.add("mimetype", Buffer.from("application/epub+zip"));
  zip.add(
    "META-INF/container.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`),
  );

  const imageItems: string[] = [];
  const xhtmlItems: string[] = [];
  const navLinks: string[] = [];

  for (const page of publication.pages) {
    const { buffer, mimeType } = await readBinarySource(page.imagePath);
    const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/webp" ? ".webp" : ".png";
    const safeSceneSlug = safeStem(page.sceneSlug);
    const safePageSlug = `page_${String(page.pageNumber).padStart(3, "0")}`;
    const imagePath = `OEBPS/Images/${safeSceneSlug}_${safePageSlug}${extension}`;
    const xhtmlPath = `OEBPS/Text/${safeSceneSlug}_${safePageSlug}.xhtml`;

    imageItems.push(`    <item id="${safeSceneSlug}_${safePageSlug}_image" href="Images/${safeSceneSlug}_${safePageSlug}${extension}" media-type="${mimeType === "image/jpeg" ? "image/jpeg" : mimeType === "image/webp" ? "image/webp" : "image/png"}" />`);
    xhtmlItems.push(`    <item id="${safeSceneSlug}_${safePageSlug}_xhtml" href="Text/${safeSceneSlug}_${safePageSlug}.xhtml" media-type="application/xhtml+xml" />`);
    navLinks.push(`          <li><a href="Text/${safeSceneSlug}_${safePageSlug}.xhtml">${page.sceneTitle} - ${page.label}</a></li>`);

    zip.add(imagePath, buffer);
    zip.add(xhtmlPath, Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
  <head>
    <title>${page.sceneTitle} - ${page.label}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" type="text/css" href="../Styles/style.css" />
  </head>
  <body>
    <section class="page">
      <img src="../Images/${safeSceneSlug}_${safePageSlug}${extension}" alt="${page.label}" />
    </section>
  </body>
</html>`));
  }

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${title}</h1>
      <ol>
${navLinks.join("\n")}
      </ol>
    </nav>
  </body>
</html>`;

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
${imageItems.join("\n")}
${xhtmlItems.join("\n")}
    <item id="style" href="Styles/style.css" media-type="text/css" />
  </manifest>
  <spine>
${publication.pages.map((page) => `    <itemref idref="${safeStem(page.sceneSlug)}_page_${String(page.pageNumber).padStart(3, "0")}_xhtml" />`).join("\n")}
  </spine>
</package>`;

  zip.add("OEBPS/nav.xhtml", Buffer.from(navXhtml));
  zip.add("OEBPS/content.opf", Buffer.from(contentOpf));
  zip.add("OEBPS/Styles/style.css", Buffer.from(`body { margin: 0; padding: 0; background: #000; }
.page { margin: 0; padding: 0; }
img { display: block; width: 100%; height: auto; }`));

  const fileName = `publication_${publication.labelStem}_${Date.now()}.epub`;
  const epubBuffer = await zip.end();

  return await writeExportToPublic(project.id as string, fileName, epubBuffer);
}

// ============================================================================
// Helpers
// ============================================================================

function generateSceneMarkdown(scene: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`# ${scene.title}`);
  lines.push("");

  if (scene.summary) {
    lines.push(`> ${scene.summary}`);
    lines.push("");
  }

  const chars = scene.charactersJson as string[];
  if (chars && chars.length > 0) {
    lines.push(`**Characters:** ${chars.join(", ")}`);
    lines.push("");
  }

  if (scene.location) {
    lines.push(`**Location:** ${scene.location}`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  if (scene.content) {
    lines.push(String(scene.content));
  }

  if (scene.notes) {
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("### Notes");
    lines.push(String(scene.notes));
  }

  return lines.join("\n");
}

async function addDirectoryToZip(zip: ZipWriterLike, dirPath: string, zipPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const zipEntryPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, zipEntryPath);
    } else {
      const buffer = await Bun.file(fullPath).arrayBuffer();
      zip.add(zipEntryPath, Buffer.from(buffer));
    }
  }
}
