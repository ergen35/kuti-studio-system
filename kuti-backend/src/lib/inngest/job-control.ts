import { inngest } from "./client";
import { prisma } from "@lib/db";

// Event type: kuti/job.cancel
export const cancelJobFunction = inngest.createFunction(
  {
    id: "cancel-generation-job",
    name: "Cancel Generation Job",
    retries: 2,
    triggers: [{ event: "kuti/job.cancel" }],
  },
  async ({ event, step }) => {
    const { jobId, projectId } = event.data;

    // Annuler le job parent et les jobs enfants associés
    const result = await step.run("mark-job-cancelled", async () => {
      // Récupérer le job et vérifier les enfants dans les métadonnées
      const job = await prisma.generationJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      const now = new Date();

      // Annuler le job
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          errorMessage: "Cancelled by user",
          failedAt: now,
          updatedAt: now,
        },
      });

      // Annuler les jobs enfants si présents dans metadataJson
      const metadata = job.metadataJson as Record<string, unknown> | null;
      const childrenIds = metadata?.["children"] as string[] | undefined;

      if (childrenIds && childrenIds.length > 0) {
        await prisma.generationJob.updateMany({
          where: { id: { in: childrenIds } },
          data: {
            status: "failed",
            errorMessage: "Parent job cancelled",
            failedAt: now,
            updatedAt: now,
          },
        });
      }

      return { cancelledChildrenCount: childrenIds?.length || 0 };
    });

    return {
      success: true,
      jobId,
      action: "cancelled",
      cancelledChildrenCount: result.cancelledChildrenCount,
    };
  }
);

// Event type: kuti/job.relaunch
export const relaunchJobFunction = inngest.createFunction(
  {
    id: "relaunch-generation-job",
    name: "Relaunch Generation Job",
    retries: 2,
    triggers: [{ event: "kuti/job.relaunch" }],
  },
  async ({ event, step }) => {
    const { newJobId, originalJobId, projectId, sourceKind, sourceId } = event.data;

    // Le job est déjà créé en pending, on marque juste son exécution
    // Le job sera traité par les workers existants selon les événements kuti/generate-image ou kuti/generate-scene-manga

    await step.run("mark-job-relaunched", async () => {
      const existingJob = await prisma.generationJob.findUnique({
        where: { id: newJobId },
      });

      await prisma.generationJob.update({
        where: { id: newJobId },
        data: {
          status: "pending",
          metadataJson: {
            ...(existingJob?.metadataJson as Record<string, unknown> ?? {}),
            relaunchedFrom: originalJobId,
            relaunchedAt: new Date().toISOString(),
          },
        },
      });
    });

    return {
      success: true,
      jobId: newJobId,
      originalJobId,
      action: "relaunched",
    };
  }
);

// Send helpers
export async function sendCancelJobEvent(data: { jobId: string; projectId: string }): Promise<void> {
  await inngest.send({
    name: "kuti/job.cancel",
    data,
  });
}

export async function sendRelaunchJobEvent(data: {
  newJobId: string;
  originalJobId: string;
  projectId: string;
  sourceKind: string;
  sourceId: string;
}): Promise<void> {
  await inngest.send({
    name: "kuti/job.relaunch",
    data,
  });
}
