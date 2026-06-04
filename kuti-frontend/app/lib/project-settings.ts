import type { ExportCreateInput, ProjectSettingsInput } from "~/lib/schemas";
import {
  parseFactLinesText,
  parseTimelineAnchorsText,
  parseToneProfileText,
  serializeFactLinesText,
  serializeTimelineAnchorsText,
} from "~/lib/coherence-registry";

type SettingsRecord = Record<string, unknown>;

const DEFAULT_PROJECT_SETTINGS: ProjectSettingsInput = {
  name: "",
  status: "draft",
  locations: "",
  coherenceRules: {
    orphanCharacter: true,
    brokenReference: true,
    emptyScene: true,
    locationConflict: true,
    timelineConflict: true,
    continuityBreak: true,
    toneBreak: true,
    impossibleFact: true,
  },
  coherenceSignals: {
    timelineAnchors: "",
    requiredToneTags: "",
    forbiddenToneTags: "",
    continuityFacts: "",
    impossibleFacts: "",
  },
  coherenceAutomation: {
    autoScanOnSave: true,
  },
  generation: {
    defaultModelKey: "",
    defaultMode: "separate",
  },
  preview: {
    readingDirection: "rtl",
    panelDensity: "comfortable",
  },
  versioning: {
    retainedVersionsPerBranch: 3,
  },
  exports: {
    defaultKind: "publication",
    defaultFormats: ["paged_images", "pdf"],
  },
  language: {
    preferredLocale: "fr",
  },
  assets: {
    archiveOnDelete: true,
    showUsageHints: true,
  },
};

const EXPORT_FORMATS = [
  "json",
  "tree",
  "zip",
  "paged_images",
  "pdf",
  "cbz",
  "epub",
] as const satisfies ExportCreateInput["formats"];

function readRecord(value: unknown): SettingsRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SettingsRecord)
    : {};
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function isNullishSignalLiteral(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "undefined" || normalized === "null";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function readStringArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const filtered = value.filter(
    (item): item is T =>
      typeof item === "string" && allowed.includes(item as T),
  );
  return filtered.length > 0 ? filtered : [...fallback];
}

function readTimelineAnchorsText(
  value: unknown,
  fallback = DEFAULT_PROJECT_SETTINGS.coherenceSignals.timelineAnchors,
): string {
  if (!Array.isArray(value)) return fallback;

  const lines = value
    .map((item) => {
      if (typeof item === "string") {
        const line = item.trim();
        return line.length > 0 && !isNullishSignalLiteral(line) ? line : "";
      }

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const anchor = readRecord(item);
        const slug = readString(anchor.slug);
        const label = readString(anchor.label) || slug;
        const orderIndex = Number(anchor.orderIndex);
        const rawNote = readString(anchor.note);
        const note = isNullishSignalLiteral(rawNote) ? "" : rawNote;

        if (
          !slug ||
          !label ||
          isNullishSignalLiteral(slug) ||
          isNullishSignalLiteral(label)
        ) {
          return "";
        }

        return serializeTimelineAnchorsText([
          {
            slug,
            label,
            orderIndex: Number.isFinite(orderIndex)
              ? Math.trunc(orderIndex)
              : 0,
            note,
          },
        ]);
      }

      return "";
    })
    .filter(Boolean);

  return lines.join("\n");
}

function readFactLinesText(
  value: unknown,
  fallback = DEFAULT_PROJECT_SETTINGS.coherenceSignals.continuityFacts,
): string {
  if (!Array.isArray(value)) return fallback;

  const lines = value
    .map((item) => {
      if (typeof item === "string") {
        const line = item.trim();
        return line.length > 0 && !isNullishSignalLiteral(line) ? line : "";
      }

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const fact = readRecord(item);
        const key = readString(fact.key);
        const factValue = readString(fact.value);
        const rawScope = readString(fact.scope, "project");
        const scope = isNullishSignalLiteral(rawScope) ? "project" : rawScope;

        if (
          !key ||
          !factValue ||
          isNullishSignalLiteral(key) ||
          isNullishSignalLiteral(factValue)
        ) {
          return "";
        }

        return serializeFactLinesText([
          {
            key,
            value: factValue,
            scope: scope || "project",
          },
        ]);
      }

      return "";
    })
    .filter(Boolean);

  return lines.join("\n");
}

