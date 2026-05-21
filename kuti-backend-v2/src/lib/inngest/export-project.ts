/**
 * Fonction Inngest pour l'export de projet
 * Export en JSON, arborescence, ou ZIP
 */

import { mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { randomUUIDv7 } from "bun";
import { db } from "../db";
import type { ExportStatus } from "../db/generated/enums";
import { saveExportFile, writeFile } from "../filesystem";
import { inngest } from "./client";
import { getProjectDir } from "../paths";

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
            assets: {
              include: {
                links: true,
              },
            },
            assetLinks: true,
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
            versions: true,
          },
        }),
        db.exportRecord.findUnique({ where: { id: exportId } }),
      ]);

      if (!project) throw new Error(`Project ${projectId} not found`);
      if (!exportRecord) throw new Error(`Export ${exportId} not found`);

      return { project, exportRecord };
    });

    const { project, exportRecord } = context;

    // ============================================================================
    // Step 2: Mettre à jour le statut à running
    // ============================================================================
    await step.run("update-export-running", async () => {
      await db.exportRecord.update({
        where: { id: exportId },
        data: {
          status: "pending" as ExportStatus,
          summary: "Starting export...",
        },
      });
    });

    // ============================================================================
    // Step 3: Générer l'export selon le format
    // ============================================================================
    let result: { filePath: string; fileName: string; fileSize: number };

    switch (format) {
      case "json":
        result = await step.run("export-json", async () => {
          return await exportAsJson(project, exportRecord.label, kind);
        });
        break;

      case "tree":
        result = await step.run("export-tree", async () => {
          return await exportAsTree(project, exportRecord.label, kind);
        });
        break;

      case "zip":
        result = await step.run("export-zip", async () => {
          return await exportAsZip(project, exportRecord.label, kind);
        });
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
          artifactName: result.fileName,
          sizeBytes: result.fileSize,
          completedAt: new Date(),
          summary: `${kind} export completed: ${format} format`,
          metadataJson: {
            ...exportRecord.metadataJson,
            exportedAt: new Date().toISOString(),
            entityCounts: {
              characters: project.characters.length,
              tomes: project.tomes.length,
              chapters: project.chapters.length,
              scenes: project.scenes.length,
              assets: project.assets.length,
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
      fileName: result.fileName,
      fileSize: result.fileSize,
    };
  },
);

// ============================================================================
// Export en JSON
// ============================================================================

async function exportAsJson(project: Record<string, unknown>, label: string, kind: "work" | "publication"): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const exportData: Record<string, unknown> = {
    exportFormat: "json",
    exportKind: kind,
    exportedAt: new Date().toISOString(),
    label,
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
    exportData.data = {
      tomes: project.tomes,
      sceneMangaPages: project.sceneMangaPages,
    };
  }

  const jsonContent = JSON.stringify(exportData, null, 2);
  const fileName = `export_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.json`;
  const filePath = `${getProjectDir(project.slug as string)}/exports/${fileName}`;

  await writeFile(filePath, jsonContent);
  const stats = await stat(filePath);

  return {
    filePath,
    fileName,
    fileSize: stats.size,
  };
}

// ============================================================================
// Export en arborescence de fichiers
// ============================================================================

