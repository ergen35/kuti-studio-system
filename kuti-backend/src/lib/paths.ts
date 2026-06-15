/**
 * Gestion des chemins de fichiers pour Kuti Studio
 * Remplace l'ancien paths.py du backend v1
 */

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "./config";

// ============================================================================
// Chemins de base
// ============================================================================

/**
 * Retourne le répertoire de données racine
 */
export function getDataDir(): string {
  return config.dataDir;
}

/**
 * Retourne le répertoire de la base de données
 */
export function getDatabaseDir(): string {
  return `${config.dataDir}/db`;
}

/**
 * Retourne le chemin complet vers le fichier SQLite (pour compat fallback)
 */
export function getDatabasePath(): string {
  return `${getDatabaseDir()}/kuti.sqlite`;
}

// ============================================================================
// Chemins des projets
// ============================================================================

/**
 * Retourne le répertoire d'un projet spécifique
 * @deprecated Utilisez getProjectPublicDir() avec projectId pour les nouveaux fichiers.
 * Cette fonction reste nécessaire pour la rétrocompatibilité avec les fichiers existants dans kuti-data.
 */
export function getProjectDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}`;
}

/**
 * Retourne le répertoire public associé à un projet spécifique.
 */
export function getProjectPublicDir(projectId: string): string {
  return `public/projects/${projectId}`;
}

/**
 * Retourne le chemin racine d'un projet (comme dans v1)
 */
export function getProjectRootPath(projectSlug: string): string {
  return getProjectDir(projectSlug);
}

// ============================================================================
// Sous-répertoires d'un projet
// ============================================================================

/**
 * Retourne le répertoire des assets d'un projet
 */
export function getProjectAssetsDir(projectSlug: string): string {
  return `${getProjectDir(projectSlug)}/assets`;
}

/**
 * Retourne le répertoire des exports d'un projet (ancien système kuti-data)
 * @deprecated Utilisez getExportsPublicDir() avec projectId pour les nouveaux fichiers.
 */
export function getProjectExportsDir(projectSlug: string): string {
  return `${getProjectDir(projectSlug)}/exports`;
}

/**
 * Retourne le répertoire de génération d'un projet (ancien système kuti-data)
 * @deprecated Utilisez getGenerationPanelsDir() avec projectId pour les nouveaux fichiers.
 */
export function getProjectGenerationDir(projectSlug: string): string {
  return `${getProjectDir(projectSlug)}/generation`;
}

/**
 * Retourne le répertoire d'un job de génération spécifique (ancien système kuti-data)
 * @deprecated Les nouveaux panels sont stockés dans public/ via saveGenerationPanel().
 */
export function getGenerationJobDir(
  projectSlug: string,
  jobId: string
): string {
  return `${getProjectDir(projectSlug)}/generation/${jobId}`;
}

/**
 * Retourne le répertoire board d'un job de génération (ancien système kuti-data)
 * @deprecated Les nouveaux panels sont stockés dans public/ via saveGenerationPanel().
 */
export function getGenerationBoardDir(
  projectSlug: string,
  jobId: string
): string {
  return `${getGenerationJobDir(projectSlug, jobId)}/board`;
}

// ============================================================================
// URL publiques (pour l'API)
// ============================================================================

/**
 * Génère une URL publique pour un panel de génération
 */
export function getGenerationPanelImageUrl(
  projectId: string,
  boardId: string,
  panelId: string
): string {
  return `/api/projects/${projectId}/generation/boards/${boardId}/panels/${panelId}/image`;
}

// ============================================================================
// Nouvelles fonctions projectId-based (public/)
// ============================================================================

/**
 * Retourne le répertoire des images de personnages pour un projet (projectId-based)
 */
export function getCharacterImagesDir(projectId: string): string {
  return `public/projects/${projectId}/generation/character_images`;
}

/**
 * Génère l'URL publique statique pour une image de personnage
 */
export function getCharacterImagePublicUrl(projectId: string, fileName: string): string {
  return `/projects/${projectId}/generation/character_images/${fileName}`;
}

/**
 * Retourne le répertoire des panels de génération pour un projet (projectId-based)
 */
export function getGenerationPanelsDir(projectId: string): string {
  return `public/projects/${projectId}/generation/panels`;
}

/**
 * Génère l'URL publique statique pour un panel de génération
 */
export function getGenerationPanelStaticUrl(projectId: string, fileName: string): string {
  return `/projects/${projectId}/generation/panels/${fileName}`;
}

/**
 * Retourne le répertoire des exports pour un projet (projectId-based)
 */
export function getExportsPublicDir(projectId: string): string {
  return `public/projects/${projectId}/exports`;
}

/**
 * Génère l'URL publique statique pour un export
 */
export function getExportPublicUrl(projectId: string, fileName: string): string {
  return `/projects/${projectId}/exports/${fileName}`;
}

// ============================================================================
// Helpers pour créer les répertoires
// ============================================================================

/**
 * Crée récursivement tous les répertoires nécessaires pour un chemin
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

/**
 * Initialise la structure de répertoires pour un nouveau projet
 */
export async function initProjectDirs(projectSlug: string): Promise<void> {
  const dirs = [
    getProjectAssetsDir(projectSlug),
    getProjectExportsDir(projectSlug),
    getProjectGenerationDir(projectSlug),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

// ============================================================================
// Utilitaires de chemins
// ============================================================================

/**
 * Extrait le nom de fichier d'un chemin complet
 */
export function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

/**
 * Extrait l'extension d'un nom de fichier
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : "";
}

/**
 * Génère un chemin de fichier sécurisé (sanitise le nom)
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
}

// Aliases pour compatibilité
export { getProjectAssetsDir as getAssetsDir };
