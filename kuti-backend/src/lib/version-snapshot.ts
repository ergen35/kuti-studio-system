import { db } from "@lib/db";
import type { Prisma } from "@lib/db/generated/client";

type JsonRecord = Record<string, unknown>;
type DbClient = typeof db | Prisma.TransactionClient;

type SnapshotProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  rootPath: string;
  settingsJson: JsonRecord;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
};

type SnapshotCharacter = {
  id: string;
  slug: string;
  name: string;
  alias: string | null;
  narrativeRole: string | null;
  description: string;
  physicalDescription: string;
  colorPaletteJson: unknown[];
  costumeElementsJson: unknown[];
  keyTraitsJson: unknown[];
  personality: string;
  narrativeArc: string;
  tagsJson: unknown[];
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type SnapshotCharacterRelation = {
  id: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationType: string;
  strength: number;
  narrativeDependency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type SnapshotCharacterImage = {
  id: string;
  characterId: string;
  boardPanelId: string | null;
  filePath: string;
  publicUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  prompt: string;
  strategy: string | null;
  style: string | null;
  variationIndex: number | null;
  createdAt: string;
};

type SnapshotVoiceSample = {
  id: string;
  characterId: string;
  assetPath: string | null;
  label: string;
  voiceNotes: string;
  createdAt: string;
};

type SnapshotTome = {
  id: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

type SnapshotChapter = {
  id: string;
  tomeId: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

type SnapshotScene = {
  id: string;
  tomeId: string;
  chapterId: string;
  title: string;
  slug: string;
  sceneType: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  charactersJson: string[];
  tagsJson: string[];
  metadataJson: JsonRecord;
  status: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

type SnapshotStoryReference = {
  id: string;
  sceneId: string;
  referenceKind: string;
  targetSlug: string;
  rawToken: string;
  createdAt: string;
};

type SnapshotAsset = {
  id: string;
  slug: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  checksum: string;
  sizeBytes: number;
  storagePath: string;
  description: string;
  tagsJson: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type SnapshotAssetLink = {
  id: string;
  assetId: string;
  targetKind: string;
  targetId: string;
  note: string;
  createdAt: string;
};

type SnapshotSceneGenerationConfig = {
  id: string;
  name: string;
  isDefault: boolean;
  systemPrompt: string;
  stylePreset: string;
  colorMode: string;
  defaultImageCount: number;
  allowMultiPage: boolean;
  metadataJson: JsonRecord;
  createdAt: string;
  updatedAt: string;
};

export type VersionSnapshot = {
  schemaVersion: 1;
  capturedAt: string;
  project: SnapshotProject;
  counts: Record<string, number>;
  data: {
    characters: SnapshotCharacter[];
    characterRelations: SnapshotCharacterRelation[];
    characterImages: SnapshotCharacterImage[];
    voiceSamples: SnapshotVoiceSample[];
    tomes: SnapshotTome[];
    chapters: SnapshotChapter[];
    scenes: SnapshotScene[];
    storyReferences: SnapshotStoryReference[];
    assets: SnapshotAsset[];
    assetLinks: SnapshotAssetLink[];
    sceneGenerationConfigs: SnapshotSceneGenerationConfig[];
  };
};

export type VersionSnapshotSummary = {
  schemaVersion: 1;
  capturedAt: string;
  project: Pick<SnapshotProject, "id" | "name" | "slug" | "status">;
  counts: Record<string, number>;
};

type SnapshotCollectionName = keyof VersionSnapshot["data"];

const COLLECTION_LABELS: Record<SnapshotCollectionName, string> = {
  characters: "characters",
  characterRelations: "character relations",
  characterImages: "character images",
  voiceSamples: "voice samples",
  tomes: "tomes",
  chapters: "chapters",
  scenes: "scenes",
  storyReferences: "story references",
  assets: "assets",
  assetLinks: "asset links",
  sceneGenerationConfigs: "scene generation configs",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonRecord(value: unknown): JsonRecord {
  return isPlainObject(value)
    ? value as JsonRecord
    : {};
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function sortBy<T>(items: T[], comparator: (left: T, right: T) => number): T[] {
  return [...items].sort(comparator);
}

function byLabel(value: { name?: string | null; title?: string | null; slug?: string | null; id: string }): string {
  return value.name ?? value.title ?? value.slug ?? value.id;
}

function stableSortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortJson(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const key of Object.keys(source).sort()) {
      target[key] = stableSortJson(source[key]);
    }

    return target;
  }

  return value;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(stableSortJson(value));
}

export function parseVersionSnapshot(value: unknown): VersionSnapshot | null {
  if (!isPlainObject(value)) {
    return null;
  }

  if (value.schemaVersion !== 1 || typeof value.capturedAt !== "string") {
    return null;
  }

  if (!isPlainObject(value.project) || !isPlainObject(value.counts) || !isPlainObject(value.data)) {
    return null;
  }

  return value as VersionSnapshot;
}

export function summarizeVersionSnapshot(snapshot: VersionSnapshot | null | undefined): VersionSnapshotSummary | null {
  if (!snapshot) {
    return null;
  }

  return {
    schemaVersion: snapshot.schemaVersion,
    capturedAt: snapshot.capturedAt,
    project: {
      id: snapshot.project.id,
      name: snapshot.project.name,
      slug: snapshot.project.slug,
      status: snapshot.project.status,
    },
    counts: snapshot.counts,
  };
}

function ignoreTimestamps<T extends Record<string, unknown>>(value: T, ignoredKeys: string[] = ["createdAt", "updatedAt"]): Record<string, unknown> {
  const clone: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (ignoredKeys.includes(key)) continue;
    clone[key] = item;
  }

  return clone;
}

function collectionSnapshotSummary<T extends { id: string }>(items: T[]): { count: number; byId: Map<string, T> } {
  return {
    count: items.length,
    byId: new Map(items.map((item) => [item.id, item])),
  };
}

function formatNames(items: Array<{ name?: string | null; title?: string | null; slug?: string | null; id: string }>, limit = 3): string {
  const labels = items.map((item) => byLabel(item));

  if (labels.length <= limit) {
    return labels.join(", ");
  }

  return `${labels.slice(0, limit).join(", ")} +${labels.length - limit} more`;
}

function compareCollections<T extends { id: string }>(
  name: SnapshotCollectionName,
  leftItems: T[],
  rightItems: T[],
  labelResolver: (item: T) => string,
  comparableResolver: (item: T) => unknown,
  projectChanges: string[],
  countsDelta: Record<string, number>,
) {
  const leftSummary = collectionSnapshotSummary(leftItems);
  const rightSummary = collectionSnapshotSummary(rightItems);

  countsDelta[name] = rightSummary.count - leftSummary.count;

  const added = rightItems.filter((item) => !leftSummary.byId.has(item.id));
  const removed = leftItems.filter((item) => !rightSummary.byId.has(item.id));
  const updated = rightItems.filter((item) => {
    const left = leftSummary.byId.get(item.id);
    return left ? stableJsonStringify(comparableResolver(left)) !== stableJsonStringify(comparableResolver(item)) : false;
  });

  if (added.length === 0 && removed.length === 0 && updated.length === 0) {
    return;
  }

  projectChanges.push(
    `${COLLECTION_LABELS[name]}: +${added.length} / -${removed.length} / ~${updated.length}`,
  );

  if (added.length > 0) {
    projectChanges.push(`Added ${COLLECTION_LABELS[name]}: ${formatNames(added.map((item) => ({ ...item, name: labelResolver(item) })))}`);
  }

  if (removed.length > 0) {
    projectChanges.push(`Removed ${COLLECTION_LABELS[name]}: ${formatNames(removed.map((item) => ({ ...item, name: labelResolver(item) })))}`);
  }

  if (updated.length > 0) {
    projectChanges.push(`Updated ${COLLECTION_LABELS[name]}: ${formatNames(updated.map((item) => ({ ...item, name: labelResolver(item) })))}`);
  }
}

export async function captureVersionSnapshot(projectId: string, client: DbClient = db): Promise<VersionSnapshot | null> {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      rootPath: true,
      settingsJson: true,
      createdAt: true,
      updatedAt: true,
      lastOpenedAt: true,
      archivedAt: true,
    },
  });

  if (!project) {
    return null;
  }

  const [
    characters,
    characterRelations,
    characterImages,
    voiceSamples,
    tomes,
    chapters,
    scenes,
    storyReferences,
    assets,
    assetLinks,
    sceneGenerationConfigs,
  ] = await Promise.all([
    client.character.findMany({ where: { projectId } }),
    client.characterRelation.findMany({ where: { projectId } }),
    client.characterImage.findMany({ where: { projectId } }),
    client.voiceSample.findMany({ where: { projectId } }),
    client.tome.findMany({ where: { projectId } }),
    client.chapter.findMany({ where: { projectId } }),
    client.scene.findMany({ where: { projectId } }),
    client.storyReference.findMany({ where: { projectId } }),
    client.asset.findMany({ where: { projectId } }),
    client.assetLink.findMany({ where: { projectId } }),
    client.sceneGenerationConfig.findMany({ where: { projectId } }),
  ]);

  const snapshot: VersionSnapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      rootPath: project.rootPath,
      settingsJson: toJsonRecord(project.settingsJson),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      lastOpenedAt: toIso(project.lastOpenedAt),
      archivedAt: toIso(project.archivedAt),
    },
    counts: {},
    data: {
      characters: sortBy(characters.map((character) => ({
        id: character.id,
        slug: character.slug,
        name: character.name,
        alias: character.alias,
        narrativeRole: character.narrativeRole,
        description: character.description,
        physicalDescription: character.physicalDescription,
        colorPaletteJson: Array.isArray(character.colorPaletteJson) ? character.colorPaletteJson : [],
        costumeElementsJson: Array.isArray(character.costumeElementsJson) ? character.costumeElementsJson : [],
        keyTraitsJson: Array.isArray(character.keyTraitsJson) ? character.keyTraitsJson : [],
        personality: character.personality,
        narrativeArc: character.narrativeArc,
        tagsJson: Array.isArray(character.tagsJson) ? character.tagsJson : [],
        status: character.status,
        createdAt: character.createdAt.toISOString(),
        updatedAt: character.updatedAt.toISOString(),
        archivedAt: toIso(character.archivedAt),
      })), (left, right) => left.name.localeCompare(right.name)),
      characterRelations: sortBy(characterRelations.map((relation) => ({
        id: relation.id,
        sourceCharacterId: relation.sourceCharacterId,
        targetCharacterId: relation.targetCharacterId,
        relationType: relation.relationType,
        strength: relation.strength,
        narrativeDependency: relation.narrativeDependency,
        notes: relation.notes,
        createdAt: relation.createdAt.toISOString(),
        updatedAt: relation.updatedAt.toISOString(),
      })), (left, right) => left.createdAt.localeCompare(right.createdAt)),
      characterImages: sortBy(characterImages.map((image) => ({
        id: image.id,
        characterId: image.characterId,
        boardPanelId: image.boardPanelId,
        filePath: image.filePath,
        publicUrl: image.publicUrl,
        fileName: image.fileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        prompt: image.prompt,
        strategy: image.strategy,
        style: image.style,
        variationIndex: image.variationIndex,
        createdAt: image.createdAt.toISOString(),
      })), (left, right) => left.createdAt.localeCompare(right.createdAt)),
      voiceSamples: sortBy(voiceSamples.map((sample) => ({
        id: sample.id,
        characterId: sample.characterId,
        assetPath: sample.assetPath,
        label: sample.label,
        voiceNotes: sample.voiceNotes,
        createdAt: sample.createdAt.toISOString(),
      })), (left, right) => left.createdAt.localeCompare(right.createdAt)),
      tomes: sortBy(tomes.map((tome) => ({
        id: tome.id,
        title: tome.title,
        slug: tome.slug,
        synopsis: tome.synopsis,
        status: tome.status,
        orderIndex: tome.orderIndex,
        createdAt: tome.createdAt.toISOString(),
        updatedAt: tome.updatedAt.toISOString(),
      })), (left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title)),
      chapters: sortBy(chapters.map((chapter) => ({
        id: chapter.id,
        tomeId: chapter.tomeId,
        title: chapter.title,
        slug: chapter.slug,
        synopsis: chapter.synopsis,
        status: chapter.status,
        orderIndex: chapter.orderIndex,
        createdAt: chapter.createdAt.toISOString(),
        updatedAt: chapter.updatedAt.toISOString(),
      })), (left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title)),
      scenes: sortBy(scenes.map((scene) => ({
        id: scene.id,
        tomeId: scene.tomeId,
        chapterId: scene.chapterId,
        title: scene.title,
        slug: scene.slug,
        sceneType: scene.sceneType,
        location: scene.location,
        summary: scene.summary,
        content: scene.content,
        notes: scene.notes,
        charactersJson: toStringArray(scene.charactersJson),
        tagsJson: toStringArray(scene.tagsJson),
        metadataJson: toJsonRecord(scene.metadataJson),
        status: scene.status,
        orderIndex: scene.orderIndex,
        createdAt: scene.createdAt.toISOString(),
        updatedAt: scene.updatedAt.toISOString(),
      })), (left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title)),
      storyReferences: sortBy(storyReferences.map((reference) => ({
        id: reference.id,
        sceneId: reference.sceneId,
        referenceKind: reference.referenceKind,
        targetSlug: reference.targetSlug,
        rawToken: reference.rawToken,
        createdAt: reference.createdAt.toISOString(),
      })), (left, right) => left.createdAt.localeCompare(right.createdAt)),
      assets: sortBy(assets.map((asset) => ({
        id: asset.id,
        slug: asset.slug,
        name: asset.name,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        checksum: asset.checksum,
        sizeBytes: asset.sizeBytes,
        storagePath: asset.storagePath,
        description: asset.description,
        tagsJson: toStringArray(asset.tagsJson),
        status: asset.status,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
        archivedAt: toIso(asset.archivedAt),
      })), (left, right) => left.name.localeCompare(right.name)),
      assetLinks: sortBy(assetLinks.map((link) => ({
        id: link.id,
        assetId: link.assetId,
        targetKind: link.targetKind,
        targetId: link.targetId,
        note: link.note,
        createdAt: link.createdAt.toISOString(),
      })), (left, right) => left.createdAt.localeCompare(right.createdAt)),
      sceneGenerationConfigs: sortBy(sceneGenerationConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        isDefault: config.isDefault,
        systemPrompt: config.systemPrompt,
        stylePreset: config.stylePreset,
        colorMode: config.colorMode,
        defaultImageCount: config.defaultImageCount,
        allowMultiPage: config.allowMultiPage,
        metadataJson: toJsonRecord(config.metadataJson),
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      })), (left, right) => left.name.localeCompare(right.name)),
    },
  };

  snapshot.counts = {
    characters: snapshot.data.characters.length,
    characterRelations: snapshot.data.characterRelations.length,
    characterImages: snapshot.data.characterImages.length,
    voiceSamples: snapshot.data.voiceSamples.length,
    tomes: snapshot.data.tomes.length,
    chapters: snapshot.data.chapters.length,
    scenes: snapshot.data.scenes.length,
    storyReferences: snapshot.data.storyReferences.length,
    assets: snapshot.data.assets.length,
    assetLinks: snapshot.data.assetLinks.length,
    sceneGenerationConfigs: snapshot.data.sceneGenerationConfigs.length,
  };

  return snapshot;
}