async function exportAsTree(project: Record<string, unknown>, label: string, kind: "work" | "publication"): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const exportDir = `${getProjectDir(project.slug as string)}/exports/tree_${Date.now()}`;
  await mkdir(exportDir, { recursive: true });

  // Manifest du projet
  const manifest = {
    name: project.name,
    slug: project.slug,
    exportedAt: new Date().toISOString(),
    kind,
    format: "tree",
  };
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
    const sceneMangaPages = project.sceneMangaPages as Array<Record<string, unknown>>;
    await mkdir(`${exportDir}/pages`, { recursive: true });

    // Grouper par scène
    const pagesByScene: Record<string, Array<Record<string, unknown>>> = {};
    for (const page of sceneMangaPages) {
      const sceneId = page.sceneId as string;
      if (!pagesByScene[sceneId]) pagesByScene[sceneId] = [];
      pagesByScene[sceneId].push(page);
    }

    for (const [sceneId, pages] of Object.entries(pagesByScene)) {
      await mkdir(`${exportDir}/pages/${sceneId}`, { recursive: true });
      for (const page of pages) {
        if (page.imageUrl) {
          // Copier l'image si elle existe
          const srcPath = page.imageUrl as string;
          const destPath = `${exportDir}/pages/${sceneId}/page_${page.pageNumber}.png`;
          try {
            const buffer = await Bun.file(srcPath).arrayBuffer();
            await writeFile(destPath, Buffer.from(buffer));
          } catch {
            // Ignorer si le fichier n'existe pas
          }
        }
      }
    }
  }

  // Créer un ZIP de l'arborescence
  const zipFileName = `export_tree_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.zip`;
  const zipFilePath = `${getProjectDir(project.slug as string)}/exports/${zipFileName}`;

  const zip = new Bun.ZipWriter();
  await addDirectoryToZip(zip, exportDir, "");
  const zipBuffer = await zip.end();
  await writeFile(zipFilePath, zipBuffer);

  const stats = await stat(zipFilePath);

  return {
    filePath: zipFilePath,
    fileName: zipFileName,
    fileSize: stats.size,
  };
}

// ============================================================================
// Export en ZIP (portable)
// ============================================================================

async function exportAsZip(project: Record<string, unknown>, label: string, kind: "work" | "publication"): Promise<{ filePath: string; fileName: string; fileSize: number }> {
  const zipFileName = `export_${label.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.zip`;
  const zipFilePath = `${getProjectDir(project.slug as string)}/exports/${zipFileName}`;

  if (kind === "work") {
    // Export travail: données JSON + assets
    const exportData = {
      manifest: {
        name: project.name,
        slug: project.slug,
        exportedAt: new Date().toISOString(),
        kind: "work",
        format: "zip",
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

    const zip = new Bun.ZipWriter();

    // Ajouter le manifest et les données
    zip.add("manifest.json", Buffer.from(JSON.stringify(exportData.manifest, null, 2)));
    zip.add("data.json", Buffer.from(JSON.stringify(exportData.data, null, 2)));

    // Ajouter les fichiers d'assets si disponibles
    const assets = project.assets as Array<Record<string, unknown>>;
    await mkdir(`${getProjectDir(project.slug as string)}/exports`, { recursive: true });

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
        const filePath = image.filePath as string;
        if (filePath) {
          try {
            const buffer = await Bun.file(filePath).arrayBuffer();
            zip.add(`characters/${char.slug}/${image.fileName}`, Buffer.from(buffer));
          } catch {
            // Ignorer si le fichier n'existe pas
          }
        }
      }
    }

    const zipBuffer = await zip.end();
    await writeFile(zipFilePath, zipBuffer);
  } else {
    // Export publication: uniquement les pages manga en format lisible
    const zip = new Bun.ZipWriter();

    // Manifest
    const manifest = {
      name: project.name,
      slug: project.slug,
      exportedAt: new Date().toISOString(),
      kind: "publication",
      format: "zip",
    };
    zip.add("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));

    // Pages manga
    const sceneMangaPages = project.sceneMangaPages as Array<Record<string, unknown>>;
    for (const page of sceneMangaPages) {
      if (page.imageUrl) {
        try {
          const buffer = await Bun.file(page.imageUrl as string).arrayBuffer();
          zip.add(`pages/${page.tomeId}/${page.chapterId}/${page.sceneId}/page_${String(page.pageNumber).padStart(3, "0")}.png`, Buffer.from(buffer));
        } catch {
          // Ignorer si le fichier n'existe pas
        }
      }
    }

    const zipBuffer = await zip.end();
    await writeFile(zipFilePath, zipBuffer);
  }

  const stats = await stat(zipFilePath);

  return {
    filePath: zipFilePath,
    fileName: zipFileName,
    fileSize: stats.size,
  };
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

async function addDirectoryToZip(zip: Bun.ZipWriter, dirPath: string, zipPath: string): Promise<void> {
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
