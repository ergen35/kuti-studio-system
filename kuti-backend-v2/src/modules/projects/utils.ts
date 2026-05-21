/**
 * Utilitaires pour le module Projects
 */

import { writeFile } from "node:fs/promises";
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

/**
 * Écrit le fichier project.json dans le répertoire du projet
 */
export async function writeProjectFile(project: Project): Promise<void> {
  const data = serializeProject(project);
  const path = `${project.rootPath}/project.json`;

  await writeFile(
    path,
    JSON.stringify(data, null, 2) + "\n",
    "utf-8"
  );
}
