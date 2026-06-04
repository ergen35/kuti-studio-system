/**
 * Controller Warnings - Logique métier pour les warnings de cohérence
 */

import slugify from "slugify";
import { db } from "@lib/db";
import type { Prisma, Warning } from "@lib/db/generated/client";
import {
  buildContinuityFactMap,
  buildImpossibleFactMap,
  buildToneTagSet,
  isCoherenceRuleEnabled,
  normalizeSignalSlug,
  parseSignalTokens,
  readCoherenceRules,
  readCoherenceSignals,
} from "@lib/coherence-settings";
import { normalizeReferenceKind } from "@lib/story-references";
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

const WARNING_STATUS_PRIORITY: Record<WarningCandidate["status"], number> = {
  open: 0,
  ignored: 1,
  resolved: 2,
};

const WARNING_SEVERITY_PRIORITY: Record<WarningCandidate["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

type ReferenceLookups = {
  characterSlugs: Set<string>;
  sceneSlugs: Set<string>;
  chapterSlugs: Set<string>;
  tomeSlugs: Set<string>;
  assetSlugs: Set<string>;
  environmentSlugs: Set<string>;
};

function normalizeLocationSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, replacement: "-" });
}

function readSettingsRecord(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {};
}

function readAllowedLocations(settingsJson: unknown): string[] {
  const settings = readSettingsRecord(settingsJson);
  const raw = Array.isArray(settings.locationsJson)
    ? settings.locationsJson
    : [];

  return raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function loadProjectSettings(projectId: string): Promise<Record<string, unknown>> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { settingsJson: true },
  });

  return readSettingsRecord(project?.settingsJson);
}

function referenceKindLabel(kind: string): string {
  switch (normalizeReferenceKind(kind)) {
    case "character":
      return "character";
    case "scene":
      return "scene";
    case "chapter":
      return "chapter";
    case "tome":
      return "tome";
    case "asset":
      return "asset";
    case "environment":
      return "location";
    default:
      return kind;
  }
}

function referenceTargetExists(kind: string, targetSlug: string, lookups: ReferenceLookups): boolean {
  switch (normalizeReferenceKind(kind)) {
    case "character":
      return lookups.characterSlugs.has(targetSlug);
    case "scene":
      return lookups.sceneSlugs.has(targetSlug);
    case "chapter":
      return lookups.chapterSlugs.has(targetSlug);
    case "tome":
      return lookups.tomeSlugs.has(targetSlug);
    case "asset":
      return lookups.assetSlugs.has(targetSlug);
    case "environment":
      return lookups.environmentSlugs.has(targetSlug);
    default:
      return true;
  }
}

async function loadReferenceLookups(projectId: string): Promise<ReferenceLookups> {
  const [project, characters, scenes, chapters, tomes, assets] = await Promise.all([
    loadProjectSettings(projectId),
    db.character.findMany({ where: { projectId }, select: { slug: true } }),
    db.scene.findMany({ where: { projectId }, select: { slug: true, location: true } }),
    db.chapter.findMany({ where: { projectId }, select: { slug: true } }),
    db.tome.findMany({ where: { projectId }, select: { slug: true } }),
    db.asset.findMany({ where: { projectId }, select: { slug: true } }),
  ]);

  const projectLocations = readAllowedLocations(project);

  return {
    characterSlugs: new Set(characters.map((character) => character.slug)),
    sceneSlugs: new Set(scenes.map((scene) => scene.slug)),
    chapterSlugs: new Set(chapters.map((chapter) => chapter.slug)),
    tomeSlugs: new Set(tomes.map((tome) => tome.slug)),
    assetSlugs: new Set(assets.map((asset) => asset.slug)),
    environmentSlugs: new Set([
      ...projectLocations.map(normalizeLocationSlug),
      ...scenes.flatMap((scene) => scene.location ? [normalizeLocationSlug(scene.location)] : []),
    ]),
  };
}

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

