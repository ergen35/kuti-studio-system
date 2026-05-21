/**
 * Controller pour le module Exports
 * Migration depuis repository.py du backend v1
 */

import { randomUUIDv7 } from "bun";
import { prisma } from "@lib/db";
import { sendExportProjectEvent } from "@lib/inngest";
import type {
  CreateExportBody,
  ExportResponse,
  ListExportsQuery,
  ExportKind,
  ExportFormat,
  ExportStatus,
} from "./dto";

// ============================================================================
// Helpers
// ============================================================================

function serializeExport(exportRecord: {
  id: string;
  projectId: string;
  kind: ExportKind;
  format: ExportFormat;
  status: ExportStatus;
  label: string;
  summary: string;
  artifactPath: string | null;
  artifactName: string | null;
  metadataJson: unknown;
  sizeBytes: number | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
}): ExportResponse {
  return {
    id: exportRecord.id,
    projectId: exportRecord.projectId,
    kind: exportRecord.kind,
    format: exportRecord.format,
    status: exportRecord.status,
    label: exportRecord.label,
    summary: exportRecord.summary,
    artifactPath: exportRecord.artifactPath,
    artifactName: exportRecord.artifactName,
    metadataJson: exportRecord.metadataJson as Record<string, unknown>,
    sizeBytes: exportRecord.sizeBytes,
    createdAt: exportRecord.createdAt.toISOString(),
    updatedAt: exportRecord.updatedAt.toISOString(),
    completedAt: exportRecord.completedAt?.toISOString() || null,
    failedAt: exportRecord.failedAt?.toISOString() || null,
    errorMessage: exportRecord.errorMessage,
  };
}

// ============================================================================
// CRUD Exports
// ============================================================================

export async function listExports(
  projectId: string,
  filters?: ListExportsQuery
): Promise<ExportResponse[]> {
  const where: Record<string, unknown> = { projectId };

  if (filters?.kind) {
    where.kind = filters.kind;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  const exports = await prisma.exportRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  let result = exports.map(serializeExport);

  // Filtrer par format côté application si spécifié
  if (filters?.format) {
    result = result.filter((e) => e.format === filters.format);
  }

  return result;
}

export async function getExport(
  projectId: string,
  exportId: string
): Promise<ExportResponse | null> {
  const exportRecord = await prisma.exportRecord.findFirst({
    where: { id: exportId, projectId },
  });

  return exportRecord ? serializeExport(exportRecord) : null;
}

export async function createExport(
  projectId: string,
  data: CreateExportBody
): Promise<ExportResponse | null> {
  // Vérifier que le projet existe
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return null;
  }

  // Vérifier que le format est supporté
  const supportedFormats = ["json", "tree", "zip"];
  if (!supportedFormats.includes(data.format)) {
    throw new Error(`unsupported export format: ${data.format}`);
  }

  const now = new Date();
  const label = data.label || `${data.kind} export (${data.format})`;

  const exportRecord = await prisma.exportRecord.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      kind: data.kind,
      format: data.format,
      status: "pending",
      label,
      summary: data.summary,
      metadataJson: {},
      createdAt: now,
      updatedAt: now,
    },
  });

  // Déclencher l'export via Inngest
  await sendExportProjectEvent({
    projectId,
    exportId: exportRecord.id,
    kind: data.kind,
    format: data.format,
  });

  return serializeExport(exportRecord);
}

export async function getExportDownload(
  projectId: string,
  exportId: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
  const exportRecord = await prisma.exportRecord.findFirst({
    where: { id: exportId, projectId },
  });

  if (!exportRecord || !exportRecord.artifactPath) {
    return null;
  }

  const { readFile } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");

  if (!existsSync(exportRecord.artifactPath)) {
    return null;
  }

  const buffer = await readFile(exportRecord.artifactPath);
  const mimeType = exportRecord.format === "zip" ? "application/zip" : "application/json";

  return {
    buffer,
    fileName: exportRecord.artifactName || `export-${exportId}.${exportRecord.format}`,
    mimeType,
  };
}