export function compareVersionSnapshots(left: VersionSnapshot, right: VersionSnapshot): {
  projectChanges: string[];
  countsDelta: Record<string, number>;
} {
  const projectChanges: string[] = [];
  const countsDelta: Record<string, number> = {};

  if (left.project.name !== right.project.name) {
    projectChanges.push(`Project name changed from "${left.project.name}" to "${right.project.name}"`);
  }

  if (left.project.slug !== right.project.slug) {
    projectChanges.push(`Project slug changed from "${left.project.slug}" to "${right.project.slug}"`);
  }

  if (left.project.status !== right.project.status) {
    projectChanges.push(`Project status changed from ${left.project.status} to ${right.project.status}`);
  }

  if (left.project.rootPath !== right.project.rootPath) {
    projectChanges.push(`Project root path changed from "${left.project.rootPath}" to "${right.project.rootPath}"`);
  }

  if (left.project.archivedAt !== right.project.archivedAt) {
    projectChanges.push("Project archived state changed");
  }

  if (stableJsonStringify(left.project.settingsJson) !== stableJsonStringify(right.project.settingsJson)) {
    projectChanges.push("Project settings changed");
  }

  compareCollections(
    "characters",
    left.data.characters,
    right.data.characters,
    (item) => item.name,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "characterRelations",
    left.data.characterRelations,
    right.data.characterRelations,
    (item) => `${item.relationType} ${item.sourceCharacterId} -> ${item.targetCharacterId}`,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "characterImages",
    left.data.characterImages,
    right.data.characterImages,
    (item) => item.fileName,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "voiceSamples",
    left.data.voiceSamples,
    right.data.voiceSamples,
    (item) => item.label,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "tomes",
    left.data.tomes,
    right.data.tomes,
    (item) => item.title,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "chapters",
    left.data.chapters,
    right.data.chapters,
    (item) => item.title,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "scenes",
    left.data.scenes,
    right.data.scenes,
    (item) => item.title,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "storyReferences",
    left.data.storyReferences,
    right.data.storyReferences,
    (item) => item.rawToken,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "assets",
    left.data.assets,
    right.data.assets,
    (item) => item.name,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "assetLinks",
    left.data.assetLinks,
    right.data.assetLinks,
    (item) => `${item.targetKind} ${item.targetId}`,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  compareCollections(
    "sceneGenerationConfigs",
    left.data.sceneGenerationConfigs,
    right.data.sceneGenerationConfigs,
    (item) => item.name,
    (item) => ignoreTimestamps(item),
    projectChanges,
    countsDelta,
  );

  return { projectChanges, countsDelta };
}

export async function restoreProjectSnapshot(projectId: string, snapshot: VersionSnapshot, client: DbClient = db): Promise<void> {
  const now = new Date();

  await client.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    await tx.project.update({
      where: { id: projectId },
      data: {
        name: snapshot.project.name,
        slug: snapshot.project.slug,
        status: snapshot.project.status as never,
        rootPath: snapshot.project.rootPath,
        settingsJson: snapshot.project.settingsJson as Prisma.InputJsonValue,
        archivedAt: snapshot.project.archivedAt ? new Date(snapshot.project.archivedAt) : null,
        lastOpenedAt: now,
        updatedAt: now,
      },
    });

    await tx.storyReference.deleteMany({ where: { projectId } });
    await tx.assetLink.deleteMany({ where: { projectId } });
    await tx.voiceSample.deleteMany({ where: { projectId } });
    await tx.characterRelation.deleteMany({ where: { projectId } });
    await tx.characterImage.deleteMany({ where: { projectId } });
    await tx.scene.deleteMany({ where: { projectId } });
    await tx.chapter.deleteMany({ where: { projectId } });
    await tx.tome.deleteMany({ where: { projectId } });
    await tx.sceneGenerationConfig.deleteMany({ where: { projectId } });
    await tx.asset.deleteMany({ where: { projectId } });
    await tx.character.deleteMany({ where: { projectId } });

    if (snapshot.data.characters.length > 0) {
      await tx.character.createMany({
        data: snapshot.data.characters.map((character) => ({
          id: character.id,
          projectId,
          slug: character.slug,
          name: character.name,
          alias: character.alias,
          narrativeRole: character.narrativeRole,
          description: character.description,
          physicalDescription: character.physicalDescription,
          colorPaletteJson: character.colorPaletteJson as Prisma.InputJsonValue,
          costumeElementsJson: character.costumeElementsJson as Prisma.InputJsonValue,
          keyTraitsJson: character.keyTraitsJson as Prisma.InputJsonValue,
          personality: character.personality,
          narrativeArc: character.narrativeArc,
          tagsJson: character.tagsJson as Prisma.InputJsonValue,
          status: character.status as never,
          createdAt: new Date(character.createdAt),
          updatedAt: new Date(character.updatedAt),
          archivedAt: character.archivedAt ? new Date(character.archivedAt) : null,
        })),
      });
    }

    if (snapshot.data.characterRelations.length > 0) {
      await tx.characterRelation.createMany({
        data: snapshot.data.characterRelations.map((relation) => ({
          id: relation.id,
          projectId,
          sourceCharacterId: relation.sourceCharacterId,
          targetCharacterId: relation.targetCharacterId,
          relationType: relation.relationType,
          strength: relation.strength,
          narrativeDependency: relation.narrativeDependency,
          notes: relation.notes,
          createdAt: new Date(relation.createdAt),
          updatedAt: new Date(relation.updatedAt),
        })),
      });
    }

    if (snapshot.data.characterImages.length > 0) {
      await tx.characterImage.createMany({
        data: snapshot.data.characterImages.map((image) => ({
          id: image.id,
          projectId,
          characterId: image.characterId,
          boardPanelId: image.boardPanelId,
          filePath: image.filePath,
          publicUrl: image.publicUrl,
          fileName: image.fileName,
          fileSize: image.fileSize,
          mimeType: image.mimeType,
          prompt: image.prompt,
          strategy: image.strategy,
          style: image.style,
          variationIndex: image.variationIndex,
          createdAt: new Date(image.createdAt),
        })),
      });
    }

    if (snapshot.data.voiceSamples.length > 0) {
      await tx.voiceSample.createMany({
        data: snapshot.data.voiceSamples.map((sample) => ({
          id: sample.id,
          projectId,
          characterId: sample.characterId,
          assetPath: sample.assetPath,
          label: sample.label,
          voiceNotes: sample.voiceNotes,
          createdAt: new Date(sample.createdAt),
        })),
      });
    }

    if (snapshot.data.sceneGenerationConfigs.length > 0) {
      await tx.sceneGenerationConfig.createMany({
        data: snapshot.data.sceneGenerationConfigs.map((config) => ({
          id: config.id,
          projectId,
          name: config.name,
          isDefault: config.isDefault,
          systemPrompt: config.systemPrompt,
          stylePreset: config.stylePreset as never,
          colorMode: config.colorMode as never,
          defaultImageCount: config.defaultImageCount,
          allowMultiPage: config.allowMultiPage,
          metadataJson: config.metadataJson as Prisma.InputJsonValue,
          createdAt: new Date(config.createdAt),
          updatedAt: new Date(config.updatedAt),
        })),
      });
    }

    if (snapshot.data.tomes.length > 0) {
      await tx.tome.createMany({
        data: snapshot.data.tomes.map((tome) => ({
          id: tome.id,
          projectId,
          title: tome.title,
          slug: tome.slug,
          synopsis: tome.synopsis,
          status: tome.status as never,
          orderIndex: tome.orderIndex,
          createdAt: new Date(tome.createdAt),
          updatedAt: new Date(tome.updatedAt),
        })),
      });
    }

    if (snapshot.data.chapters.length > 0) {
      await tx.chapter.createMany({
        data: snapshot.data.chapters.map((chapter) => ({
          id: chapter.id,
          projectId,
          tomeId: chapter.tomeId,
          title: chapter.title,
          slug: chapter.slug,
          synopsis: chapter.synopsis,
          status: chapter.status as never,
          orderIndex: chapter.orderIndex,
          createdAt: new Date(chapter.createdAt),
          updatedAt: new Date(chapter.updatedAt),
        })),
      });
    }

    if (snapshot.data.scenes.length > 0) {
      await tx.scene.createMany({
        data: snapshot.data.scenes.map((scene) => ({
          id: scene.id,
          projectId,
          tomeId: scene.tomeId,
          chapterId: scene.chapterId,
          title: scene.title,
          slug: scene.slug,
          sceneType: scene.sceneType,
          location: scene.location,
          summary: scene.summary,
          content: scene.content,
          notes: scene.notes,
          charactersJson: scene.charactersJson as Prisma.InputJsonValue,
          tagsJson: scene.tagsJson as Prisma.InputJsonValue,
          metadataJson: scene.metadataJson as Prisma.InputJsonValue,
          status: scene.status as never,
          orderIndex: scene.orderIndex,
          createdAt: new Date(scene.createdAt),
          updatedAt: new Date(scene.updatedAt),
        })),
      });
    }

    if (snapshot.data.storyReferences.length > 0) {
      await tx.storyReference.createMany({
        data: snapshot.data.storyReferences.map((reference) => ({
          id: reference.id,
          projectId,
          sceneId: reference.sceneId,
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          createdAt: new Date(reference.createdAt),
        })),
      });
    }

    if (snapshot.data.assets.length > 0) {
      await tx.asset.createMany({
        data: snapshot.data.assets.map((asset) => ({
          id: asset.id,
          projectId,
          slug: asset.slug,
          name: asset.name,
          originalFilename: asset.originalFilename,
          mimeType: asset.mimeType,
          checksum: asset.checksum,
          sizeBytes: asset.sizeBytes,
          storagePath: asset.storagePath,
          description: asset.description,
          tagsJson: asset.tagsJson as Prisma.InputJsonValue,
          status: asset.status as never,
          createdAt: new Date(asset.createdAt),
          updatedAt: new Date(asset.updatedAt),
          archivedAt: asset.archivedAt ? new Date(asset.archivedAt) : null,
        })),
      });
    }

    if (snapshot.data.assetLinks.length > 0) {
      await tx.assetLink.createMany({
        data: snapshot.data.assetLinks.map((link) => ({
          id: link.id,
          projectId,
          assetId: link.assetId,
          targetKind: link.targetKind,
          targetId: link.targetId,
          note: link.note,
          createdAt: new Date(link.createdAt),
        })),
      });
    }
  });
}