function compareWarnings(a: {
  status: string;
  severity: string;
  createdAt: Date;
}, b: {
  status: string;
  severity: string;
  createdAt: Date;
}) {
  const statusPriorityA = WARNING_STATUS_PRIORITY[a.status as WarningCandidate["status"]] ?? Number.MAX_SAFE_INTEGER;
  const statusPriorityB = WARNING_STATUS_PRIORITY[b.status as WarningCandidate["status"]] ?? Number.MAX_SAFE_INTEGER;

  if (statusPriorityA !== statusPriorityB) {
    return statusPriorityA - statusPriorityB;
  }

  const severityPriorityA = WARNING_SEVERITY_PRIORITY[a.severity as WarningCandidate["severity"]] ?? Number.MAX_SAFE_INTEGER;
  const severityPriorityB = WARNING_SEVERITY_PRIORITY[b.severity as WarningCandidate["severity"]] ?? Number.MAX_SAFE_INTEGER;

  if (severityPriorityA !== severityPriorityB) {
    return severityPriorityA - severityPriorityB;
  }

  return b.createdAt.getTime() - a.createdAt.getTime();
}

function readMetadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

// ============================================================================
// CRUD Warnings
// ============================================================================

export async function listWarnings(projectId: string, filters?: {
  severity?: string;
  status?: string;
  kind?: string;
  entityKind?: string;
  entityId?: string;
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
  if (filters?.entityKind) {
    where.entityKind = filters.entityKind;
  }
  if (filters?.entityId) {
    where.entityId = filters.entityId;
  }

  const warnings = await db.warning.findMany({
    where,
    orderBy: [
      { createdAt: "desc" },
    ],
  });

  return warnings
    .sort(compareWarnings)
    .map(serializeWarning);
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

type SceneSignalContext = {
  id: string;
  title: string;
  slug: string;
  tomeId: string;
  chapterId: string;
  orderIndex: number;
  sceneType: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  tagsJson: unknown;
  chapter?: { title: string } | null;
  tome?: { title: string } | null;
};

function sceneWarningMetadata(scene: SceneSignalContext) {
  return {
    sceneId: scene.id,
    sceneTitle: scene.title,
    sceneSlug: scene.slug,
    sceneTomeId: scene.tomeId,
    sceneChapterId: scene.chapterId,
    sceneOrderIndex: scene.orderIndex,
    sceneType: scene.sceneType,
    location: scene.location || null,
    chapterTitle: scene.chapter?.title ?? null,
    tomeTitle: scene.tome?.title ?? null,
    signalSource: "scene",
  };
}

function sceneSignalTokens(scene: SceneSignalContext) {
  return parseSignalTokens([scene.summary, scene.content, scene.notes]);
}

function buildSceneWarning(
  projectId: string,
  scene: SceneSignalContext,
  fingerprintSuffix: string,
  kind: string,
  severity: "info" | "warning" | "critical",
  title: string,
  message: string,
  metadataJson: Record<string, unknown>,
): WarningCandidate {
  return {
    projectId,
    fingerprint: `${kind}-${scene.id}-${fingerprintSuffix}`,
    kind,
    severity,
    status: "open",
    title,
    message,
    entityKind: "scene",
    entityId: scene.id,
    metadataJson: {
      ...sceneWarningMetadata(scene),
      ...metadataJson,
    },
  };
}

async function scanTimelineWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];
  const [settings, scenes] = await Promise.all([
    loadProjectSettings(projectId),
    db.scene.findMany({
      where: { projectId },
      include: { chapter: true, tome: true },
    }) as Promise<SceneSignalContext[]>,
  ]);

  const signals = readCoherenceSignals(settings);
  const anchorsBySlug = new Map(signals.timelineAnchors.map((anchor) => [anchor.slug, anchor]));

  for (const scene of scenes) {
    const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "timeline");

    for (const token of tokens) {
      const anchor = anchorsBySlug.get(token.key);

      if (!anchor) {
        warnings.push(buildSceneWarning(
          projectId,
          scene,
          `timeline-missing-${token.key}`,
          "timeline_conflict",
          "warning",
          `Missing timeline anchor: ${scene.title}`,
          `Scene "${scene.title}" references timeline anchor "${token.payload}" but the project registry does not define it.`,
          {
            timelineToken: token.rawToken,
            timelineSlug: token.key,
            timelineAnchorLabel: token.payload,
          },
        ));
        continue;
      }

      if (anchor.orderIndex !== scene.orderIndex) {
        warnings.push(buildSceneWarning(
          projectId,
          scene,
          `timeline-order-${anchor.slug}`,
          "timeline_conflict",
          "warning",
          `Timeline order conflict: ${scene.title}`,
          `Scene "${scene.title}" is placed at order ${scene.orderIndex} but timeline anchor "${anchor.label}" expects order ${anchor.orderIndex}.`,
          {
            timelineToken: token.rawToken,
            timelineSlug: anchor.slug,
            timelineAnchorLabel: anchor.label,
            expectedOrderIndex: anchor.orderIndex,
            actualOrderIndex: scene.orderIndex,
            timelineAnchorNote: anchor.note || null,
          },
        ));
      }
    }
  }

  return { scanned: scenes.length, warnings };
}

