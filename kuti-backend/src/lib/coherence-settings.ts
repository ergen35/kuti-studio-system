import slugify from "slugify";

export type CoherenceRuleKey =
  | "orphanCharacter"
  | "brokenReference"
  | "emptyScene"
  | "locationConflict"
  | "timelineConflict"
  | "continuityBreak"
  | "toneBreak"
  | "impossibleFact";

export type CoherenceRuleOrigin = "project" | "scene" | "reference" | "story";

export type CoherenceRuleGroup =
  | "characters"
  | "references"
  | "story"
  | "continuity";

export type CoherenceRuleDefinition = {
  key: CoherenceRuleKey;
  kind: string;
  group: CoherenceRuleGroup;
  origin: CoherenceRuleOrigin;
  titleKey: string;
  descriptionKey: string;
  defaultEnabled: boolean;
};

export const COHERENCE_RULE_DEFINITIONS: CoherenceRuleDefinition[] = [
  {
    key: "orphanCharacter",
    kind: "orphan_character",
    group: "characters",
    origin: "project",
    titleKey: "coherence.rules.orphanCharacter.label",
    descriptionKey: "coherence.rules.orphanCharacter.description",
    defaultEnabled: true,
  },
  {
    key: "brokenReference",
    kind: "broken_reference",
    group: "references",
    origin: "reference",
    titleKey: "coherence.rules.brokenReference.label",
    descriptionKey: "coherence.rules.brokenReference.description",
    defaultEnabled: true,
  },
  {
    key: "emptyScene",
    kind: "empty_scene",
    group: "story",
    origin: "scene",
    titleKey: "coherence.rules.emptyScene.label",
    descriptionKey: "coherence.rules.emptyScene.description",
    defaultEnabled: true,
  },
  {
    key: "locationConflict",
    kind: "location_conflict",
    group: "story",
    origin: "scene",
    titleKey: "coherence.rules.locationConflict.label",
    descriptionKey: "coherence.rules.locationConflict.description",
    defaultEnabled: true,
  },
  {
    key: "timelineConflict",
    kind: "timeline_conflict",
    group: "story",
    origin: "scene",
    titleKey: "coherence.rules.timelineConflict.label",
    descriptionKey: "coherence.rules.timelineConflict.description",
    defaultEnabled: true,
  },
  {
    key: "continuityBreak",
    kind: "continuity_break",
    group: "continuity",
    origin: "scene",
    titleKey: "coherence.rules.continuityBreak.label",
    descriptionKey: "coherence.rules.continuityBreak.description",
    defaultEnabled: true,
  },
  {
    key: "toneBreak",
    kind: "tone_break",
    group: "continuity",
    origin: "scene",
    titleKey: "coherence.rules.toneBreak.label",
    descriptionKey: "coherence.rules.toneBreak.description",
    defaultEnabled: true,
  },
  {
    key: "impossibleFact",
    kind: "impossible_fact",
    group: "continuity",
    origin: "scene",
    titleKey: "coherence.rules.impossibleFact.label",
    descriptionKey: "coherence.rules.impossibleFact.description",
    defaultEnabled: true,
  },
];

export const DEFAULT_COHERENCE_RULES: Record<CoherenceRuleKey, boolean> =
  Object.fromEntries(
    COHERENCE_RULE_DEFINITIONS.map((definition) => [definition.key, definition.defaultEnabled]),
  ) as Record<CoherenceRuleKey, boolean>;

const COHERENCE_RULE_KIND_MAP = new Map(
  COHERENCE_RULE_DEFINITIONS.map((definition) => [definition.kind, definition]),
);

export function getCoherenceRuleDefinitionByKind(kind: string): CoherenceRuleDefinition | null {
  return COHERENCE_RULE_KIND_MAP.get(kind) ?? null;
}

export function isCoherenceRuleEnabled(rules: Record<CoherenceRuleKey, boolean>, kind: string): boolean {
  const definition = getCoherenceRuleDefinitionByKind(kind);
  return definition ? rules[definition.key] : true;
}

export type CoherenceToneProfile = {
  requiredTags: string[];
  forbiddenTags: string[];
};

export type CoherenceTimelineAnchor = {
  slug: string;
  label: string;
  orderIndex: number;
  note: string;
};

export type CoherenceFact = {
  key: string;
  value: string;
  scope: string;
};

export type CoherenceSignals = {
  timelineAnchors: CoherenceTimelineAnchor[];
  toneProfile: CoherenceToneProfile;
  continuityFacts: CoherenceFact[];
  impossibleFacts: CoherenceFact[];
};

export type CoherenceAutomation = {
  autoScanOnSave: boolean;
};

