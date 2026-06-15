/**
 * Gestion du stockage de fichiers local (filesystem)
 * Remplace le stockage S3 dans cette version
 * Équivalent aux fonctions de files.py du backend v1
 */

import {
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  unlink as fsUnlink,
  access as fsAccess,
  mkdir as fsMkdir,
  stat as fsStat,
} from "node:fs/promises";
import { constants } from "node:fs";
import { randomUUIDv7 } from "bun";
import { getFileExtension, sanitizeFileName } from "./paths";

// ============================================================================
// Errors
// ============================================================================

export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "FileSystemError";
  }
}

// ============================================================================
// Opérations de base
// ============================================================================

/**
 * Vérifie si un fichier existe
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await fsAccess(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lecture d'un fichier
 */
export async function readFile(path: string): Promise<Buffer> {
  try {
    return await fsReadFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new FileSystemError(`File not found: ${path}`, "ENOENT");
    }
    throw error;
  }
}

/**
 * Écriture d'un fichier
 * Crée automatiquement les répertoires parents si nécessaire
 */
export async function writeFile(
  path: string,
  data: Buffer | string
): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf("/"));
  await fsMkdir(dir, { recursive: true });
  await fsWriteFile(path, data);
}

/**
 * Suppression d'un fichier
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    await fsUnlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    // Silencieux si le fichier n'existe pas
  }
}

/**
 * Récupère les métadonnées d'un fichier
 */
export async function getFileStats(path: string): Promise<{
  size: number;
  createdAt: Date;
  modifiedAt: Date;
}> {
  const stats = await fsStat(path);
  return {
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
  };
}

// ============================================================================
// Helpers pour la génération de noms de fichiers
// ============================================================================

/**
 * Génère un nom de fichier unique avec UUID v7
 */
export function generateUniqueFileName(
  originalName: string,
  prefix?: string
): string {
  const ext = getFileExtension(originalName) || ".bin";
  const basePrefix = prefix ? `${prefix}_` : "";
  return `${basePrefix}${randomUUIDv7("base64url")}${ext}`;
}

/**
 * Génère un nom de fichier simple avec timestamp
 */
export function generateTimestampFileName(
  originalName: string,
  prefix?: string
): string {
  const ext = getFileExtension(originalName) || ".bin";
  const basePrefix = prefix ? `${prefix}_` : "";
  const timestamp = Date.now();
  return `${basePrefix}${timestamp}${ext}`;
}

// ============================================================================
// Opérations métier spécifiques à Kuti
// ============================================================================

/**
 * Sauvegarde un asset dans le répertoire du projet
 */
export async function saveAsset(
  projectDir: string,
  folder: string,
  fileName: string,
  data: Buffer
): Promise<{ path: string; url: string }> {
  const sanitizedName = sanitizeFileName(fileName);
  const uniqueName = generateUniqueFileName(sanitizedName, "asset");
  const fullPath = `${projectDir}/assets/${folder}/${uniqueName}`;

  await writeFile(fullPath, data);

  return {
    path: fullPath,
    url: `/assets/${folder}/${uniqueName}`,
  };
}

/**
 * Sauvegarde une image de personnage générée (nouveau format projectId-based)
 */
export async function saveCharacterImage(
  projectId: string,
  characterId: string,
  imageData: Buffer,
  options: {
    kind: "character_sheet" | "free_image";
    strategy: string;
    style?: string;
    variationIndex?: number;
  }
): Promise<{
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
}> {
  const { getCharacterImagesDir, getCharacterImagePublicUrl } = require("./paths");

  const dir = getCharacterImagesDir(projectId);
  const kindPrefix = options.kind === "character_sheet" ? "sheet" : "free";
  const suffix = options.style ? `_${options.style}` : "";
  const varSuffix = options.variationIndex !== undefined ? `_v${options.variationIndex + 1}` : "";
  const fileName = `char_${characterId}_${kindPrefix}_${options.strategy}${suffix}${varSuffix}_${randomUUIDv7(
    "base64url"
  )}.png`;
  const filePath = `${dir}/${fileName}`;

  await writeFile(filePath, imageData);

  const stats = await getFileStats(filePath);

  return {
    filePath: `projects/${projectId}/generation/character_images/${fileName}`,
    publicUrl: getCharacterImagePublicUrl(projectId, fileName),
    fileName,
    fileSize: stats.size,
  };
}

/**
 * Sauvegarde un panel de génération (nouveau format projectId-based dans public/)
 */
export async function saveGenerationPanel(
  projectId: string,
  jobId: string,
  panelIndex: number,
  imageData: Buffer,
  fileExtension: string = ".png"
): Promise<{
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
}> {
  const { getGenerationPanelsDir, getGenerationPanelStaticUrl } = require("./paths");

  const dir = getGenerationPanelsDir(projectId);
  const fileName = `panel_${jobId}_${panelIndex}_${randomUUIDv7("base64url")}${fileExtension}`;
  const fullPath = `${dir}/${fileName}`;

  await writeFile(fullPath, imageData);
  const stats = await getFileStats(fullPath);

  return {
    filePath: `projects/${projectId}/generation/panels/${fileName}`,
    publicUrl: getGenerationPanelStaticUrl(projectId, fileName),
    fileName,
    fileSize: stats.size,
  };
}

/**
 * Sauvegarde un fichier d'export (nouveau format projectId-based dans public/)
 */
export async function saveExportFile(
  projectId: string,
  exportId: string,
  data: Buffer,
  extension: string
): Promise<{
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number;
}> {
  const { getExportsPublicDir, getExportPublicUrl } = require("./paths");

  const dir = getExportsPublicDir(projectId);
  const fileName = `export_${exportId}${extension}`;
  const fullPath = `${dir}/${fileName}`;

  await writeFile(fullPath, data);
  const stats = await getFileStats(fullPath);

  return {
    filePath: `projects/${projectId}/exports/${fileName}`,
    publicUrl: getExportPublicUrl(projectId, fileName),
    fileName,
    fileSize: stats.size,
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Types MIME autorisés pour les uploads
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

export const ALLOWED_ASSET_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "text/plain",
  "application/json",
];

/**
 * Vérifie si un type MIME est autorisé
 */
export function isAllowedMimeType(
  mimeType: string,
  allowedTypes?: string[]
): boolean {
  return (allowedTypes ?? ALLOWED_ASSET_TYPES).includes(mimeType);
}

/**
 * Détecte le type MIME depuis un buffer (simplifié)
 */
export function detectMimeType(buffer: Buffer): string {
  // Signature PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    return "image/png";
  }
  // Signature JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }
  // Signature GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49) {
    return "image/gif";
  }
  // Signature WebP
  if (buffer[8] === 0x57 && buffer[9] === 0x45) {
    return "image/webp";
  }
  // Par défaut
  return "application/octet-stream";
}
