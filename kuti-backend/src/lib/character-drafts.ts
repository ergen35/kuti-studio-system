import { config } from "./config";

export type CharacterDraftInput = {
  name: string;
  narrativeRole?: string | null;
  descriptionMinimal: string;
  modelKey?: string;
};

export type CharacterDraft = {
  description: string;
  physicalDescription: string;
  keyTraitsJson: string[];
  colorPaletteJson: string[];
  costumeElementsJson: string[];
  personality: string;
  tagsJson: string[];
  sourceModelKey: string | null;
  usedFallback: boolean;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "with",
  "for",
  "in",
  "on",
  "at",
  "from",
  "by",
  "de",
  "la",
  "le",
  "les",
  "des",
  "du",
  "un",
  "une",
  "et",
  "ou",
]);

function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .slice(0, 8);
}

function extractKeywords(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

  return Array.from(new Set(tokens)).slice(0, 6);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function colorPaletteFromKeywords(keywords: string[]): string[] {
  const source = keywords.join(" ");

  if (/night|shadow|dark|void|midnight/.test(source)) {
    return ["#101828", "#334155", "#7c3aed"];
  }

  if (/fire|ember|sun|gold|radiant/.test(source)) {
    return ["#b45309", "#f59e0b", "#fef3c7"];
  }

  if (/sea|water|ice|frost|rain/.test(source)) {
    return ["#0f172a", "#0ea5e9", "#dbeafe"];
  }

  if (/forest|leaf|earth|nature|wood/.test(source)) {
    return ["#14532d", "#16a34a", "#dcfce7"];
  }

  return ["#1f2937", "#64748b", "#e2e8f0"];
}

function costumeFromKeywords(keywords: string[]): string[] {
  const source = keywords.join(" ");
  const items: string[] = [];

  if (/armor|knight|soldier|warrior/.test(source)) {
    items.push("layered combat armor", "utility straps", "battle-worn details");
  } else if (/mage|wizard|spell|witch|sorcer/.test(source)) {
    items.push("ritual garment", "sigil accessories", "arcane fabric layers");
  } else if (/detective|investigator|spy|agent/.test(source)) {
    items.push("tailored coat", "hidden pockets", "practical footwear");
  } else if (/royal|noble|court|princess|prince/.test(source)) {
    items.push("regal trim", "ceremonial layers", "ornamental jewelry");
  } else {
    items.push("signature silhouette", "distinctive accessory", "story-specific layering");
  }

  return items.slice(0, 4);
}

function traitsFromKeywords(keywords: string[], role?: string | null): string[] {
  const traits = [...keywords.map(titleCase)];

  if (role) {
    traits.unshift(titleCase(role.replace(/[-_]+/g, " ")));
  }

  while (traits.length < 3) {
    traits.push("Memorable");
  }

  return Array.from(new Set(traits)).slice(0, 5);
}

function buildFallbackDraft(input: CharacterDraftInput): CharacterDraft {
  const descriptionMinimal = input.descriptionMinimal.trim();
  const keywords = extractKeywords(descriptionMinimal);
  const roleText = input.narrativeRole?.trim() || null;

  return {
    description: `${input.name} is a character shaped by ${descriptionMinimal}`.trim(),
    physicalDescription: descriptionMinimal
      ? `A visually distinct figure with cues from: ${descriptionMinimal}`
      : "A visually distinct figure with a strong silhouette and readable accessories.",
    keyTraitsJson: traitsFromKeywords(keywords, roleText),
    colorPaletteJson: colorPaletteFromKeywords(keywords),
    costumeElementsJson: costumeFromKeywords(keywords),
    personality: descriptionMinimal
      ? `Grounded, expressive, and driven by ${descriptionMinimal}.`
      : "Grounded, expressive, and easy to stage in dramatic scenes.",
    tagsJson: Array.from(
      new Set([
        ...keywords,
        ...(roleText ? [roleText.toLowerCase().replace(/\s+/g, "-")] : []),
        input.name.toLowerCase().replace(/\s+/g, "-"),
      ]),
    ).slice(0, 8),
    sourceModelKey: null,
    usedFallback: true,
  };
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function readStringField(
  value: unknown,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseDraftPayload(payload: unknown): Partial<CharacterDraft> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const obj = payload as Record<string, unknown>;
  const draft = obj.draft ?? obj.data ?? obj.result ?? obj.character;
  const sourceModelKey = typeof obj.model === "string"
    ? obj.model
    : typeof obj.modelKey === "string"
      ? obj.modelKey
      : null;

  if (draft && typeof draft === "object") {
    const draftRecord = draft as Record<string, unknown>;

    return {
      description: readStringField(draftRecord.description),
      physicalDescription: readStringField(draftRecord.physicalDescription),
      keyTraitsJson: normalizeList(draftRecord.keyTraitsJson),
      colorPaletteJson: normalizeList(draftRecord.colorPaletteJson),
      costumeElementsJson: normalizeList(draftRecord.costumeElementsJson),
      personality: readStringField(draftRecord.personality),
      tagsJson: normalizeList(draftRecord.tagsJson),
      sourceModelKey,
      usedFallback: false,
    };
  }

  if (typeof obj.text === "string") {
    const parsed = extractJsonObject(obj.text);
    if (parsed && typeof parsed === "object") {
      return parseDraftPayload(parsed);
    }
  }

  return null;
}

async function requestDraftFromProvider(input: CharacterDraftInput): Promise<CharacterDraft | null> {
  if (!config.storyCompletionEnabled || !config.storyCompletionEndpoint || !config.storyCompletionApiKey) {
    return null;
  }

  const modelKey = input.modelKey || config.storyCompletionDefaultModel;
  if (!config.storyCompletionModels.includes(modelKey)) {
    return null;
  }

  const prompt = [
    "Tu es l'assistant de conception de personnages de Kuti Studio.",
    "Retourne uniquement un JSON strict sans markdown ni explication.",
    "Le JSON doit contenir exactement les clés: description, physicalDescription, keyTraitsJson, colorPaletteJson, costumeElementsJson, personality, tagsJson.",
    "Les champs keyTraitsJson, colorPaletteJson, costumeElementsJson et tagsJson doivent etre des tableaux de chaines courtes.",
    "La description doit etre un paragraphe editorial exploitable.",
    "La physicalDescription doit etre precise et visuelle.",
    "La personality doit etre breve mais exploitable.",
    "Contexte:",
    JSON.stringify({
      name: input.name,
      narrativeRole: input.narrativeRole ?? null,
      descriptionMinimal: input.descriptionMinimal,
    }, null, 2),
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(config.storyCompletionEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.storyCompletionApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: modelKey,
        messages: [
          {
            role: "system",
            content: "Tu generes des brouillons de personnages pour un studio narratif local-first.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const parsed = parseDraftPayload(await response.json());
    if (!parsed) {
      return null;
    }

    return {
      description: parsed.description?.trim() || buildFallbackDraft(input).description,
      physicalDescription: parsed.physicalDescription?.trim() || buildFallbackDraft(input).physicalDescription,
      keyTraitsJson: normalizeList(parsed.keyTraitsJson),
      colorPaletteJson: normalizeList(parsed.colorPaletteJson),
      costumeElementsJson: normalizeList(parsed.costumeElementsJson),
      personality: parsed.personality?.trim() || buildFallbackDraft(input).personality,
      tagsJson: normalizeList(parsed.tagsJson),
      sourceModelKey: parsed.sourceModelKey ?? modelKey,
      usedFallback: false,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function generateCharacterDraft(input: CharacterDraftInput): Promise<CharacterDraft> {
  const providerDraft = await requestDraftFromProvider(input);
  if (providerDraft) {
    return providerDraft;
  }

  return buildFallbackDraft(input);
}
