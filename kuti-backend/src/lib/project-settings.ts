type SettingsRecord = Record<string, unknown>;

const DEFAULT_GENERATION_SETTINGS = {
  defaultModelKey: "",
  defaultMode: "separate" as const,
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

