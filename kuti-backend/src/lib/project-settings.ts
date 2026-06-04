type SettingsRecord = Record<string, unknown>;

const DEFAULT_GENERATION_SETTINGS = {
  defaultModelKey: "",
  defaultMode: "separate" as const,
};

const DEFAULT_VERSIONING_SETTINGS = {
  retainedVersionsPerBranch: 3,
};

const DEFAULT_ASSET_SETTINGS = {
  archiveOnDelete: true,
  showUsageHints: true,
};

function readRecord(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as SettingsRecord
    : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? value as T
    : fallback;
}

export function readProjectGenerationSettings(settingsJson: unknown) {
  const settings = readRecord(settingsJson);
  const generation = readRecord(settings.generationSettingsJson);

  return {
    defaultModelKey: readString(generation.defaultModelKey, DEFAULT_GENERATION_SETTINGS.defaultModelKey),
    defaultMode: readEnum(
      readString(generation.defaultMode, DEFAULT_GENERATION_SETTINGS.defaultMode),
      ["separate", "grid"],
      DEFAULT_GENERATION_SETTINGS.defaultMode,
    ),
  };
}

export function readProjectVersioningSettings(settingsJson: unknown) {
  const settings = readRecord(settingsJson);
  const versioning = readRecord(settings.versioningSettingsJson);

  return {
    retainedVersionsPerBranch: Math.max(
      1,
      Math.min(
        12,
        Math.floor(readNumber(versioning.retainedVersionsPerBranch, DEFAULT_VERSIONING_SETTINGS.retainedVersionsPerBranch)),
      ),
    ),
  };
}

export function readProjectAssetSettings(settingsJson: unknown) {
  const settings = readRecord(settingsJson);
  const assets = readRecord(settings.assetSettingsJson);

  return {
    archiveOnDelete: typeof assets.archiveOnDelete === "boolean"
      ? assets.archiveOnDelete
      : DEFAULT_ASSET_SETTINGS.archiveOnDelete,
    showUsageHints: typeof assets.showUsageHints === "boolean"
      ? assets.showUsageHints
      : DEFAULT_ASSET_SETTINGS.showUsageHints,
  };
}
