/**
 * Controller pour le module Projects
 * Migration depuis repository.py du backend v1
 */

import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { mkdir, cp, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { getProjectDir } from "@lib/config";
import { runCoherenceScanIfEnabled } from "@lib/coherence-scan";
import { prisma } from "@lib/db";
import type { Prisma } from "@lib/db/generated/client";
import { serializeProject } from "./utils";
import type {
  CreateProjectBody,
  ImportProjectBody,
  UpdateProjectBody,
  CloneProjectBody,
  DeleteProjectBody,
  ProjectResponse,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Génère un slug unique pour un projet
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true }) || "project";

  let candidate = baseSlug;
  let index = 2;

  while (await prisma.project.findUnique({ where: { slug: candidate } })) {
    candidate = `${baseSlug}-${index}`;
    index++;
  }

  return candidate;
}

async function ensureProjectStorage(rootPath: string): Promise<void> {
  await mkdir(rootPath, { recursive: true });
  await mkdir(`${rootPath}/assets`, { recursive: true });
  await mkdir(`${rootPath}/generation`, { recursive: true });
  await mkdir(`${rootPath}/exports`, { recursive: true });
}

function normalizeRootPath(rootPath: string): string {
  return rootPath.trim().replace(/[\\/]+$/, "");
}

function deriveProjectName(rootPath: string): string {
  const baseName = basename(normalizeRootPath(rootPath));
  if (!baseName) {
    return "Imported project";
  }

  return baseName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function findProjectByRootPath(rootPath: string) {
  const resolvedRootPath = resolve(rootPath);
  const projects = await prisma.project.findMany({
    select: { id: true, rootPath: true },
  });

  return projects.find((project) => resolve(project.rootPath) === resolvedRootPath) ?? null;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Liste tous les projets, triés par lastOpenedAt puis updatedAt
 */
export async function listProjects(): Promise<ProjectResponse[]> {
  const projects = await prisma.project.findMany({
    orderBy: [
      { lastOpenedAt: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return projects.map(serializeProject);
}

/**
 * Récupère un projet par son ID
 */
export async function getProject(
  projectId: string
): Promise<ProjectResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  return project ? serializeProject(project) : null;
}

/**
 * Crée un nouveau projet
 */
export async function createProject(
  data: CreateProjectBody
): Promise<ProjectResponse> {
  const slug = await generateUniqueSlug(data.name);
  const rootPath = getProjectDir(slug);

  await ensureProjectStorage(rootPath);

  const now = new Date();

  const project = await prisma.project.create({
    data: {
      id: randomUUIDv7(),
      name: data.name,
      slug,
      status: data.status,
      rootPath,
      settingsJson: (data.settingsJson || {}) as Prisma.InputJsonValue,
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeProject(project);
}

/**
 * Ouvre un projet existant depuis un chemin local, ou l'enregistre si absent
 */
export async function importProject(
  data: ImportProjectBody
): Promise<ProjectResponse> {
  const rootPath = normalizeRootPath(data.rootPath);

  const rootStats = await stat(rootPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  });

  if (!rootStats) {
    throw new Error("Project root path not found");
  }

  if (!rootStats.isDirectory()) {
    throw new Error("Project root path must be a directory");
  }

  const existingProject = await findProjectByRootPath(rootPath);
  if (existingProject) {
    const opened = await openProject(existingProject.id);
    if (!opened) {
      throw new Error("Project not found");
    }
    return opened;
  }

  const name = data.name?.trim() || deriveProjectName(rootPath);
  const slug = await generateUniqueSlug(name);

  await ensureProjectStorage(rootPath);

  const now = new Date();
  const project = await prisma.project.create({
    data: {
      id: randomUUIDv7(),
      name,
      slug,
      status: data.status,
      rootPath,
      settingsJson: (data.settingsJson || {}) as Prisma.InputJsonValue,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    },
  });

  return serializeProject(project);
}

/**
 * Met à jour un projet
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectBody
): Promise<ProjectResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      name: data.name,
      status: data.status,
      settingsJson: data.settingsJson as Prisma.InputJsonValue | undefined,
      updatedAt: new Date(),
    },
  });

  await runCoherenceScanIfEnabled(projectId);

  return serializeProject(updated);
}

/**
 * Archive un projet
 */
export async function archiveProject(
  projectId: string
): Promise<ProjectResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "archived",
      archivedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return serializeProject(updated);
}

/**
 * Marque un projet comme ouvert (met à jour lastOpenedAt)
 */
export async function openProject(
  projectId: string
): Promise<ProjectResponse | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      lastOpenedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return serializeProject(updated);
}

/**
 * Clone un projet
 */
export async function cloneProject(
  projectId: string,
  data: CloneProjectBody
): Promise<ProjectResponse | null> {
  const sourceProject = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!sourceProject) {
    return null;
  }

  const cloneName = data.name || `${sourceProject.name} Copy`;
  const cloneSlug = await generateUniqueSlug(cloneName);
  const cloneRoot = getProjectDir(cloneSlug);

  try {
    await cp(sourceProject.rootPath, cloneRoot, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  } catch {
    await ensureProjectStorage(cloneRoot);
  }

  const now = new Date();

  const clone = await prisma.project.create({
    data: {
      id: randomUUIDv7(),
      name: cloneName,
      slug: cloneSlug,
      status: "draft",
      rootPath: cloneRoot,
      settingsJson: sourceProject.settingsJson as Prisma.InputJsonValue,
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeProject(clone);
}

/**
 * Exporte un projet (retourne les données JSON)
 */
export async function exportProject(
  projectId: string
): Promise<Record<string, unknown> | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  // Retourner une version simplifiée du projet
  return serializeProject(project);
}

import { sendDeleteProjectEvent } from "@lib/inngest";

/**
 * Supprime un projet (déclenche un job Inngest)
 */
export async function deleteProject(
  projectId: string,
  data: DeleteProjectBody
): Promise<{ jobId: string; status: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  // Vérifier que le nom confirmé correspond
  if (data.confirmedName !== project.name) {
    throw new Error("Le nom confirmé ne correspond pas au nom du projet");
  }

  const jobId = randomUUIDv7();

  // Déclencher le job Inngest pour la suppression
  await sendDeleteProjectEvent({
    projectId,
    jobId,
  });

  return { jobId, status: "pending" };
}
