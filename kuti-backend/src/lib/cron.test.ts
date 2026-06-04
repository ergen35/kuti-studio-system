import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const mockDb = {
  generationJob: {
    findMany: mock(
      async (_args?: any) => [] as Array<{ id: string; project: { slug: string } }>,
    ),
  },
};

const { cleanupOldArtifacts } = await import("./cron");

describe("cleanupOldArtifacts", () => {
  const removedPaths: string[] = [];
  let tempRootPath: string | null = null;

  beforeEach(() => {
    removedPaths.length = 0;
    mockDb.generationJob.findMany.mockReset();
  });

  afterEach(async () => {
    // Reset any temporary directories created during the test.
    for (const path of removedPaths) {
      await rm(path, { recursive: true, force: true });
    }
    if (tempRootPath) {
      await rm(tempRootPath, { recursive: true, force: true });
      tempRootPath = null;
    }
    removedPaths.length = 0;
  });

  test("removes stale failed job directories and temporary tree export scratch dirs", async () => {
    tempRootPath = await mkdtemp(join(tmpdir(), "kuti-cleanup-"));
    const dataDir = join(tempRootPath, "kuti-data");
    const now = new Date();
    const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const projectSlug = "lemillion";
    const failedJobId = "job-old";
    const recentJobId = "job-recent";

    const failedJobDir = join(
      dataDir,
      "projects",
      projectSlug,
      "generation",
      failedJobId,
    );
    const recentJobDir = join(
      dataDir,
      "projects",
      projectSlug,
      "generation",
      recentJobId,
    );
    const oldTreeDir = join(
      dataDir,
      "projects",
      projectSlug,
      "exports",
      `tree_${cutoff.getTime() - 1000}`,
    );
    const recentTreeDir = join(
      dataDir,
      "projects",
      projectSlug,
      "exports",
      `tree_${cutoff.getTime() + 1000}`,
    );
    const keepExportFile = join(
      dataDir,
      "projects",
      projectSlug,
      "exports",
      "keep.zip",
    );

    await mkdir(failedJobDir, { recursive: true });
    await mkdir(recentJobDir, { recursive: true });
    await mkdir(oldTreeDir, { recursive: true });
    await mkdir(recentTreeDir, { recursive: true });
    await writeFile(join(oldTreeDir, "manifest.json"), "{}");
    await writeFile(join(recentTreeDir, "manifest.json"), "{}");
    await writeFile(keepExportFile, "keep");

    const findManyArgs: Array<Record<string, unknown>> = [];
    mockDb.generationJob.findMany.mockImplementation(async (args: any) => {
      findManyArgs.push(args);
      return [
        {
          id: failedJobId,
          project: { slug: projectSlug },
        },
      ];
    });

    const report = await cleanupOldArtifacts({
      dataDir,
      now,
      retentionDays: 14,
      dbClient: mockDb as any,
      removeDirectory: async (path, options) => {
        removedPaths.push(typeof path === "string" ? path : path.toString());
        await rm(path, options);
      },
    });

    expect(findManyArgs).toHaveLength(1);
    expect(findManyArgs[0].where).toMatchObject({ status: "failed" });

    const cutoffArg = (findManyArgs[0].where as any).OR[0].failedAt.lt as Date;
    expect(cutoffArg).toBeInstanceOf(Date);
    expect(cutoffArg.getTime()).toBe(cutoff.getTime());

    expect(report).toEqual({
      inspectedFailedJobs: 1,
      removedFailedJobDirectories: 1,
      removedExportScratchDirectories: 1,
      cutoff: cutoff.toISOString(),
    });

    expect(removedPaths).toContain(failedJobDir);
    expect(removedPaths).toContain(oldTreeDir);
    expect(removedPaths).not.toContain(recentJobDir);
    expect(removedPaths).not.toContain(recentTreeDir);

    expect(existsSync(recentJobDir)).toBe(true);
    expect(existsSync(recentTreeDir)).toBe(true);
    expect(existsSync(keepExportFile)).toBe(true);
  });
});
