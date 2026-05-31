/**
 * Configuration Inngest pour les jobs asynchrones
 * Remplace les background threads du backend v1
 */

// Export du client (défini dans client.ts pour éviter les circulaires)
export { inngest } from "./client";

// Re-exports des fonctions Inngest
export { deleteProjectFunction, sendDeleteProjectEvent } from "./delete-project";
export { exportProjectFunction } from "./export-project";
export { generateImageFunction } from "./generate-image";
export { generateSceneMangaFunction } from "./generate-scene-manga";
export { generateDramaVideoFunction, sendGenerateDramaVideoEvent } from "./generate-drama-video";
export {
  cancelJobFunction,
  relaunchJobFunction,
  sendCancelJobEvent,
  sendRelaunchJobEvent,
} from "./job-control";

import { inngest } from "./client";

// ============================================================================
// Types d'événements
// ============================================================================

type GenerateImageEvent = {
  data: {
    projectId: string;
    characterId: string;
    jobId: string;
    strategy: string;
    style?: string;
    imageCount: number;
    modelKey?: string;
  };
};

type GenerateSceneMangaEvent = {
  data: {
    projectId: string;
    sceneId: string;
    jobId: string;
    configId?: string;
    modelKey?: string;
    imageCount: number;
    characterImageRefs?: Record<string, string>;
    additionalContext?: string;
  };
};

type GenerateDramaVideoEvent = {
  data: {
    projectId: string;
    sceneId: string;
    pageId: string;
    dramaVideoId: string;
    jobId: string;
    modelKey?: string;
    prompt?: string;
  };
};

type ExportProjectEvent = {
  data: {
    projectId: string;
    exportId: string;
    kind: "work" | "publication";
    format: "json" | "tree" | "zip";
  };
};

type DeleteProjectEvent = {
  data: {
    projectId: string;
    jobId: string;
  };
};

type CheckOrphanImagesEvent = {
  data: {
    projectId?: string;
  };
};

type CancelJobEvent = {
  data: {
    jobId: string;
    projectId: string;
  };
};

type RelaunchJobEvent = {
  data: {
    newJobId: string;
    originalJobId: string;
    projectId: string;
    sourceKind: string;
    sourceId: string;
  };
};

// ============================================================================
// Send helpers
// ============================================================================

/**
 * Déclenche un événement de génération d'image pour un personnage
 */
export async function sendGenerateImageEvent(
  data: GenerateImageEvent["data"]
): Promise<void> {
  await inngest.send({
    name: "kuti/generate-image",
    data,
  });
}

/**
 * Déclenche un événement de génération de manga pour une scène
 */
export async function sendGenerateSceneMangaEvent(
  data: GenerateSceneMangaEvent["data"]
): Promise<void> {
  await inngest.send({
    name: "kuti/generate-scene-manga",
    data,
  });
}

/**
 * Déclenche un événement d'export de projet
 */
export async function sendExportProjectEvent(
  data: ExportProjectEvent["data"]
): Promise<void> {
  await inngest.send({
    name: "kuti/export-project",
    data,
  });
}

/**
 * Déclenche un événement de vérification des images orphelines
 */
export async function sendCheckOrphanImagesEvent(
  data: CheckOrphanImagesEvent["data"] = {}
): Promise<void> {
  await inngest.send({
    name: "kuti/check-orphan-images",
    data,
  });
}

// ============================================================================
// Liste de toutes les fonctions pour le serveur Inngest
// ============================================================================

import { deleteProjectFunction } from "./delete-project";
import { exportProjectFunction } from "./export-project";
import { generateImageFunction } from "./generate-image";
import { generateSceneMangaFunction } from "./generate-scene-manga";
import { generateDramaVideoFunction } from "./generate-drama-video";
import { cancelJobFunction, relaunchJobFunction } from "./job-control";

export const inngestFunctions = [
  deleteProjectFunction,
  exportProjectFunction,
  generateImageFunction,
  generateSceneMangaFunction,
  generateDramaVideoFunction,
  cancelJobFunction,
  relaunchJobFunction,
];

// Déclaration des événements pour type-safety
declare module "inngest" {
  interface Events {
    "kuti/generate-image": GenerateImageEvent;
    "kuti/generate-scene-manga": GenerateSceneMangaEvent;
    "kuti/drama-video.generate": GenerateDramaVideoEvent;
    "kuti/export-project": ExportProjectEvent;
    "kuti/delete-project": DeleteProjectEvent;
    "kuti/check-orphan-images": CheckOrphanImagesEvent;
    "kuti/job.cancel": CancelJobEvent;
    "kuti/job.relaunch": RelaunchJobEvent;
  }
}
