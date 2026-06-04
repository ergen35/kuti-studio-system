/**
 * Configuration des tâches cron avec @elysiajs/cron
 * Remplace le thread background orphan_checker du backend v1
 */

import { cron } from "@elysiajs/cron";
import { type Dirent } from "node:fs";
import { rm, readdir, stat } from "node:fs/promises";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FAILED_JOB_RETENTION_DAYS = 14;

type CleanupDbClient = {
  generationJob: {
    findMany: (args: Record<string, unknown>) => Promise<
      Array<{
        id: string;
        project: { slug: string };
      }>
    >;
  };
};

type CleanupDeps = {
  dataDir?: string;
  now?: Date;
  retentionDays?: number;
  dbClient?: CleanupDbClient;
  removeDirectory?: typeof rm;
  readDirectory?: typeof readdir;
  readStats?: typeof stat;
};

type CleanupReport = {
  inspectedFailedJobs: number;
  removedFailedJobDirectories: number;
  removedExportScratchDirectories: number;
  cutoff: string;
};

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function removeIfPresent(
  removeDirectory: typeof rm,
  path: string,
): Promise<void> {
  try {
    await removeDirectory(path, { recursive: true, force: true });
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }
}

async function cleanupFailedGenerationJobDirectories(
  dataDir: string,
  cutoff: Date,
  deps: Pick<CleanupDeps, "dbClient" | "removeDirectory">,
): Promise<{ inspected: number; removed: number }> {
  const dbClient = deps.dbClient ?? ((await import("@lib/db")).db as unknown as CleanupDbClient);
  const removeDirectory = deps.removeDirectory ?? rm;

  const failedJobs = await dbClient.generationJob.findMany({
    where: {
      status: "failed",
      OR: [
        { failedAt: { lt: cutoff } },
        {
          AND: [{ failedAt: null }, { updatedAt: { lt: cutoff } }],
        },
      ],
    },
    select: {
      id: true,
      project: { select: { slug: true } },
    },
  });

  let removed = 0;
  for (const job of failedJobs) {
    const jobDir = `${dataDir}/projects/${job.project.slug}/generation/${job.id}`;
    await removeIfPresent(removeDirectory, jobDir);
    removed += 1;
  }

  return { inspected: failedJobs.length, removed };
}

async function cleanupExportScratchDirectories(
  dataDir: string,
  cutoff: Date,
  deps: Pick<CleanupDeps, "removeDirectory" | "readDirectory" | "readStats">,
): Promise<number> {
  const removeDirectory = deps.removeDirectory ?? rm;
  const readDirectory = deps.readDirectory ?? readdir;
  const readStats = deps.readStats ?? stat;
  const projectsRoot = `${dataDir}/projects`;

  let projectEntries: Dirent[];
  try {
    projectEntries = await readDirectory(projectsRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error)) {
      return 0;
    }

    throw error;
  }

  let removed = 0;

  for (const entry of projectEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const exportsDir = `${projectsRoot}/${entry.name}/exports`;

    let exportEntries: Dirent[];
    try {
      exportEntries = await readDirectory(exportsDir, { withFileTypes: true });
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw error;
    }

    for (const exportEntry of exportEntries) {
      if (!exportEntry.isDirectory() || !exportEntry.name.startsWith("tree_")) {
        continue;
      }

      const scratchPath = `${exportsDir}/${exportEntry.name}`;
      const timestamp = Number(exportEntry.name.slice("tree_".length));

      let shouldRemove = Number.isFinite(timestamp)
        ? timestamp < cutoff.getTime()
        : false;

      if (!shouldRemove) {
        try {
          const stats = await readStats(scratchPath);
          shouldRemove = stats.mtime < cutoff;
        } catch (error) {
          if (isMissingPathError(error)) {
            continue;
          }

          throw error;
        }
      }

      if (!shouldRemove) {
        continue;
      }

      await removeIfPresent(removeDirectory, scratchPath);
      removed += 1;
    }
  }

  return removed;
}

export async function cleanupOldArtifacts(
  deps: CleanupDeps = {},
): Promise<CleanupReport> {
  const dataDir = deps.dataDir ?? (await import("./paths")).getDataDir();
  const now = deps.now ?? new Date();
  const retentionDays = deps.retentionDays ?? FAILED_JOB_RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * DAY_IN_MS);

  const failedJobsResult = await cleanupFailedGenerationJobDirectories(
    dataDir,
    cutoff,
    deps,
  );
  const removedExportScratchDirectories = await cleanupExportScratchDirectories(
    dataDir,
    cutoff,
    deps,
  );

  return {
    inspectedFailedJobs: failedJobsResult.inspected,
    removedFailedJobDirectories: failedJobsResult.removed,
    removedExportScratchDirectories,
    cutoff: cutoff.toISOString(),
  };
}

// ============================================================================
// Cron: Orphan Checker
// Vérifie les images de personnages où le fichier est manquant mais la DB entry existe
// ============================================================================

export const orphanCheckerCron = cron({
  name: "orphan-checker",
  pattern: "0 * * * *", // Toutes les heures
  protect: true, // Ne pas exécuter si le précédent n'est pas terminé
  async run() {
    console.log("[OrphanChecker] Starting scheduled check...");

    try {
      const { sendCheckOrphanImagesEvent } = await import("./inngest");

      // Déclencher le check via Inngest pour bénéficier de la retry logic
      await sendCheckOrphanImagesEvent({});

      console.log("[OrphanChecker] Check event sent to Inngest");
    } catch (error) {
      console.error("[OrphanChecker] Failed to send check event:", error);
    }
  },
});

// ============================================================================
// Cron: Cleanup (optionnel - pour nettoyer les vieux fichiers temporaires)
// ============================================================================

export const cleanupCron = cron({
  name: "cleanup-temp-files",
  pattern: "0 3 * * *", // Tous les jours à 3h du matin
  protect: true,
  async run() {
    console.log("[Cleanup] Starting daily cleanup...");

    try {
      const report = await cleanupOldArtifacts();
      console.log("[Cleanup] Cleanup completed", report);
    } catch (error) {
      console.error("[Cleanup] Cleanup failed:", error);
      throw error;
    }
  },
});

// ============================================================================
// Export de tous les crons pour l'enregistrement dans l'app
// ============================================================================

export const allCrons = [orphanCheckerCron, cleanupCron];