export const DEFAULT_COHERENCE_SIGNALS: CoherenceSignals = {
  timelineAnchors: [],
  toneProfile: {
    requiredTags: [],
    forbiddenTags: [],
  },
  continuityFacts: [],
  impossibleFacts: [],
};

export const DEFAULT_COHERENCE_AUTOMATION: CoherenceAutomation = {
  autoScanOnSave: false,
};

export type CoherenceSignalTokenKind = "timeline" | "continuity" | "tone" | "fact";

export type CoherenceSignalToken = {
  kind: CoherenceSignalTokenKind;
  rawToken: string;
  payload: string;
  key: string;
  value: string;
};

function readSettingsRecord(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isNullishSignalLiteral(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "undefined" || normalized === "null";
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => readString(item))
    .filter((item) => Boolean(item) && !isNullishSignalLiteral(item));
}

function readTimelineAnchorEntry(value: unknown): CoherenceTimelineAnchor | null {
  if (typeof value === "string") {
    const line = value.trim();
    if (!line || isNullishSignalLiteral(line)) {
      return null;
    }

    const [rawSlug = "", rawLabel = "", rawOrderIndex = "0", ...rest] = line
      .split("|")
      .map((part) => part.trim());

    const slug = normalizeSignalSlug(rawSlug);
    const label = rawLabel || rawSlug;
    const orderIndex = Number(rawOrderIndex);
    const note = rest.join(" | ").trim();

    if (
      !slug ||
      !label ||
      isNullishSignalLiteral(rawSlug) ||
      isNullishSignalLiteral(label)
    ) {
      return null;
    }

    return {
      slug,
      label,
      orderIndex: Number.isFinite(orderIndex) ? Math.trunc(orderIndex) : 0,
      note,
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const anchor = value as Record<string, unknown>;
    const slug = normalizeSignalSlug(readString(anchor.slug));
    const label = readString(anchor.label) || readString(anchor.slug);
    const orderIndex = Number(anchor.orderIndex);
    const rawNote = readString(anchor.note);
    const note = isNullishSignalLiteral(rawNote) ? "" : rawNote;

    if (!slug || !label || isNullishSignalLiteral(label)) {
      return null;
    }

    return {
      slug,
      label,
      orderIndex: Number.isFinite(orderIndex) ? Math.trunc(orderIndex) : 0,
      note,
    };
  }

  return null;
}

function readFactEntry(value: unknown): CoherenceFact | null {
  if (typeof value === "string") {
    const line = value.trim();
    if (!line || isNullishSignalLiteral(line)) {
      return null;
    }

    const [rawKey = "", rawValue = "", rawScope = "project", ...rest] = line
      .split("|")
      .map((part) => part.trim());

    const key = normalizeSignalSlug(rawKey);
    const factValue = normalizeSignalSlug(rawValue);
    const scopeValue = isNullishSignalLiteral(rawScope) ? "project" : rawScope;
    const scope =
      rest.length > 0 ? [scopeValue, ...rest].join(" | ").trim() : scopeValue;

    if (!key || !factValue || isNullishSignalLiteral(rawKey) || isNullishSignalLiteral(rawValue)) {
      return null;
    }

    return {
      key,
      value: factValue,
      scope: scope || "project",
    };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const fact = value as Record<string, unknown>;
    const key = normalizeSignalSlug(readString(fact.key));
    const factValue = normalizeSignalSlug(readString(fact.value));
    const rawScope = readString(fact.scope);
    const scope = isNullishSignalLiteral(rawScope) ? "project" : rawScope || "project";

    if (
      !key ||
      !factValue ||
      isNullishSignalLiteral(readString(fact.key)) ||
      isNullishSignalLiteral(readString(fact.value))
    ) {
      return null;
    }

    return {
      key,
      value: factValue,
      scope,
    };
  }

  return null;
}

export function normalizeSignalSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, replacement: "-" });
}

export function readCoherenceRules(settingsJson: unknown): Record<CoherenceRuleKey, boolean> {
  const settings = readSettingsRecord(settingsJson);
  const rawRules = readSettingsRecord(settings.coherenceRulesJson);

  return {
    orphanCharacter: typeof rawRules.orphanCharacter === "boolean"
      ? rawRules.orphanCharacter
      : DEFAULT_COHERENCE_RULES.orphanCharacter,
    brokenReference: typeof rawRules.brokenReference === "boolean"
      ? rawRules.brokenReference
      : DEFAULT_COHERENCE_RULES.brokenReference,
    emptyScene: typeof rawRules.emptyScene === "boolean"
      ? rawRules.emptyScene
      : DEFAULT_COHERENCE_RULES.emptyScene,
    locationConflict: typeof rawRules.locationConflict === "boolean"
      ? rawRules.locationConflict
      : DEFAULT_COHERENCE_RULES.locationConflict,
    timelineConflict: typeof rawRules.timelineConflict === "boolean"
      ? rawRules.timelineConflict
      : DEFAULT_COHERENCE_RULES.timelineConflict,
    continuityBreak: typeof rawRules.continuityBreak === "boolean"
      ? rawRules.continuityBreak
      : DEFAULT_COHERENCE_RULES.continuityBreak,
    toneBreak: typeof rawRules.toneBreak === "boolean"
      ? rawRules.toneBreak
      : DEFAULT_COHERENCE_RULES.toneBreak,
    impossibleFact: typeof rawRules.impossibleFact === "boolean"
      ? rawRules.impossibleFact
      : DEFAULT_COHERENCE_RULES.impossibleFact,
  };
}

