/**
 * Controller Assets - Logique métier
 */

import { db } from "@lib/db";
import { fileExists, readFile, writeFile, deleteFile, getFileStats } from "@lib/filesystem";
import { getAssetsDir, sanitizeFileName, getFileExtension } from "@lib/paths";
import type {
  CreateAssetBody,
  UpdateAssetBody,
  ImportAssetBody,
  CreateAssetLinkBody,
} from "./dto";
import { randomUUIDv7 } from "bun";
import { createHash } from "node:crypto";

// ============================================================================
// CRUD Assets
// ============================================================================

export async function listAssets(projectId: string) {
  const assets = await db.asset.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return assets.map((asset) => ({
    ...asset,
    tags: asset.tagsJson as string[],
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    archivedAt: asset.archivedAt?.toISOString() || null,
  }));
}

export async function getAsset(projectId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
    include: { links: true },
  });

  if (!asset) return null;

  // Récupérer les usages de l'asset
  const usages: Array<{ kind: string; id: string; name: string }> = [];

  // Vérifier dans les personnages (images)
  const characterImages = await db.characterImage.findMany({
    where: { 
      filePath: { contains: asset.storagePath }
    },
    include: { character: true },
  });
  for (const img of characterImages) {
    usages.push({
      kind: "character_image",
      id: img.characterId,
      name: img.character.name,
    });
  }

  // Vérifier dans les générations
  const generationPanels = await db.generationBoardPanel.findMany({
    where: {
      imagePath: { contains: asset.storagePath }
    },
  });
  for (const panel of generationPanels) {
    usages.push({
      kind: "generation_panel",
      id: panel.boardId,
      name: panel.title,
    });
  }

  return {
    ...asset,
    tags: asset.tagsJson as string[],
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    archivedAt: asset.archivedAt?.toISOString() || null,
    links: asset.links.map((link) => ({
      ...link,
      createdAt: link.createdAt.toISOString(),
    })),
    usages,
  };
}

export async function createAsset(
  projectId: string,
  data: CreateAssetBody,
  fileData: { buffer: Buffer; originalName: string; mimeType: string }
) {
  // Vérifier si le slug existe déjà
  const existing = await db.asset.findFirst({
    where: { projectId, slug: data.slug },
  });
  if (existing) {
    throw new Error("Asset with this slug already exists");
  }

  // Obtenir le projet pour le slug
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { slug: true },
  });
  if (!project) throw new Error("Project not found");

  // Calculer le checksum
  const checksum = createHash("sha256").update(fileData.buffer).digest("hex");

  // Générer le nom de fichier unique
  const sanitizedName = sanitizeFileName(fileData.originalName);
  const ext = getFileExtension(sanitizedName) || ".bin";
  const fileName = `${randomUUIDv7("base64url")}${ext}`;
  
  // Déterminer le sous-dossier selon le type MIME
  const folder = getFolderFromMimeType(fileData.mimeType);
  const storagePath = `${getAssetsDir(project.slug)}/${folder}/${fileName}`;

  // Sauvegarder le fichier
  await writeFile(storagePath, fileData.buffer);
  const stats = await getFileStats(storagePath);

  // Créer l'asset en base
  const asset = await db.asset.create({
    data: {
      projectId,
      slug: data.slug,
      name: data.name,
      originalFilename: fileData.originalName,
      mimeType: fileData.mimeType,
      checksum,
      sizeBytes: stats.size,
      storagePath,
      description: data.description || "",
      tagsJson: data.tags || [],
      status: "active",
    },
  });

  return {
    ...asset,
    tags: asset.tagsJson as string[],
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    archivedAt: null,
  };
}

export async function importAsset(
  projectId: string,
  data: ImportAssetBody
) {
  // Lire le fichier source
  const buffer = await readFile(data.sourcePath);
  const stats = await getFileStats(data.sourcePath);
  const mimeType = detectMimeType(buffer);
  const originalName = data.sourcePath.split("/").pop() || "unknown";

  return createAsset(
    projectId,
    {
      name: data.name,
      slug: data.slug,
      description: data.description,
      tags: data.tags,
    },
    {
      buffer,
      originalName,
      mimeType,
    }
  );
}

