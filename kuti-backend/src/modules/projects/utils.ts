/**
 * Utilitaires pour le module Projects
 */

import type { Project } from "@lib/db/generated/client";

/**
 * Sérialise un projet pour l'export JSON
 */
export function serializeProject(
  project: Project
): {
  id: string;
  name: string;
  slug: string;
  status: string;
  rootPath: string;
  settingsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
} {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    rootPath: project.rootPath,
    settingsJson: project.settingsJson as Record<string, unknown>,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    lastOpenedAt: project.lastOpenedAt?.toISOString() ?? null,
    archivedAt: project.archivedAt?.toISOString() ?? null,
  };
}


