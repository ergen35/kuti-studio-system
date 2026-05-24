import { randomUUIDv7 } from "bun";
import { writeFile, mkdir } from "node:fs/promises";
import { prisma } from "@lib/db";
import { throwIfNotExists } from "@lib/db/utils";
import { sendCancelJobEvent, sendRelaunchJobEvent } from "@lib/inngest";
import type {
  GenerationJobResponse,
  GenerationBoardResponse,
  CreateGenerationJobBody,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

function serializeJob(job: any): GenerationJobResponse {
  return {
    id: job.id,
    projectId: job.projectId,
    sourceKind: job.sourceKind,
    sourceId: job.sourceId,
    sourceLabel: job.sourceLabel,
    sourceVersionId: job.sourceVersionId,
    strategy: job.strategy,
    entrypoint: job.entrypoint,
    title: job.title,
    prompt: job.prompt,
    summary: job.summary,
    status: job.status,
    progress: job.progress,
    metadataJson: job.metadataJson as Record<string, unknown>,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    failedAt: job.failedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
  };
}

function serializePanel(panel: any) {
  return {
    id: panel.id,
    boardId: panel.boardId,
    stepId: panel.stepId,
    orderIndex: panel.orderIndex,
    title: panel.title,
    caption: panel.caption,
    prompt: panel.prompt,
    status: panel.status,
    imagePath: panel.imagePath,
    imageName: panel.imageName,
    metadataJson: panel.metadataJson as Record<string, unknown>,
    createdAt: panel.createdAt.toISOString(),
    updatedAt: panel.updatedAt.toISOString(),
  };
}

async function serializeBoard(board: any): Promise<GenerationBoardResponse> {
  const panels = await prisma.generationBoardPanel.findMany({
    where: { boardId: board.id },
    orderBy: { orderIndex: "asc" },
  });

  return {
    id: board.id,
    projectId: board.projectId,
    jobId: board.jobId,
    sourceKind: board.sourceKind,
    strategy: board.strategy,
    title: board.title,
    summary: board.summary,
    status: board.status,
    artifactPath: board.artifactPath,
    artifactName: board.artifactName,
    metadataJson: board.metadataJson as Record<string, unknown>,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
    validatedAt: board.validatedAt?.toISOString() ?? null,
    panels: panels.map(serializePanel),
  };
}

// ============================================================================
// Jobs
// ============================================================================

export async function listGenerationJobs(projectId: string): Promise<GenerationJobResponse[]> {
  const jobs = await prisma.generationJob.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return jobs.map(serializeJob);
}

export async function getGenerationJob(projectId: string, jobId: string): Promise<GenerationJobResponse | null> {
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, projectId } });
  return job ? serializeJob(job) : null;
}