function readDelimitedStringText(value: unknown, fallback = ""): string {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => readString(item))
    .filter((item) => item.length > 0 && !isNullishSignalLiteral(item));

  return items.length > 0 ? items.join(", ") : fallback;
}

export function readProjectSettings(
  settingsJson: unknown,
): ProjectSettingsInput {
  const settings = readRecord(settingsJson);
  const coherenceRules = readRecord(settings.coherenceRulesJson);
  const coherenceSignals = readRecord(settings.coherenceSignalsJson);
  const toneProfile = readRecord(coherenceSignals.toneProfileJson);
  const generation = readRecord(settings.generationSettingsJson);
  const preview = readRecord(settings.previewSettingsJson);
  const versioning = readRecord(settings.versioningSettingsJson);
  const exportsSettings = readRecord(settings.exportSettingsJson);
  const language = readRecord(settings.languageSettingsJson);
  const assets = readRecord(settings.assetSettingsJson);
  const coherenceAutomation = readRecord(settings.coherenceAutomationJson);

  return {
    name: "",
    status: "draft",
    locations: Array.isArray(settings.locationsJson)
      ? (settings.locationsJson as string[]).join(", ")
      : "",
    coherenceRules: {
      orphanCharacter: readBoolean(
        coherenceRules.orphanCharacter,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.orphanCharacter,
      ),
      brokenReference: readBoolean(
        coherenceRules.brokenReference,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.brokenReference,
      ),
      emptyScene: readBoolean(
        coherenceRules.emptyScene,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.emptyScene,
      ),
      locationConflict: readBoolean(
        coherenceRules.locationConflict,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.locationConflict,
      ),
      timelineConflict: readBoolean(
        coherenceRules.timelineConflict,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.timelineConflict,
      ),
      continuityBreak: readBoolean(
        coherenceRules.continuityBreak,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.continuityBreak,
      ),
      toneBreak: readBoolean(
        coherenceRules.toneBreak,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.toneBreak,
      ),
      impossibleFact: readBoolean(
        coherenceRules.impossibleFact,
        DEFAULT_PROJECT_SETTINGS.coherenceRules.impossibleFact,
      ),
    },
    coherenceSignals: {
      timelineAnchors: readTimelineAnchorsText(
        coherenceSignals.timelineAnchorsJson,
      ),
      requiredToneTags: readDelimitedStringText(
        toneProfile.requiredTagsJson,
        DEFAULT_PROJECT_SETTINGS.coherenceSignals.requiredToneTags,
      ),
      forbiddenToneTags: readDelimitedStringText(
        toneProfile.forbiddenTagsJson,
        DEFAULT_PROJECT_SETTINGS.coherenceSignals.forbiddenToneTags,
      ),
      continuityFacts: readFactLinesText(
        coherenceSignals.continuityFactsJson,
        DEFAULT_PROJECT_SETTINGS.coherenceSignals.continuityFacts,
      ),
      impossibleFacts: readFactLinesText(
        coherenceSignals.impossibleFactsJson,
        DEFAULT_PROJECT_SETTINGS.coherenceSignals.impossibleFacts,
      ),
    },
    coherenceAutomation: {
      autoScanOnSave: readBoolean(
        coherenceAutomation.autoScanOnSave,
        DEFAULT_PROJECT_SETTINGS.coherenceAutomation.autoScanOnSave,
      ),
    },
    generation: {
      defaultModelKey: readString(
        generation.defaultModelKey,
        DEFAULT_PROJECT_SETTINGS.generation.defaultModelKey,
      ),
      defaultMode: readEnum(
        readString(
          generation.defaultMode,
          DEFAULT_PROJECT_SETTINGS.generation.defaultMode,
        ),
        ["separate", "grid"],
        DEFAULT_PROJECT_SETTINGS.generation.defaultMode,
      ),
    },
    preview: {
      readingDirection: readEnum(
        readString(
          preview.readingDirection,
          DEFAULT_PROJECT_SETTINGS.preview.readingDirection,
        ),
        ["ltr", "rtl"],
        DEFAULT_PROJECT_SETTINGS.preview.readingDirection,
      ),
      panelDensity: readEnum(
        readString(
          preview.panelDensity,
          DEFAULT_PROJECT_SETTINGS.preview.panelDensity,
        ),
        ["comfortable", "compact"],
        DEFAULT_PROJECT_SETTINGS.preview.panelDensity,
      ),
    },
    versioning: {
      retainedVersionsPerBranch: Math.max(
        1,
        Math.min(
          12,
          Math.floor(
            readNumber(
              versioning.retainedVersionsPerBranch,
              DEFAULT_PROJECT_SETTINGS.versioning.retainedVersionsPerBranch,
            ),
          ),
        ),
      ),
    },
    exports: {
      defaultKind: readEnum(
        readString(
          exportsSettings.defaultKind,
          DEFAULT_PROJECT_SETTINGS.exports.defaultKind,
        ),
        ["work", "publication"],
        DEFAULT_PROJECT_SETTINGS.exports.defaultKind,
      ),
      defaultFormats: readStringArray(
        exportsSettings.defaultFormats,
        EXPORT_FORMATS,
        DEFAULT_PROJECT_SETTINGS.exports.defaultFormats,
      ),
    },
    language: {
      preferredLocale: readEnum(
        readString(
          language.preferredLocale,
          DEFAULT_PROJECT_SETTINGS.language.preferredLocale,
        ),
        ["en", "fr"],
        DEFAULT_PROJECT_SETTINGS.language.preferredLocale,
      ),
    },
    assets: {
      archiveOnDelete: readBoolean(
        assets.archiveOnDelete,
        DEFAULT_PROJECT_SETTINGS.assets.archiveOnDelete,
      ),
      showUsageHints: readBoolean(
        assets.showUsageHints,
        DEFAULT_PROJECT_SETTINGS.assets.showUsageHints,
      ),
    },
  };
}