function readTimelineAnchors(value: unknown): CoherenceTimelineAnchor[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((anchor) => readTimelineAnchorEntry(anchor))
    .filter((anchor): anchor is CoherenceTimelineAnchor => !!anchor);
}

function readFacts(value: unknown): CoherenceFact[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((fact) => readFactEntry(fact))
    .filter((fact): fact is CoherenceFact => !!fact);
}

function readToneProfile(value: unknown): CoherenceToneProfile {
  const settings = readSettingsRecord(value);

  return {
    requiredTags: readStringList(settings.requiredTagsJson).map(normalizeSignalSlug).filter(Boolean),
    forbiddenTags: readStringList(settings.forbiddenTagsJson).map(normalizeSignalSlug).filter(Boolean),
  };
}

export function readCoherenceSignals(settingsJson: unknown): CoherenceSignals {
  const settings = readSettingsRecord(settingsJson);
  const rawSignals = readSettingsRecord(settings.coherenceSignalsJson);

  return {
    timelineAnchors: readTimelineAnchors(rawSignals.timelineAnchorsJson),
    toneProfile: readToneProfile(rawSignals.toneProfileJson),
    continuityFacts: readFacts(rawSignals.continuityFactsJson),
    impossibleFacts: readFacts(rawSignals.impossibleFactsJson),
  };
}

export function readCoherenceAutomation(settingsJson: unknown): CoherenceAutomation {
  const settings = readSettingsRecord(settingsJson);
  const rawAutomation = readSettingsRecord(settings.coherenceAutomationJson);

  return {
    autoScanOnSave: typeof rawAutomation.autoScanOnSave === "boolean"
      ? rawAutomation.autoScanOnSave
      : DEFAULT_COHERENCE_AUTOMATION.autoScanOnSave,
  };
}

export function parseSignalTokens(texts: Array<string | null | undefined>): CoherenceSignalToken[] {
  const tokens: CoherenceSignalToken[] = [];
  const pattern = /@(?<kind>timeline|continuity|tone|fact):(?<payload>[^\s@]+)/gi;

  for (const text of texts) {
    if (!text) continue;

    for (const match of text.matchAll(pattern)) {
      const kind = match.groups?.kind?.toLowerCase() as CoherenceSignalTokenKind | undefined;
      const payload = match.groups?.payload?.trim() ?? "";

      if (!kind || !payload) continue;

      if (kind === "timeline" || kind === "tone") {
        const value = normalizeSignalSlug(payload);
        if (!value) continue;

        tokens.push({
          kind,
          rawToken: match[0],
          payload,
          key: value,
          value,
        });
        continue;
      }

      const [rawKey = "", ...rawValueParts] = payload.split("=");
      const key = normalizeSignalSlug(rawKey);
      const value = normalizeSignalSlug(rawValueParts.join("=") || "");

      if (!key || !value) continue;

      tokens.push({
        kind,
        rawToken: match[0],
        payload,
        key,
        value,
      });
    }
  }

  return tokens;
}

export function normalizeSceneTags(tagsJson: unknown): string[] {
  return readStringList(Array.isArray(tagsJson) ? tagsJson : []);
}

export function buildToneTagSet(tagsJson: unknown, signalTokens: CoherenceSignalToken[]): Set<string> {
  const tags = normalizeSceneTags(tagsJson).map(normalizeSignalSlug);
  for (const token of signalTokens) {
    if (token.kind === "tone") {
      tags.push(token.value);
    }
  }

  return new Set(tags.filter(Boolean));
}

export function buildContinuityFactMap(facts: CoherenceFact[]): Map<string, CoherenceFact> {
  return new Map(facts.map((fact) => [fact.key, fact]));
}

export function buildImpossibleFactMap(facts: CoherenceFact[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const fact of facts) {
    const values = map.get(fact.key) ?? new Set<string>();
    values.add(normalizeSignalSlug(fact.value));
    map.set(fact.key, values);
  }

  return map;
}