async function scanContinuityWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];
  const [settings, scenes] = await Promise.all([
    loadProjectSettings(projectId),
    db.scene.findMany({
      where: { projectId },
      include: { chapter: true, tome: true },
    }) as Promise<SceneSignalContext[]>,
  ]);

  const signals = readCoherenceSignals(settings);
  const continuityFacts = buildContinuityFactMap(signals.continuityFacts);

  for (const scene of scenes) {
    const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "continuity");

    for (const token of tokens) {
      const fact = continuityFacts.get(token.key);

      if (!fact) {
        warnings.push(buildSceneWarning(
          projectId,
          scene,
          `continuity-missing-${token.key}`,
          "continuity_break",
          "warning",
          `Unknown continuity fact: ${scene.title}`,
          `Scene "${scene.title}" references continuity fact "${token.key}" but the project registry does not define it.`,
          {
            continuityToken: token.rawToken,
            continuityKey: token.key,
            continuityValue: token.value,
          },
        ));
        continue;
      }

      if (fact.value !== token.value) {
        warnings.push(buildSceneWarning(
          projectId,
          scene,
          `continuity-mismatch-${fact.key}`,
          "continuity_break",
          "warning",
          `Continuity break: ${scene.title}`,
          `Scene "${scene.title}" asserts "${token.key}=${token.value}" but the canonical continuity fact is "${fact.key}=${fact.value}".`,
          {
            continuityToken: token.rawToken,
            continuityKey: fact.key,
            continuityValue: token.value,
            canonicalValue: fact.value,
            canonicalScope: fact.scope,
          },
        ));
      }
    }
  }

  return { scanned: scenes.length, warnings };
}

async function scanToneWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];
  const [settings, scenes] = await Promise.all([
    loadProjectSettings(projectId),
    db.scene.findMany({
      where: { projectId },
      include: { chapter: true, tome: true },
    }) as Promise<SceneSignalContext[]>,
  ]);

  const signals = readCoherenceSignals(settings);
  const requiredTags = signals.toneProfile.requiredTags.map(normalizeSignalSlug);
  const forbiddenTags = signals.toneProfile.forbiddenTags.map(normalizeSignalSlug);

  if (requiredTags.length === 0 && forbiddenTags.length === 0) {
    return { scanned: scenes.length, warnings };
  }

  for (const scene of scenes) {
    const tokens = sceneSignalTokens(scene);
    const toneTags = buildToneTagSet(scene.tagsJson, tokens);

    const missingRequired = requiredTags.filter((tag) => !toneTags.has(tag));
    const forbiddenHits = forbiddenTags.filter((tag) => toneTags.has(tag));

    if (missingRequired.length === 0 && forbiddenHits.length === 0) {
      continue;
    }

    const issueParts: string[] = [];
    if (missingRequired.length > 0) {
      issueParts.push(`missing required tone tag${missingRequired.length > 1 ? "s" : ""}: ${missingRequired.join(", ")}`);
    }
    if (forbiddenHits.length > 0) {
      issueParts.push(`forbidden tone tag${forbiddenHits.length > 1 ? "s" : ""}: ${forbiddenHits.join(", ")}`);
    }

    warnings.push(buildSceneWarning(
      projectId,
      scene,
      `tone-${[...missingRequired, ...forbiddenHits].sort().join("-") || scene.id}`,
      "tone_break",
      "warning",
      `Tone break: ${scene.title}`,
      `Scene "${scene.title}" has tone mismatches (${issueParts.join("; ")}).`,
      {
        toneTags: Array.from(toneTags),
        requiredToneTags: requiredTags,
        missingRequiredToneTags: missingRequired,
        forbiddenToneTags: forbiddenTags,
        forbiddenToneHits: forbiddenHits,
      },
    ));
  }

  return { scanned: scenes.length, warnings };
}

