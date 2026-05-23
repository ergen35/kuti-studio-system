/**
 * Fonction Inngest pour supprimer un projet et ses données associées
 */

import { rm } from "node:fs/promises";
import { inngest } from "./client";
import { prisma } from "@lib/db";

// ============================================================================
// Type des événements
// ============================================================================

interface DeleteProjectEvent {
  data: {
    projectId: string;
    jobId: string;
  };
}

// ============================================================================
// Send helper
// ============================================================================

export async function sendDeleteProjectEvent(
  data: DeleteProjectEvent["data"]
): Promise<void> {
  await inngest.send({
    name: "kuti/delete-project",
    data,
  });
}

// ============================================================================
// Function
// ============================================================================

export const deleteProjectFunction = inngest.createFunction(
  {
    id: "delete-project",
    name: "Delete Project",
    retries: 2,
    triggers: [{ event: "kuti/delete-project" }],
  },
  async ({ event, step }) => {
    const { projectId, jobId } = event.data;

    // Étape 1: Récupérer le projet
    const project = await step.run("fetch-project", async () => {
      const p = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!p) {
        throw new Error(`Project ${projectId} not found`);
      }
      return p;
    });

    // Étape 2: Supprimer les fichiers du projet
    await step.run("delete-files", async () => {
      try {
        await rm(project.rootPath, { recursive: true, force: true });
      } catch (error) {
        // Si le dossier n'existe pas, c'est OK (déjà supprimé ou jamais créé)
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    });

    // Étape 3: Supprimer le projet en base (cascade automatique des relations)
    await step.run("delete-database", async () => {
      await prisma.project.delete({
        where: { id: projectId },
      });
    });

    return {
      jobId,
      projectId,
      projectName: project.name,
      status: "completed",
    };
  }
);
