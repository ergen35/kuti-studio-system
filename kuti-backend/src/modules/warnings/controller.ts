/**
 * Controller Warnings - Logique métier pour les warnings de cohérence
 */

import { db } from "@lib/db";
import type { Prisma, Warning } from "@lib/db/generated/client";
import type { UpdateWarningBody } from "./dto";

type WarningCandidate = {
  projectId: string;
  fingerprint: string;
  kind: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "ignored" | "resolved";
  title: string;
  message: string;
  entityKind: string;
  entityId: string;
  metadataJson: Record<string, unknown>;
};

function serializeWarning(warning: Warning) {
  return {
    ...warning,
    metadataJson: warning.metadataJson as Record<string, unknown>,
    createdAt: warning.createdAt.toISOString(),
    updatedAt: warning.updatedAt.toISOString(),
    resolvedAt: warning.resolvedAt?.toISOString() || null,
  };
}

function warningCreateData(warning: WarningCandidate) {
  return {
    ...warning,
    metadataJson: warning.metadataJson as Prisma.InputJsonValue,
  };
}

// ============================================================================
// CRUD Warnings
// ============================================================================

export async function listWarnings(projectId: string, filters?: {
  severity?: string;
  status?: string;
  kind?: string;
}) {
  const where: Record<string, unknown> = { projectId };

  if (filters?.severity) {
    where.severity = filters.severity;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.kind) {
    where.kind = filters.kind;
  }

  const warnings = await db.warning.findMany({
    where,
    orderBy: [
      { status: "asc" }, // open first
      { severity: "asc" }, // critical first
      { createdAt: "desc" },
    ],
  });

  return warnings.map(serializeWarning);
}

export async function getWarning(projectId: string, warningId: string) {
  const warning = await db.warning.findFirst({
    where: { id: warningId, projectId },
  });

  if (!warning) return null;

  return serializeWarning(warning);
}

export async function updateWarning(
  projectId: string,
  warningId: string,
  data: UpdateWarningBody
) {
  const warning = await db.warning.findFirst({
    where: { id: warningId, projectId },
  });

  if (!warning) return null;

  const updateData: Record<string, unknown> = {};

  if (data.status) {
    updateData.status = data.status;
    if (data.status === "resolved") {
      updateData.resolvedAt = new Date();
    } else {
      updateData.resolvedAt = null;
    }
  }

  if (data.note) {
    updateData.metadataJson = {
      ...(warning.metadataJson as Record<string, unknown>),
      note: data.note,
    } as Prisma.InputJsonValue;
  }

  const updated = await db.warning.update({
    where: { id: warningId },
    data: updateData,
  });

  return serializeWarning(updated);
}

// ============================================================================
// Scan des warnings
// ============================================================================

export async function scanWarnings(projectId: string) {
  const added: Warning[] = [];
  const resolved: Warning[] = [];
  let scanned = 0;

  // Récupérer tous les warnings existants
  const existingWarnings = await db.warning.findMany({
    where: { projectId, status: "open" },
  });
  const openFingerprints = new Set(existingWarnings.map((w) => w.fingerprint));

  // Scanner les personnages orphelins
  const characterWarnings = await scanCharacterWarnings(projectId);
  scanned += characterWarnings.scanned;
  for (const warning of characterWarnings.warnings) {
    if (!openFingerprints.has(warning.fingerprint)) {
      const created = await db.warning.create({ data: warningCreateData(warning) });
      added.push(created);
      openFingerprints.add(warning.fingerprint);
    }
  }

  // Scanner les références orphelines dans les scènes
  const referenceWarnings = await scanReferenceWarnings(projectId);
  scanned += referenceWarnings.scanned;
  for (const warning of referenceWarnings.warnings) {
    if (!openFingerprints.has(warning.fingerprint)) {
      const created = await db.warning.create({ data: warningCreateData(warning) });
      added.push(created);
      openFingerprints.add(warning.fingerprint);
    }
  }

  // Scanner les incohérences de statut
  const statusWarnings = await scanStatusWarnings(projectId);
  scanned += statusWarnings.scanned;
  for (const warning of statusWarnings.warnings) {
    if (!openFingerprints.has(warning.fingerprint)) {
      const created = await db.warning.create({ data: warningCreateData(warning) });
      added.push(created);
      openFingerprints.add(warning.fingerprint);
    }
  }

  // Résoudre automatiquement les warnings qui ne sont plus valides
  for (const warning of existingWarnings) {
    const isStillValid = await checkWarningStillValid(projectId, warning);
    if (!isStillValid) {
      const updated = await db.warning.update({
        where: { id: warning.id },
        data: { status: "resolved", resolvedAt: new Date() },
      });
      resolved.push(updated);
    }
  }

  // Récupérer tous les warnings ouverts
  const allOpenWarnings = await db.warning.findMany({
    where: { projectId, status: "open" },
    orderBy: [
      { severity: "asc" },
      { createdAt: "desc" },
    ],
  });

  return {
    scanned,
    added: added.length,
    resolved: resolved.length,
    items: allOpenWarnings.map(serializeWarning),
  };
}

