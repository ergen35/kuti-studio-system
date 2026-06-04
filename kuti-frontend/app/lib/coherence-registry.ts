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

const COHERENCE_RULE_KIND_MAP = new Map(
  COHERENCE_RULE_DEFINITIONS.map((definition) => [definition.kind, definition]),
);

export const DEFAULT_COHERENCE_RULES: Record<CoherenceRuleKey, boolean> =
  Object.fromEntries(
    COHERENCE_RULE_DEFINITIONS.map((definition) => [
      definition.key,
      definition.defaultEnabled,
    ]),
  ) as Record<CoherenceRuleKey, boolean>;

export type CoherenceTimelineAnchor = {
  slug: string;
  label: string;
  orderIndex: number;
  note: string;
};

export type CoherenceToneProfile = {
  requiredTags: string[];
  forbiddenTags: string[];
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

function isNullishSignalLiteral(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "undefined" || normalized === "null";
}

export function getCoherenceRuleDefinitionByKind(
  kind: string,
): CoherenceRuleDefinition | null {
  return COHERENCE_RULE_KIND_MAP.get(kind) ?? null;
}

export function getCoherenceRuleOrigin(kind: string): CoherenceRuleOrigin {
  return getCoherenceRuleDefinitionByKind(kind)?.origin ?? "scene";
}

export function getCoherenceRuleGroup(kind: string): CoherenceRuleGroup {
  return getCoherenceRuleDefinitionByKind(kind)?.group ?? "story";
}

export function normalizeSignalSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitMultiValueText(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeSignalSlug)
    .filter(Boolean);
}

export function parseTimelineAnchorsText(
  value: string,
): CoherenceTimelineAnchor[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawSlug = "", rawLabel = "", rawOrderIndex = "0", ...rest] = line
        .split("|")
        .map((part) => part.trim());
      if (
        isNullishSignalLiteral(rawSlug) ||
        isNullishSignalLiteral(rawLabel || rawSlug)
      ) {
        return null;
      }
      const slug = normalizeSignalSlug(rawSlug);
      const label = rawLabel || rawSlug;
      const orderIndex = Number(rawOrderIndex);
      const note = rest.join(" | ").trim();

      return {
        slug,
        label,
        orderIndex: Number.isFinite(orderIndex) ? Math.trunc(orderIndex) : 0,
        note,
      };
    })
    .filter(
      (anchor): anchor is CoherenceTimelineAnchor =>
        !!anchor && anchor.slug.length > 0 && anchor.label.length > 0,
    );
}

export function serializeTimelineAnchorsText(
  anchors: CoherenceTimelineAnchor[],
): string {
  return anchors
    .map((anchor) =>
      [anchor.slug, anchor.label, String(anchor.orderIndex), anchor.note]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n");
}

export function parseToneProfileText(
  requiredTagsText: string,
  forbiddenTagsText: string,
): CoherenceToneProfile {
  return {
    requiredTags: splitMultiValueText(requiredTagsText),
    forbiddenTags: splitMultiValueText(forbiddenTagsText),
  };
}

export function parseFactLinesText(value: string): CoherenceFact[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawKey = "", rawValue = "", rawScope = "project", ...rest] = line
        .split("|")
        .map((part) => part.trim());
      if (isNullishSignalLiteral(rawKey) || isNullishSignalLiteral(rawValue)) {
        return null;
      }
      const key = normalizeSignalSlug(rawKey);
      const factValue = normalizeSignalSlug(rawValue);
      const scopeValue = isNullishSignalLiteral(rawScope)
        ? "project"
        : rawScope;
      const scope =
        rest.length > 0 ? [scopeValue, ...rest].join(" | ").trim() : scopeValue;

      return {
        key,
        value: factValue,
        scope: scope || "project",
      };
    })
    .filter(
      (fact): fact is CoherenceFact =>
        !!fact && fact.key.length > 0 && fact.value.length > 0,
    );
}

export function serializeFactLinesText(facts: CoherenceFact[]): string {
  return facts
    .map((fact) =>
      [fact.key, fact.value, fact.scope].filter(Boolean).join(" | "),
    )
    .join("\n");
}