export async function createGenerationJob(
  projectId: string,
  data: CreateGenerationJobBody
): Promise<GenerationJobResponse> {
  // Vérifier que le projet existe
  await throwIfNotExists.project(projectId);

  // Vérifier la source
  const sourceInfo = await resolveSource(projectId, data.sourceKind, data.sourceId);

  const now = new Date();
  const jobId = randomUUIDv7();

  const job = await prisma.generationJob.create({
    data: {
      id: jobId,
      projectId,
      sourceKind: data.sourceKind,
      sourceId: data.sourceId,
      sourceLabel: sourceInfo.label,
      sourceVersionId: data.sourceVersionId ?? null,
      strategy: data.strategy,
      entrypoint: "gpt-2-images",
      title: data.title || `${sourceInfo.label} · ${data.strategy} generation`,
      prompt: "", // Sera rempli par le worker
      summary: data.summary ?? "",
      status: "pending",
      progress: 0,
      metadataJson: {
        mode: data.mode,
        selectionIds: data.selectionIds,
        gridRows: data.gridRows,
        gridCols: data.gridCols,
        imageCount: data.imageCount,
        modelKey: data.modelKey,
      },
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeJob(job);
}

async function resolveSource(
  projectId: string,
  kind: string,
  id: string
): Promise<{ label: string; slug: string }> {
  switch (kind) {
    case "scene": {
      const scene = await prisma.scene.findFirst({ where: { id, projectId } });
      if (!scene) throw new Error("generation_source_not_found");
      return { label: scene.title, slug: scene.slug };
    }
    case "chapter": {
      const chapter = await prisma.chapter.findFirst({ where: { id, projectId } });
      if (!chapter) throw new Error("generation_source_not_found");
      return { label: chapter.title, slug: chapter.slug };
    }
    case "tome": {
      const tome = await prisma.tome.findFirst({ where: { id, projectId } });
      if (!tome) throw new Error("generation_source_not_found");
      return { label: tome.title, slug: tome.slug };
    }
    case "panel": {
      // Pour les panels, on cherche via le board
      const panel = await prisma.generationBoardPanel.findFirst({
        where: { id },
        include: { board: true },
      });
      if (!panel || panel.board.projectId !== projectId) {
        throw new Error("generation_source_not_found");
      }
      return { label: panel.title, slug: `panel-${panel.orderIndex}` };
    }
    case "custom":
      return { label: "Custom generation", slug: "custom" };
    default:
      throw new Error("generation_source_kind_invalid");
  }
}

// ============================================================================
// Boards
// ============================================================================

export async function listGenerationBoards(projectId: string): Promise<GenerationBoardResponse[]> {
  const boards = await prisma.generationBoard.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(boards.map(serializeBoard));
}

export async function getGenerationBoard(
  projectId: string,
  boardId: string
): Promise<GenerationBoardResponse | null> {
  const board = await prisma.generationBoard.findFirst({
    where: { id: boardId, projectId },
  });

  return board ? serializeBoard(board) : null;
}

export async function validateGenerationBoard(
  projectId: string,
  boardId: string,
  note?: string
): Promise<GenerationBoardResponse | null> {
  const board = await prisma.generationBoard.findFirst({
    where: { id: boardId, projectId },
  });

  if (!board) return null;

  const updated = await prisma.generationBoard.update({
    where: { id: boardId },
    data: {
      status: "validated",
      validatedAt: new Date(),
      updatedAt: new Date(),
      metadataJson: {
        ...(board.metadataJson as Record<string, unknown>),
        validationNote: note,
      },
    },
  });

  // Mettre à jour le job lié
  await prisma.generationJob.update({
    where: { id: board.jobId },
    data: {
      status: "validated",
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return serializeBoard(updated);
}

// ============================================================================
// Panels
// ============================================================================

export async function updateGenerationPanel(
  projectId: string,
  boardId: string,
  panelId: string,
  data: { status?: string; caption?: string; title?: string }
): Promise<any | null> {
  // Vérifier que le board existe
  const board = await prisma.generationBoard.findFirst({
    where: { id: boardId, projectId },
  });

  if (!board) throw new Error("generation_board_not_found");

  // Vérifier que le panel existe
  const panel = await prisma.generationBoardPanel.findFirst({
    where: { id: panelId, boardId },
  });

  if (!panel) throw new Error("generation_panel_not_found");

  const updated = await prisma.generationBoardPanel.update({
    where: { id: panelId },
    data: {
      status: data.status ?? panel.status,
      caption: data.caption ?? panel.caption,
      title: data.title ?? panel.title,
      updatedAt: new Date(),
    },
  });

  return serializePanel(updated);
}

export async function getGenerationPanelImage(
  projectId: string,
  boardId: string,
  panelId: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const board = await prisma.generationBoard.findFirst({
    where: { id: boardId, projectId },
  });

  if (!board) return null;

  const panel = await prisma.generationBoardPanel.findFirst({
    where: { id: panelId, boardId },
  });

  if (!panel) return null;

  const { readFile } = await import("@lib/filesystem");
  const buffer = await readFile(panel.imagePath);

  // Essayer de détecter le mime type depuis les metadata
  const metadata = panel.metadataJson as Record<string, unknown>;
  const mimeType = (metadata?.["mime_type"] as string) || "image/png";

  return { buffer, mimeType };
}

// ============================================================================
// Board Download
// ============================================================================

export async function getBoardArtifact(
  projectId: string,
  boardId: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const board = await prisma.generationBoard.findFirst({
    where: { id: boardId, projectId },
  });

  if (!board || !board.artifactPath) return null;

  const { readFile } = await import("@lib/filesystem");
  const buffer = await readFile(board.artifactPath);

  return {
    buffer,
    fileName: board.artifactName || "board.json",
  };
}

// ============================================================================
// Cancel Job
// ============================================================================

export async function cancelGenerationJob(
  projectId: string,
  jobId: string
): Promise<{ success: boolean; message: string }> {
  // Vérifier que le job existe et appartient au projet
  const job = await prisma.generationJob.findFirst({
    where: { id: jobId, projectId },
  });

  if (!job) {
    throw new Error("generation_job_not_found");
  }

  // Vérifier que le job est en status "running" ou "pending"
  if (job.status !== "running" && job.status !== "pending") {
    throw new Error("cannot_cancel_job_not_running");
  }

  // Envoyer un événement Inngest pour annuler le job
  await sendCancelJobEvent({ jobId, projectId });

  return { success: true, message: "Cancel request sent" };
}

// ============================================================================
// Relaunch Job
// ============================================================================

export async function relaunchGenerationJob(
  projectId: string,
  jobId: string
): Promise<GenerationJobResponse> {
  // Vérifier que le job existe et appartient au projet
  const originalJob = await prisma.generationJob.findFirst({
    where: { id: jobId, projectId },
  });

  if (!originalJob) {
    throw new Error("generation_job_not_found");
  }

  // Vérifier que le job est en status autorisé pour relaunch
  const allowedStatuses = ["ready", "validated", "failed", "pending"];
  if (!allowedStatuses.includes(originalJob.status)) {
    throw new Error("cannot_relaunch_job_invalid_status");
  }

  // Créer un nouveau job basé sur les données du job existant
  const now = new Date();
  const newJobId = randomUUIDv7();

  const newJob = await prisma.generationJob.create({
    data: {
      id: newJobId,
      projectId,
      sourceKind: originalJob.sourceKind,
      sourceId: originalJob.sourceId,
      sourceLabel: originalJob.sourceLabel,
      sourceVersionId: originalJob.sourceVersionId,
      strategy: originalJob.strategy,
      entrypoint: originalJob.entrypoint,
      title: `${originalJob.title} (relaunch)`,
      prompt: originalJob.prompt,
      summary: originalJob.summary,
      status: "pending",
      progress: 0,
      metadataJson: originalJob.metadataJson,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Envoyer un événement Inngest pour exécuter le nouveau job
  await sendRelaunchJobEvent({
    newJobId,
    originalJobId: jobId,
    projectId,
    sourceKind: originalJob.sourceKind,
    sourceId: originalJob.sourceId,
  });

  return serializeJob(newJob);
}
