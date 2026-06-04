/**
 * Controller pour le module Versions
 * Migration depuis repository.py du backend v1
 */

import { randomUUIDv7 } from "bun";
import type { Prisma } from "@lib/db/generated/client";
import { prisma } from "@lib/db";
import { readProjectVersioningSettings } from "@lib/project-settings";
import {
  captureVersionSnapshot,
  compareVersionSnapshots,
  parseVersionSnapshot,
  restoreProjectSnapshot,
  summarizeVersionSnapshot,
  type VersionSnapshot,
} from "@lib/version-snapshot";
import type {
  CreateVersionBody,
  RestoreVersionBody,
  RestoreVersionResponse,
  VersionBranch,
  VersionCompareResponse,
  VersionResponse,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

type VersionRecord = {
  id: string;
  projectId: string;
  branchName: string;
  versionIndex: number;
  label: string;
  summary: string;
  snapshotJson: unknown;
  createdAt: Date;
};

function serializeVersion(version: VersionRecord): VersionResponse {
  const snapshot = summarizeVersionSnapshot(parseVersionSnapshot(version.snapshotJson));

  return {
    id: version.id,
    projectId: version.projectId,
    branchName: version.branchName,
    versionIndex: version.versionIndex,
    label: version.label,
    summary: version.summary,
    snapshot,
    createdAt: version.createdAt.toISOString(),
  };
}

async function getRetainedVersionsPerBranch(projectId: string): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { settingsJson: true },
  });

  return readProjectVersioningSettings(project?.settingsJson).retainedVersionsPerBranch;
}

async function pruneBranchVersions(projectId: string, branchName: string) {
  const versions = await prisma.version.findMany({
    where: { projectId, branchName },
    orderBy: { versionIndex: "asc" },
  });

  const retainedVersionsPerBranch = await getRetainedVersionsPerBranch(projectId);

  if (versions.length <= retainedVersionsPerBranch) {
    return;
  }

  const toDelete = versions.slice(0, versions.length - retainedVersionsPerBranch);

  await prisma.version.deleteMany({
    where: {
      id: { in: toDelete.map((version) => version.id) },
    },
  });
}

async function storeVersionFromSnapshot(
  projectId: string,
  data: CreateVersionBody,
  snapshot: VersionSnapshot,
): Promise<VersionResponse> {
  const branchName = data.branchName?.trim() || "main";

  const latestVersion = await prisma.version.findFirst({
    where: { projectId, branchName },
    orderBy: { versionIndex: "desc" },
  });

  const versionIndex = (latestVersion?.versionIndex || 0) + 1;

  const version = await prisma.version.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      branchName,
      versionIndex,
      label: data.label,
      summary: data.summary,
      snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
    },
  });

  await pruneBranchVersions(projectId, branchName);

  return serializeVersion(version as VersionRecord);
}

function buildRestoreBackupLabel(versionLabel: string): string {
  return `Backup before restoring ${versionLabel}`;
}

function buildRestoreBackupSummary(branchName: string, versionIndex: number): string {
  return `Automatic backup created before restoring ${branchName} #${versionIndex}`;
}

function buildRestoreResult(version: VersionRecord, backupVersion: VersionResponse): RestoreVersionResponse {
  return {
    restoredVersion: serializeVersion(version),
    backupVersion,
  };
}

// ============================================================================
// CRUD Versions
// ============================================================================

export async function listVersions(projectId: string): Promise<VersionResponse[]> {
  const versions = await prisma.version.findMany({
    where: { projectId },
    orderBy: [
      { branchName: "asc" },
      { versionIndex: "desc" },
    ],
  });

  return versions.map((version) => serializeVersion(version as VersionRecord));
}

export async function listBranches(projectId: string): Promise<VersionBranch[]> {
  const versions = await prisma.version.findMany({
    where: { projectId },
    orderBy: [
      { branchName: "asc" },
      { versionIndex: "desc" },
    ],
  });

  const grouped = new Map<string, typeof versions>();

  for (const version of versions) {
    const list = grouped.get(version.branchName) || [];
    list.push(version);
    grouped.set(version.branchName, list);
  }

  const branches: VersionBranch[] = [];

  for (const [branchName, branchVersions] of grouped) {
    const latest = branchVersions[0] as (typeof branchVersions)[number] | undefined;
    const latestSnapshot = latest ? summarizeVersionSnapshot(parseVersionSnapshot(latest.snapshotJson)) : null;

    branches.push({
      branchName,
      versionCount: branchVersions.length,
      latestVersionId: latest?.id || null,
      latestVersionLabel: latest?.label || null,
      latestCreatedAt: latest?.createdAt.toISOString() || null,
      latestSnapshotCapturedAt: latestSnapshot?.capturedAt || null,
      latestSnapshotAvailable: Boolean(latestSnapshot),
    });
  }

  return branches.sort((a, b) => a.branchName.localeCompare(b.branchName));
}

export async function createVersion(
  projectId: string,
  data: CreateVersionBody,
): Promise<VersionResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return null;
  }

  const snapshot = await captureVersionSnapshot(projectId);

  if (!snapshot) {
    return null;
  }

  return storeVersionFromSnapshot(projectId, data, snapshot);
}

export async function getVersion(
  projectId: string,
  versionId: string,
): Promise<VersionResponse | null> {
  const version = await prisma.version.findFirst({
    where: { id: versionId, projectId },
  });

  return version ? serializeVersion(version as VersionRecord) : null;
}

export async function compareVersions(
  projectId: string,
  leftVersionId: string,
  rightVersionId: string,
): Promise<VersionCompareResponse | null> {
  const [left, right] = await Promise.all([
    prisma.version.findFirst({ where: { id: leftVersionId, projectId } }),
    prisma.version.findFirst({ where: { id: rightVersionId, projectId } }),
  ]);

  if (!left || !right) {
    return null;
  }

  const leftSnapshot = parseVersionSnapshot(left.snapshotJson);
  const rightSnapshot = parseVersionSnapshot(right.snapshotJson);

  let projectChanges: string[] = [];
  let countsDelta: Record<string, number> = {};

  if (leftSnapshot && rightSnapshot) {
    ({ projectChanges, countsDelta } = compareVersionSnapshots(leftSnapshot, rightSnapshot));
  }

  if (!leftSnapshot) {
    projectChanges.push(`Snapshot unavailable for ${left.label}`);
  }

  if (!rightSnapshot) {
    projectChanges.push(`Snapshot unavailable for ${right.label}`);
  }

  return {
    left: serializeVersion(left as VersionRecord),
    right: serializeVersion(right as VersionRecord),
    projectChanges,
    countsDelta,
  };
}

export async function restoreVersion(
  projectId: string,
  versionId: string,
  data: RestoreVersionBody,
): Promise<RestoreVersionResponse | null> {
  const version = await prisma.version.findFirst({
    where: { id: versionId, projectId },
  });

  if (!version) {
    return null;
  }

  const snapshot = parseVersionSnapshot(version.snapshotJson);

  if (!snapshot) {
    return null;
  }

  const currentSnapshot = await captureVersionSnapshot(projectId);

  if (!currentSnapshot) {
    return null;
  }

  const backupVersion = await storeVersionFromSnapshot(
    projectId,
    {
      branchName: version.branchName,
      label: data.label?.trim() || buildRestoreBackupLabel(version.label),
      summary: data.summary?.trim() || buildRestoreBackupSummary(version.branchName, version.versionIndex),
    },
    currentSnapshot,
  );

  await restoreProjectSnapshot(projectId, snapshot);

  return buildRestoreResult(version as VersionRecord, backupVersion);
}