export async function updateAsset(
  projectId: string,
  assetId: string,
  data: UpdateAssetBody
) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
  });

  if (!asset) return null;

  const updated = await db.asset.update({
    where: { id: assetId },
    data: {
      name: data.name,
      description: data.description,
      tagsJson: data.tags,
    },
  });

  return {
    ...updated,
    tags: updated.tagsJson as string[],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    archivedAt: updated.archivedAt?.toISOString() || null,
  };
}

export async function archiveAsset(projectId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
  });

  if (!asset) return null;

  const updated = await db.asset.update({
    where: { id: assetId },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });

  return {
    ...updated,
    tags: updated.tagsJson as string[],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    archivedAt: updated.archivedAt?.toISOString() || null,
  };
}

export async function deleteAsset(projectId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
  });

  if (!asset) return false;

  // Supprimer les liens d'abord
  await db.assetLink.deleteMany({
    where: { assetId },
  });

  // Supprimer le fichier physique
  try {
    await deleteFile(asset.storagePath);
  } catch {
    // Ignorer si le fichier n'existe pas
  }

  // Supprimer l'asset en base
  await db.asset.delete({
    where: { id: assetId },
  });

  return true;
}

export async function getAssetFile(projectId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
  });

  if (!asset) return null;

  try {
    const buffer = await readFile(asset.storagePath);
    return {
      buffer,
      mimeType: asset.mimeType,
      fileName: asset.originalFilename,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Asset Links
// ============================================================================

export async function listAssetLinks(projectId: string, assetId: string) {
  const links = await db.assetLink.findMany({
    where: { projectId, assetId },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({
    ...link,
    createdAt: link.createdAt.toISOString(),
  }));
}

export async function createAssetLink(
  projectId: string,
  assetId: string,
  data: CreateAssetLinkBody
) {
  // Vérifier que l'asset existe
  const asset = await db.asset.findFirst({
    where: { id: assetId, projectId },
  });
  if (!asset) throw new Error("Asset not found");

  // Vérifier que la cible existe
  const targetExists = await verifyTargetExists(
    projectId,
    data.targetKind,
    data.targetId
  );
  if (!targetExists) throw new Error("Target not found");

  const link = await db.assetLink.create({
    data: {
      projectId,
      assetId,
      targetKind: data.targetKind,
      targetId: data.targetId,
      note: data.note || "",
    },
  });

  return {
    ...link,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function deleteAssetLink(
  projectId: string,
  assetId: string,
  linkId: string
) {
  const link = await db.assetLink.findFirst({
    where: { id: linkId, projectId, assetId },
  });

  if (!link) return false;

  await db.assetLink.delete({
    where: { id: linkId },
  });

  return true;
}

// ============================================================================
// Helpers
// ============================================================================

function getFolderFromMimeType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "documents";
  return "files";
}

function detectMimeType(buffer: Buffer): string {
  // Signature PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  // Signature JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  // Signature GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  // Signature WebP
  if (buffer[8] === 0x57 && buffer[9] === 0x45) return "image/webp";
  // Signature PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50) return "application/pdf";
  // Par défaut
  return "application/octet-stream";
}

async function verifyTargetExists(
  projectId: string,
  kind: string,
  id: string
): Promise<boolean> {
  switch (kind) {
    case "character":
      const char = await db.character.findFirst({
        where: { id, projectId },
      });
      return !!char;
    case "scene":
      const scene = await db.scene.findFirst({
        where: { id, projectId },
      });
      return !!scene;
    case "chapter":
      const chapter = await db.chapter.findFirst({
        where: { id, projectId },
      });
      return !!chapter;
    case "tome":
      const tome = await db.tome.findFirst({
        where: { id, projectId },
      });
      return !!tome;
    default:
      return false;
  }
}