async function scanImpossibleFactWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];
  const [settings, scenes] = await Promise.all([
    loadProjectSettings(projectId),
    db.scene.findMany({
      where: { projectId },
      include: { chapter: true, tome: true },
    }) as Promise<SceneSignalContext[]>,
  ]);

  const signals = readCoherenceSignals(settings);
  const impossibleFacts = buildImpossibleFactMap(signals.impossibleFacts);

  for (const scene of scenes) {
    const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "fact");

    for (const token of tokens) {
      const forbiddenValues = impossibleFacts.get(token.key);

      if (!forbiddenValues || !forbiddenValues.has(token.value)) {
        continue;
      }

      warnings.push(buildSceneWarning(
        projectId,
        scene,
        `impossible-${token.key}-${token.value}`,
        "impossible_fact",
        "critical",
        `Impossible fact: ${scene.title}`,
        `Scene "${scene.title}" asserts impossible fact "${token.key}=${token.value}".`,
        {
          factToken: token.rawToken,
          factKey: token.key,
          factValue: token.value,
          prohibitedValues: Array.from(forbiddenValues),
        },
      ));
    }
  }

  return { scanned: scenes.length, warnings };
}

export async function scanWarnings(projectId: string) {
  const added: Warning[] = [];
  const resolved: Warning[] = [];
  let scanned = 0;

  const projectSettings = await loadProjectSettings(projectId);
  const rules = readCoherenceRules(projectSettings);

  // Récupérer tous les warnings existants pour éviter les doublons et
  // réouvrir les alertes déjà connues quand la situation réapparaît.
  const existingWarnings = await db.warning.findMany({
    where: { projectId },
  });
  const openWarnings = existingWarnings.filter((warning) => warning.status === "open");
  const warningsByFingerprint = new Map(existingWarnings.map((warning) => [warning.fingerprint, warning]));

  async function persistCandidateWarning(warning: WarningCandidate) {
    const existing = warningsByFingerprint.get(warning.fingerprint);

    if (!existing) {
      const created = await db.warning.create({ data: warningCreateData(warning) });
      added.push(created);
      warningsByFingerprint.set(created.fingerprint, created);
      return;
    }

    if (existing.status === "ignored") {
      return;
    }

    const updated = await db.warning.update({
      where: { id: existing.id },
      data: {
        ...warningCreateData(warning),
        status: "open",
        resolvedAt: null,
        updatedAt: new Date(),
      },
    });

    warningsByFingerprint.set(updated.fingerprint, updated);

    if (existing.status !== "open") {
      added.push(updated);
    }
  }

  // Scanner les personnages orphelins
  if (rules.orphanCharacter) {
    const characterWarnings = await scanCharacterWarnings(projectId);
    scanned += characterWarnings.scanned;
    for (const warning of characterWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  // Scanner les références orphelines dans les scènes
  if (rules.brokenReference) {
    const referenceWarnings = await scanReferenceWarnings(projectId);
    scanned += referenceWarnings.scanned;
    for (const warning of referenceWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  if (rules.locationConflict) {
    const locationWarnings = await scanLocationWarnings(projectId);
    scanned += locationWarnings.scanned;
    for (const warning of locationWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  if (rules.timelineConflict) {
    const timelineWarnings = await scanTimelineWarnings(projectId);
    scanned += timelineWarnings.scanned;
    for (const warning of timelineWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  if (rules.continuityBreak) {
    const continuityWarnings = await scanContinuityWarnings(projectId);
    scanned += continuityWarnings.scanned;
    for (const warning of continuityWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  if (rules.toneBreak) {
    const toneWarnings = await scanToneWarnings(projectId);
    scanned += toneWarnings.scanned;
    for (const warning of toneWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  if (rules.impossibleFact) {
    const impossibleWarnings = await scanImpossibleFactWarnings(projectId);
    scanned += impossibleWarnings.scanned;
    for (const warning of impossibleWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  // Scanner les incohérences de statut
  if (rules.emptyScene) {
    const statusWarnings = await scanStatusWarnings(projectId);
    scanned += statusWarnings.scanned;
    for (const warning of statusWarnings.warnings) {
      await persistCandidateWarning(warning);
    }
  }

  // Résoudre automatiquement les warnings qui ne sont plus valides
  for (const warning of openWarnings) {
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
    orderBy: { createdAt: "desc" },
  });

  return {
    scanned,
    added: added.length,
    resolved: resolved.length,
    items: allOpenWarnings.sort(compareWarnings).map(serializeWarning),
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
          signalSource: "project",
        },
      });
    }
  }

  return { scanned: characters.length, warnings };
}

async function scanLocationWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];
  const [settings, scenes] = await Promise.all([
    loadProjectSettings(projectId),
    db.scene.findMany({
      where: { projectId },
      include: { chapter: true, tome: true },
    }),
  ]);

  const allowedLocations = readAllowedLocations(settings);
  if (allowedLocations.length === 0) {
    return { scanned: scenes.length, warnings };
  }

  const allowedLocationSlugs = new Set(allowedLocations.map(normalizeLocationSlug));

  for (const scene of scenes) {
    const location = typeof scene.location === "string" ? scene.location.trim() : "";
    const normalized = location ? normalizeLocationSlug(location) : "";
    const isAllowed = location.length > 0 && allowedLocationSlugs.has(normalized);

    if (!location || !isAllowed) {
      warnings.push({
        projectId,
        fingerprint: `location-conflict-${scene.id}`,
        kind: "location_conflict",
        severity: "warning",
        status: "open",
        title: location.length === 0
          ? `Missing location: ${scene.title}`
          : `Location not allowed: ${scene.location}`,
        message: location.length === 0
          ? `Scene "${scene.title}" has no assigned location while the project defines allowed locations.`
          : `Scene "${scene.title}" uses "${scene.location}" which is not part of the project allowed locations list.`,
        entityKind: "scene",
        entityId: scene.id,
        metadataJson: {
          sceneId: scene.id,
          sceneTitle: scene.title,
          sceneSlug: scene.slug,
          sceneTomeId: scene.tomeId,
          sceneChapterId: scene.chapterId,
          location: scene.location || null,
          allowedLocations,
          signalSource: "scene",
        },
      });
    }
  }

  return { scanned: scenes.length, warnings };
}

async function scanReferenceWarnings(projectId: string) {
  const warnings: WarningCandidate[] = [];

  // Récupérer toutes les références
  const references = await db.storyReference.findMany({
    where: { projectId },
    include: { scene: true },
  });
  const lookups = await loadReferenceLookups(projectId);

  for (const ref of references) {
    const targetKind = normalizeReferenceKind(ref.referenceKind);
    if (!targetKind) continue;

    if (!referenceTargetExists(targetKind, ref.targetSlug, lookups)) {
      const label = referenceKindLabel(targetKind);
      warnings.push({
        projectId,
        fingerprint: `broken-ref-${ref.sceneId}-${targetKind}-${ref.targetSlug}`,
        kind: "broken_reference",
        severity: "warning",
        status: "open",
        title: `Broken ${label} reference`,
        message: `Scene "${ref.scene.title}" references unknown ${label} "${ref.targetSlug}"`,
        entityKind: "scene",
        entityId: ref.sceneId,
        metadataJson: {
          sceneId: ref.sceneId,
          sceneTitle: ref.scene.title,
          sceneTomeId: ref.scene.tomeId,
          sceneChapterId: ref.scene.chapterId,
          targetKind,
          targetSlug: ref.targetSlug,
          rawToken: ref.rawToken,
          signalSource: "reference",
        },
      });
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
          signalSource: "scene",
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
  const settings = await loadProjectSettings(projectId);
  const rules = readCoherenceRules(settings);

  if (!isCoherenceRuleEnabled(rules, warning.kind)) {
    return false;
  }

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
      const metadata = readMetadataRecord(warning.metadataJson);
      const sceneId = readMetadataString(metadata, "sceneId") ?? warning.entityId;
      const targetKind = readMetadataString(metadata, "targetKind");
      const targetSlug = readMetadataString(metadata, "targetSlug");
      const normalizedKind = targetKind ? normalizeReferenceKind(targetKind) : null;

      if (!sceneId || !normalizedKind || !targetSlug) {
        return false;
      }

      const ref = await db.storyReference.findFirst({
        where: {
          projectId,
          sceneId,
          referenceKind: normalizedKind,
          targetSlug,
        },
      });
      if (!ref) return false;

      const lookups = await loadReferenceLookups(projectId);
      return !referenceTargetExists(normalizedKind, targetSlug, lookups);
    }

    case "location_conflict": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
      });
      if (!scene) return false;

      const allowedLocations = readAllowedLocations(settings);
      if (allowedLocations.length === 0) {
        return false;
      }

      const location = typeof scene.location === "string" ? scene.location.trim() : "";
      if (!location) {
        return true;
      }

      const normalized = normalizeLocationSlug(location);
      return !allowedLocations.map(normalizeLocationSlug).includes(normalized);
    }

    case "empty_scene": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
      });
      if (!scene) return false;
      return !scene.content || scene.content.length < 50;
    }

    case "timeline_conflict": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
        include: { chapter: true, tome: true },
      }) as SceneSignalContext | null;
      if (!scene) return false;

      const signals = readCoherenceSignals(settings);
      const anchorsBySlug = new Map(signals.timelineAnchors.map((anchor) => [anchor.slug, anchor]));
      const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "timeline");

      return tokens.some((token) => {
        const anchor = anchorsBySlug.get(token.key);
        if (!anchor) {
          return warning.fingerprint === `timeline_conflict-${scene.id}-timeline-missing-${token.key}`;
        }

        return anchor.orderIndex !== scene.orderIndex
          && warning.fingerprint === `timeline_conflict-${scene.id}-timeline-order-${anchor.slug}`;
      });
    }

    case "continuity_break": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
        include: { chapter: true, tome: true },
      }) as SceneSignalContext | null;
      if (!scene) return false;

      const signals = readCoherenceSignals(settings);
      const continuityFacts = buildContinuityFactMap(signals.continuityFacts);
      const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "continuity");

      return tokens.some((token) => {
        const fact = continuityFacts.get(token.key);
        if (!fact) {
          return warning.fingerprint === `continuity_break-${scene.id}-continuity-missing-${token.key}`;
        }

        return fact.value !== token.value
          && warning.fingerprint === `continuity_break-${scene.id}-continuity-mismatch-${fact.key}`;
      });
    }

    case "tone_break": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
        include: { chapter: true, tome: true },
      }) as SceneSignalContext | null;
      if (!scene) return false;

      const signals = readCoherenceSignals(settings);
      const requiredTags = signals.toneProfile.requiredTags.map(normalizeSignalSlug);
      const forbiddenTags = signals.toneProfile.forbiddenTags.map(normalizeSignalSlug);
      const toneTags = buildToneTagSet(scene.tagsJson, sceneSignalTokens(scene));

      const missingRequired = requiredTags.filter((tag) => !toneTags.has(tag));
      const forbiddenHits = forbiddenTags.filter((tag) => toneTags.has(tag));

      if (missingRequired.length === 0 && forbiddenHits.length === 0) {
        return false;
      }

      const fingerprintSuffix = `tone-${[...missingRequired, ...forbiddenHits].sort().join("-") || scene.id}`;
      return warning.fingerprint === `tone_break-${scene.id}-${fingerprintSuffix}`;
    }

    case "impossible_fact": {
      const scene = await db.scene.findFirst({
        where: { id: warning.entityId, projectId },
        include: { chapter: true, tome: true },
      }) as SceneSignalContext | null;
      if (!scene) return false;

      const signals = readCoherenceSignals(settings);
      const impossibleFacts = buildImpossibleFactMap(signals.impossibleFacts);
      const tokens = sceneSignalTokens(scene).filter((token) => token.kind === "fact");

      return tokens.some((token) => {
        const forbiddenValues = impossibleFacts.get(token.key);
        return !!forbiddenValues?.has(token.value)
          && warning.fingerprint === `impossible_fact-${scene.id}-impossible-${token.key}-${token.value}`;
      });
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
