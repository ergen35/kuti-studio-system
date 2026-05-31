/**
 * Controller pour le module Versions
 * Migration depuis repository.py du backend v1
 */

import { randomUUIDv7 } from "bun";
import { prisma } from "@lib/db";
import type {
  CreateVersionBody,
  RestoreVersionBody,
  VersionResponse,
  VersionBranch,
  VersionCompareResponse,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

function serializeVersion(version: {
  id: string;
  projectId: string;
  branchName: string;
  versionIndex: number;
  label: string;
  summary: string;
  createdAt: Date;
}): VersionResponse {
  return {
    id: version.id,
    projectId: version.projectId,
    branchName: version.branchName,
    versionIndex: version.versionIndex,
    label: version.label,
    summary: version.summary,
    createdAt: version.createdAt.toISOString(),
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

  return versions.map(serializeVersion);
}

export async function listBranches(projectId: string): Promise<VersionBranch[]> {
  const versions = await prisma.version.findMany({
    where: { projectId },
    orderBy: [
      { branchName: "asc" },
      { versionIndex: "desc" },
    ],
  });

  // Grouper par branche
  const grouped = new Map<string, typeof versions>();
  for (const version of versions) {
    const list = grouped.get(version.branchName) || [];
    list.push(version);
    grouped.set(version.branchName, list);
  }

  const branches: VersionBranch[] = [];
  for (const [branchName, branchVersions] of grouped) {
    const latest = branchVersions[0];
    branches.push({
      branchName,
      versionCount: branchVersions.length,
      latestVersionId: latest?.id || null,
      latestCreatedAt: latest?.createdAt.toISOString() || null,
    });
  }

  return branches.sort((a, b) => a.branchName.localeCompare(b.branchName));
}

export async function createVersion(
  projectId: string,
  data: CreateVersionBody
): Promise<VersionResponse | null> {
  // Vérifier que le projet existe
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const branchName = data.branchName?.trim() || "main";

  // Récupérer le dernier index pour cette branche
  const latestVersion = await prisma.version.findFirst({
    where: { projectId, branchName },
    orderBy: { versionIndex: "desc" },
  });

  const versionIndex = (latestVersion?.versionIndex || 0) + 1;

  // Créer la version. Le modèle Prisma actuel ne persiste pas encore de snapshot.
  const version = await prisma.version.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      branchName,
      versionIndex,
      label: data.label,
      summary: data.summary,
    },
  });

  // Garder seulement les 3 dernières versions par branche
  const branchVersions = await prisma.version.findMany({
    where: { projectId, branchName },
    orderBy: { versionIndex: "asc" },
  });

  if (branchVersions.length > 3) {
    const toDelete = branchVersions.slice(0, branchVersions.length - 3);
    await prisma.version.deleteMany({
      where: {
        id: { in: toDelete.map((v) => v.id) },
      },
    });
  }

  return serializeVersion(version);
}

export async function getVersion(
  projectId: string,
  versionId: string
): Promise<VersionResponse | null> {
  const version = await prisma.version.findFirst({
    where: { id: versionId, projectId },
  });

  return version ? serializeVersion(version) : null;
}

export async function compareVersions(
  projectId: string,
  leftVersionId: string,
  rightVersionId: string
): Promise<VersionCompareResponse | null> {
  const [left, right] = await Promise.all([
    prisma.version.findFirst({ where: { id: leftVersionId, projectId } }),
    prisma.version.findFirst({ where: { id: rightVersionId, projectId } }),
  ]);

  if (!left || !right) {
    return null;
  }

  const projectChanges: string[] = [];
  const countsDelta: Record<string, number> = {};

  return {
    left: serializeVersion(left),
    right: serializeVersion(right),
    projectChanges,
    countsDelta,
  };
}

export async function restoreVersion(
  projectId: string,
  versionId: string,
  data: RestoreVersionBody
): Promise<VersionResponse | null> {
  const version = await prisma.version.findFirst({
    where: { id: versionId, projectId },
  });

  if (!version) {
    return null;
  }

  // Créer une nouvelle version de restauration
  return createVersion(projectId, {
    branchName: version.branchName,
    label: data.label || `Restore ${version.branchName} #${version.versionIndex}`,
    summary: data.summary || version.summary,
  });
}