// ============================================================================
// Scan spécifiques
// ============================================================================

async function scanCharacterWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];

  // Personnages sans scènes
  const characters = await db.character.findMany({
    where: { projectId, status: "active" },
    include: {
      sourceRelations: true,
      targetRelations: true,
    },
  });

  const scenes = await db.scene.findMany({
    where: { projectId },
  });

  for (const character of characters) {
    const isInScene = scenes.some((scene) => {
      const chars = scene.charactersJson as string[];
      return chars.includes(character.id);
    });

    if (!isInScene && character.sourceRelations.length === 0 && character.targetRelations.length === 0) {
      warnings.push({
        projectId,
        fingerprint: `orphan-character-${character.id}`,
        kind: "orphan_character",
        severity: "warning",
        status: "open",
        title: `Orphan character: ${character.name}`,
        message: `Character "${character.name}" is not referenced in any scene or relation.`,
        entityKind: "character",
        entityId: character.id,
        metadataJson: {
          characterName: character.name,
          characterSlug: character.slug,
        },
      });
    }
  }

  return { scanned: characters.length, warnings };
}

async function scanReferenceWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];

  // Récupérer toutes les références
  const references = await db.storyReference.findMany({
    where: { projectId },
    include: { scene: true },
  });

  // Récupérer tous les personnages pour vérifier les références
  const characters = await db.character.findMany({
    where: { projectId },
    select: { id: true, slug: true, name: true },
  });

  const characterSlugs = new Set(characters.map((c) => c.slug));

  for (const ref of references) {
    if (ref.referenceKind === "character") {
      if (!characterSlugs.has(ref.targetSlug)) {
        warnings.push({
          projectId,
          fingerprint: `broken-ref-${ref.id}`,
          kind: "broken_reference",
          severity: "warning",
          status: "open",
          title: `Broken character reference`,
          message: `Scene "${ref.scene.title}" references unknown character "${ref.targetSlug}"`,
          entityKind: "scene",
          entityId: ref.sceneId,
          metadataJson: {
            sceneId: ref.sceneId,
            sceneTitle: ref.scene.title,
            targetKind: ref.referenceKind,
            targetSlug: ref.targetSlug,
            rawToken: ref.rawToken,
          },
        });
      }
    }
  }

  return { scanned: references.length, warnings };
}

async function scanStatusWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];

  // Scènes vides
  const scenes = await db.scene.findMany({
    where: { projectId },
    include: { chapter: true, tome: true },
  });

  for (const scene of scenes) {
    if (scene.status === "active" && (!scene.content || scene.content.length < 50)) {
      warnings.push({
        projectId,
        fingerprint: `empty-scene-${scene.id}`,
        kind: "empty_scene",
        severity: "info",
        status: "open",
        title: `Empty scene: ${scene.title}`,
        message: `Scene "${scene.title}" has very little content and might need attention.`,
        entityKind: "scene",
        entityId: scene.id,
        metadataJson: {
          sceneTitle: scene.title,
          sceneSlug: scene.slug,
          chapterId: scene.chapterId,
          chapterTitle: scene.chapter?.title,
        },
      });
    }
  }

  return { scanned: scenes.length, warnings };
}

async function checkWarningStillValid(
  projectId: string,
  warning: {
    kind: string;
    entityKind: string;
    entityId: string;
    fingerprint: string;
    metadataJson: unknown;
  }
): Promise<boolean> {
  switch (warning.kind) {
    case "orphan_character": {
      const scenes = await db.scene.findMany({
        where: { projectId },
      });
      const isInScene = scenes.some((scene) => {
        const chars = scene.charactersJson as string[];
        return chars.includes(warning.entityId);
      });
      const relations = await db.characterRelation.findMany({
        where: {
          OR: [
            { sourceCharacterId: warning.entityId },
            { targetCharacterId: warning.entityId },
          ],
        },
      });
      return !isInScene && relations.length === 0;
    }

    case "broken_reference": {
      const ref = await db.storyReference.findFirst({
        where: { id: warning.entityId },
      });
      if (!ref) return false;

      if (ref.referenceKind === "character") {
        const character = await db.character.findFirst({
          where: { projectId, slug: ref.targetSlug },
        });
        return !character;
      }
      return false;
    }

    case "empty_scene": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
      });
      if (!scene) return false;
      return !scene.content || scene.content.length < 50;
    }

    default:
      return true;
  }
}

// ============================================================================
// Rebuild warnings
// ============================================================================

export async function rebuildWarnings(projectId: string): Promise<void> {
  // Marquer tous les warnings ouverts comme résolus
  await db.warning.updateMany({
    where: { projectId, status: "open" },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  // Relancer un scan complet
  await scanWarnings(projectId);
}