export function composeProjectSettingsJson(
  existingSettingsJson: unknown,
  values: ProjectSettingsInput,
): SettingsRecord {
  const existing = readRecord(existingSettingsJson);
  const toneProfile = parseToneProfileText(
    values.coherenceSignals.requiredToneTags,
    values.coherenceSignals.forbiddenToneTags,
  );

  return {
    ...existing,
    locationsJson: values.locations
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
    coherenceRulesJson: values.coherenceRules,
    coherenceSignalsJson: {
      timelineAnchorsJson: parseTimelineAnchorsText(
        values.coherenceSignals.timelineAnchors,
      ),
      toneProfileJson: {
        requiredTagsJson: toneProfile.requiredTags,
        forbiddenTagsJson: toneProfile.forbiddenTags,
      },
      continuityFactsJson: parseFactLinesText(
        values.coherenceSignals.continuityFacts,
      ),
      impossibleFactsJson: parseFactLinesText(
        values.coherenceSignals.impossibleFacts,
      ),
    },
    coherenceAutomationJson: values.coherenceAutomation,
    generationSettingsJson: values.generation,
    previewSettingsJson: values.preview,
    versioningSettingsJson: values.versioning,
    exportSettingsJson: values.exports,
    languageSettingsJson: values.language,
    assetSettingsJson: values.assets,
  };
}

export function getDefaultProjectSettings(): ProjectSettingsInput {
  return JSON.parse(
    JSON.stringify(DEFAULT_PROJECT_SETTINGS),
  ) as ProjectSettingsInput;
}
