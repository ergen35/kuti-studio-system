type TextLike = string | null | undefined;

type PromptSection = {
  title: string;
  lines: Array<string | null | undefined>;
};

export type PromptImageAnchor = {
  id?: string | null;
  fileName?: string | null;
  publicUrl?: string | null;
  prompt?: string | null;
  style?: string | null;
  strategy?: string | null;
  variationIndex?: number | null;
  kind?: string | null;
  isActive?: boolean | null;
};

export type PromptCharacterAnchor = {
  name: string;
  alias?: string | null;
  narrativeRole?: string | null;
  description?: string | null;
  physicalDescription?: string | null;
  personality?: string | null;
  narrativeArc?: string | null;
  keyTraitsJson?: unknown;
  colorPaletteJson?: unknown;
  costumeElementsJson?: unknown;
  tagsJson?: unknown;
  activeSheet?: PromptImageAnchor | null;
  selectedImage?: PromptImageAnchor | null;
};

export type PromptReferenceAnchor = {
  referenceKind: string;
  targetSlug: string;
  rawToken?: string | null;
  label?: string | null;
  resolvedLabel?: string | null;
  description?: string | null;
  isBroken?: boolean;
};

export type ScenePromptContext = {
  title: string;
  location?: string | null;
  content?: string | null;
  tomeTitle?: string | null;
  chapterTitle?: string | null;
};

export type ScenePromptStyle = {
  systemPrompt?: TextLike;
  stylePreset?: string | null;
  colorMode?: string | null;
  allowMultiPage?: boolean | null;
};

export type CharacterImagePromptInput = {
  character: {
    name: string;
    alias?: string | null;
    narrativeRole?: string | null;
    description?: string | null;
    physicalDescription?: string | null;
    personality?: string | null;
    narrativeArc?: string | null;
    keyTraitsJson?: unknown;
    colorPaletteJson?: unknown;
    costumeElementsJson?: unknown;
    tagsJson?: unknown;
  };
  kind: "character_sheet" | "free_image";
  strategy: string;
  style?: string | null;
  activeCharacterSheet?: PromptImageAnchor | null;
  referenceImage?: PromptImageAnchor | null;
  variationIndex: number;
  totalCount: number;
};

function normalizeText(value: TextLike): string {
  return value?.trim() ?? "";
}

function compactText(value: TextLike): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength = 320): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatStringArray(value: unknown): string | null {
  const items = normalizeStringArray(value);
  return items.length > 0 ? items.join(", ") : null;
}

function buildSection(section: PromptSection): string | null {
  const lines = section.lines.filter((line): line is string => Boolean(line && line.trim().length > 0));
  if (lines.length === 0) return null;

  return [
    section.title,
    ...lines.map((line) => `- ${line}`),
  ].join("\n");
}

function joinBlocks(blocks: Array<string | null | undefined>): string {
  return blocks.filter((block): block is string => Boolean(block && block.trim().length > 0)).join("\n\n");
}

function buildIdentityLines(character: CharacterImagePromptInput["character"]): string[] {
  return [
    `Character: ${character.name}`,
    character.alias ? `Alias: ${character.alias}` : null,
    character.narrativeRole ? `Narrative role: ${character.narrativeRole}` : null,
    character.description ? `Description: ${compactText(character.description)}` : null,
    character.physicalDescription ? `Physical appearance: ${compactText(character.physicalDescription)}` : null,
    character.personality ? `Personality cue: ${compactText(character.personality)}` : null,
    character.narrativeArc ? `Narrative arc: ${compactText(character.narrativeArc)}` : null,
    formatStringArray(character.keyTraitsJson) ? `Key traits: ${formatStringArray(character.keyTraitsJson)}` : null,
    formatStringArray(character.colorPaletteJson) ? `Color palette: ${formatStringArray(character.colorPaletteJson)}` : null,
    formatStringArray(character.costumeElementsJson) ? `Costume elements: ${formatStringArray(character.costumeElementsJson)}` : null,
    formatStringArray(character.tagsJson) ? `Tags: ${formatStringArray(character.tagsJson)}` : null,
  ].filter((line): line is string => Boolean(line));
}

function buildContinuityRulesLines(
  activeCharacterSheet?: PromptImageAnchor | null,
  referenceImage?: PromptImageAnchor | null,
): string[] {
  const lines = [
    "Preserve the character identity exactly.",
    "Keep the same face shape, hairstyle, age, body type, costume logic, signature colors and accessories.",
    "Do not redesign the character, simplify canonical details or invent new elements.",
  ];

  if (activeCharacterSheet) {
    const sheetSummary = activeCharacterSheet.prompt ? formatAnchorExcerpt(activeCharacterSheet.prompt) : "";
    lines.push("Use the active character sheet as the canonical visual source of truth.");
    if (sheetSummary) {
      lines.push(`Canonical sheet prompt anchor: ${sheetSummary}.`);
    }
  }

  if (referenceImage) {
    const referenceSummary = referenceImage.prompt
      ? formatAnchorExcerpt(referenceImage.prompt)
      : referenceImage.fileName
        ? formatAnchorExcerpt(referenceImage.fileName)
        : "";
    if (activeCharacterSheet) {
      lines.push(
        referenceSummary
          ? `Secondary reference image anchor: ${referenceSummary}. Use it only to reinforce likeness, never to override the active sheet.`
          : "Secondary reference image available. Use it only to reinforce likeness, never to override the active sheet.",
      );
    } else {
      lines.push(
        referenceSummary
          ? `Reference image anchor: ${referenceSummary}. Use it as a bootstrap reference, but normalize it into a conservative canonical identity.`
          : "Reference image available. Use it as a bootstrap reference, but normalize it into a conservative canonical identity.",
      );
    }
  }

  if (!activeCharacterSheet && !referenceImage) {
    lines.push("No active sheet is available; rely only on the textual character description and keep the design conservative.");
  }

  lines.push("No watermark, no subtitle text, no editorial overlay, no UI chrome and no unrelated characters.");

  return lines;
}

function buildRenderingLine(style?: string | null): string {
  return style
    ? `Rendering style: ${style}, high-quality manga/anime concept art, clean linework, stable anatomy, consistent facial proportions.`
    : "Rendering style: high-quality manga/anime concept art, clean linework, stable anatomy, consistent facial proportions.";
}

function formatAnchorExcerpt(value: string, maxLength = 420): string {
  return truncateText(compactText(value), maxLength).replace(/[.。！？!?]+$/u, "");
}

function formatSceneContentLines(content: string): string[] {
  const normalized = content.replace(/\r/g, "").trim();
  if (!normalized) return [];

  const lines = normalized
    .split(/\n+/)
    .map((line) => truncateText(line.trim().replace(/\s+/g, " "), 900))
    .filter((line) => line.length > 0);

  return lines.length > 0 ? lines : [truncateText(compactText(content), 2200)];
}

export function buildStyleDescription(stylePreset: string, colorMode: string): string {
  const styleDescriptions: Record<string, string> = {
    shonen: "Shonen manga style: dynamic action lines, energetic compositions, bold expressions",
    shojo: "Shojo manga style: elegant linework, emotional focus, decorative flourishes",
    seinen: "Seinen manga style: mature themes, detailed artwork, realistic proportions",
    generic: "Generic manga scene layout: clean lines, balanced composition, versatile pacing",
  };

  const colorDescriptions: Record<string, string> = {
    bw: "Black and white ink style with screentones",
    color: "Full color illustration",
    spot_color: "Black and white with selective color accents",
  };

  return `${styleDescriptions[stylePreset] || styleDescriptions.generic}. ${colorDescriptions[colorMode] || colorDescriptions.bw}.`;
}

export function buildSceneSystemPrompt(style: ScenePromptStyle): string {
  const basePrompt = normalizeText(style.systemPrompt) || "You are a professional manga storyboard artist.";

  return joinBlocks([
    basePrompt,
    buildSection({
      title: "Continuity rules",
      lines: [
        "Preserve character identity, costume, pose intent and staging across every panel.",
        "Treat the active character sheets as the visual source of truth and never redesign canonical characters.",
        "Keep the reading order clear and readable.",
        "Treat the scene content as canonical script text, not as prose summary.",
        "DIALOGUE: speech bubble with a pointer.",
        "THOUGHT: cloud-shaped bubble for internal monologue.",
        "NARRATION: small narration box in a corner of the panel.",
        "Never merge, paraphrase, summarize or convert one typed line into another type.",
        "Preserve any @chara:<slug> token exactly as written inside a typed line.",
        "Do not introduce new characters, props or locations unless they are explicitly present in the scene.",
        style.allowMultiPage ? "The scene may span multiple pages, but the visual continuity must stay consistent from page to page." : "Prefer a compact page if the scene can be told clearly without adding unnecessary pages.",
      ],
    }),
    buildSection({
      title: "Style rules",
      lines: [
        style.stylePreset ? `Style preset: ${style.stylePreset}.` : null,
        style.colorMode ? `Color mode: ${style.colorMode}.` : null,
        "Prioritize strong composition, clear spatial relationships and expressive acting.",
      ],
    }),
  ]);
}

function buildSceneContextBlock(context: ScenePromptContext): string {
  return joinBlocks([
    buildSection({
      title: "Scene context",
      lines: [
        `Story path: ${[context.tomeTitle, context.chapterTitle, context.title].filter(Boolean).join(" > ")}`,
        context.location ? `Location: ${compactText(context.location)}` : null,
      ],
    }),
    context.content
      ? buildSection({
          title: "Scene content",
          lines: formatSceneContentLines(context.content),
        })
      : null,
  ]);
}

function buildCharactersBlock(characters: PromptCharacterAnchor[]): string | null {
  if (characters.length === 0) return null;

  const blocks = characters.map((character) => {
    const lines = [
      `- ${character.name}${character.alias ? ` (${character.alias})` : ""}`,
      character.narrativeRole ? `  - Narrative role: ${character.narrativeRole}` : null,
      character.description ? `  - Description: ${truncateText(compactText(character.description), 220)}` : null,
      character.physicalDescription ? `  - Physical appearance: ${truncateText(compactText(character.physicalDescription), 220)}` : null,
      character.personality ? `  - Personality: ${truncateText(compactText(character.personality), 220)}` : null,
      character.narrativeArc ? `  - Narrative arc: ${truncateText(compactText(character.narrativeArc), 220)}` : null,
      formatStringArray(character.keyTraitsJson) ? `  - Key traits: ${formatStringArray(character.keyTraitsJson)}` : null,
      formatStringArray(character.colorPaletteJson) ? `  - Color palette: ${formatStringArray(character.colorPaletteJson)}` : null,
      formatStringArray(character.costumeElementsJson) ? `  - Costume elements: ${formatStringArray(character.costumeElementsJson)}` : null,
      formatStringArray(character.tagsJson) ? `  - Tags: ${formatStringArray(character.tagsJson)}` : null,
      character.activeSheet?.prompt ? `  - Canonical sheet anchor: ${formatAnchorExcerpt(character.activeSheet.prompt, 260)}.` : null,
      character.selectedImage?.prompt ? `  - Reference image anchor: ${formatAnchorExcerpt(character.selectedImage.prompt, 260)}.` : null,
    ].filter((line): line is string => Boolean(line));

    return lines.join("\n");
  });

  return ["Character continuity anchors", ...blocks].join("\n\n");
}

function buildReferencesBlock(references: PromptReferenceAnchor[]): string | null {
  if (references.length === 0) return null;

  return buildSection({
    title: "Reference anchors",
    lines: references.map((reference) => {
      const label = reference.resolvedLabel || reference.label || reference.targetSlug;
      const token = reference.rawToken ? `${reference.rawToken} -> ` : "";
      const brokenSuffix = reference.isBroken ? " [UNRESOLVED - do not invent]" : "";
      const description = reference.description ? ` (${reference.description})` : "";
      return `${token}${label}${description}${brokenSuffix}`;
    }),
  });
}

function buildPanelRulesBlock(panelIndex: number, panelCount: number, additionalContext?: TextLike): string {
  return joinBlocks([
    buildSection({
      title: "Panel rules",
      lines: [
        `Panel ${panelIndex + 1}/${panelCount}.`,
        "Show a single clear beat with strong visual focus.",
        "Preserve the exact character continuity anchors and keep costumes, hair, palette, body shape and accessories stable.",
        "Render DIALOGUE lines as speech balloons with pointers.",
        "Render THOUGHT lines as cloud-shaped balloons.",
        "Render NARRATION lines as small narration boxes in a corner.",
        "Never merge, paraphrase or convert a typed line into another visual container.",
        "Keep spatial relationships readable and avoid visual clutter.",
        "Do not add watermark text, UI chrome, unrelated captions, title cards or extra characters.",
      ],
    }),
    normalizeText(additionalContext)
      ? buildSection({
          title: "Additional direction",
          lines: [compactText(additionalContext)],
        })
      : null,
  ]);
}

export function selectActiveCharacterSheet(images: Array<PromptImageAnchor> | undefined | null): PromptImageAnchor | null {
  if (!images || images.length === 0) return null;

  return (
    images.find((image) => image.kind === "character_sheet" && image.isActive) ??
    images.find((image) => image.kind === "character_sheet") ??
    null
  );
}

export function buildCharacterImagePrompt({
  character,
  kind,
  strategy,
  style,
  activeCharacterSheet,
  referenceImage,
  variationIndex,
  totalCount,
}: CharacterImagePromptInput): string {
  const identityLines = buildIdentityLines(character);
  const continuityLines = buildContinuityRulesLines(activeCharacterSheet, referenceImage);

  const poseLine = kind === "character_sheet"
    ? null
    : strategy === "portrait"
      ? "Pose intent: head-and-shoulders portrait, frontal and iconic."
      : strategy === "full_body"
        ? "Pose intent: full-body standing illustration with clear silhouette."
        : strategy === "expression"
          ? "Pose intent: expressive close-up focused on the face and emotion."
          : strategy === "action"
            ? "Pose intent: dynamic action pose with readable motion and body mechanics."
            : "Pose intent: detailed character illustration with stable proportions.";

  const layoutLines = kind === "character_sheet"
    ? [
        "Layout requirements: front view, profile view, back view, expression lineup, costume breakdown, color key, and full-body reference poses.",
        "Use a clean neutral background and make the sheet useful as a canonical production reference.",
        "Keep every view consistent with the same character identity.",
      ]
    : [
        `Variation request: ${variationIndex + 1}/${totalCount}.`,
        "Create a new image variation without changing the canonical identity.",
        activeCharacterSheet
          ? `Active sheet anchor: ${truncateText(compactText(activeCharacterSheet.prompt ?? activeCharacterSheet.fileName ?? ""), 420)}`
          : referenceImage
            ? `Reference image anchor: ${truncateText(compactText(referenceImage.prompt ?? referenceImage.fileName ?? ""), 420)}. Use it as a bootstrap reference, but keep the design conservative.`
            : "No active sheet is available; rely only on the textual character description and keep the design conservative.",
        "The variation must stay faithful to the same silhouette, palette, costume and face geometry.",
      ];

  return joinBlocks([
    kind === "character_sheet"
      ? "Mission: create a canonical character design sheet for production continuity and downstream scene rendering."
      : "Mission: create a new free image variation for the same canonical character.",
    buildSection({ title: "Identity anchor", lines: identityLines }),
    buildSection({ title: "Continuity rules", lines: continuityLines }),
    buildSection({ title: kind === "character_sheet" ? "Sheet layout" : "Variation direction", lines: layoutLines }),
    poseLine,
    style ? `Style note: ${style}.` : null,
    buildRenderingLine(style),
  ]);
}

export function buildSceneStoryboardPrompt({
  style,
  context,
  characters,
  references,
  additionalContext,
}: {
  style: ScenePromptStyle;
  context: ScenePromptContext;
  characters: PromptCharacterAnchor[];
  references: PromptReferenceAnchor[];
  additionalContext?: TextLike;
}): string {
  return joinBlocks([
    buildSceneSystemPrompt(style),
    buildSection({
      title: "Mission",
      lines: [
        "Plan a manga storyboard from the validated scene.",
        "Use the canonical character sheets and resolved references as the visual ground truth for every page.",
        style.allowMultiPage
          ? "The storyboard may expand to multiple pages when needed, but the narrative flow and visual continuity must remain stable."
          : "Prefer the most compact readable structure that still preserves the scene beat.",
      ],
    }),
    buildSceneContextBlock(context),
    buildCharactersBlock(characters),
    buildReferencesBlock(references),
    normalizeText(additionalContext)
      ? buildSection({ title: "Additional context", lines: [compactText(additionalContext)] })
      : null,
    buildSection({
      title: "Storyboard output rules",
      lines: [
        "Preserve character identity and costume continuity across the whole board.",
        "Keep the bubble type faithful to the scene content: dialogue, thought and narration must stay distinct.",
        "Preserve the original order of typed lines from the scene content and do not rewrite them into summary beats.",
        "Maintain clear sequencing, staging and emotional progression.",
        "Do not invent new character designs or let the selected reference image override the canonical sheet.",
        "Do not invent new major plot beats, locations or characters that are not in the scene context.",
      ],
    }),
  ]);
}

export function buildScenePanelPrompt({
  style,
  context,
  characters,
  references,
  panelIndex,
  panelCount,
  beat,
  additionalContext,
}: {
  style: ScenePromptStyle;
  context: ScenePromptContext;
  characters: PromptCharacterAnchor[];
  references: PromptReferenceAnchor[];
  panelIndex: number;
  panelCount: number;
  beat: string;
  additionalContext?: TextLike;
}): string {
  return joinBlocks([
    buildSceneSystemPrompt(style),
    buildSection({
      title: "Mission",
      lines: [
        `Render panel ${panelIndex + 1}/${panelCount} from the storyboard.`,
        "Turn the beat into a readable manga composition with clear acting and spatial logic.",
        "Keep the panel faithful to the canonical character sheets and the resolved story references.",
      ],
    }),
    buildSceneContextBlock(context),
    buildSection({
      title: "Panel beat",
      lines: [compactText(beat)],
    }),
    buildCharactersBlock(characters),
    buildReferencesBlock(references),
    buildPanelRulesBlock(panelIndex, panelCount, additionalContext),
    style.stylePreset ? `Style preset: ${style.stylePreset}.` : null,
    style.colorMode ? `Color mode: ${style.colorMode}.` : null,
    "If the beat is typed, keep its exact line order and visual container faithful to the scene content.",
    "Final rendering: manga panel illustration, expressive, cinematic, high quality, no watermark, no UI chrome, no caption text, no title card and no extra annotations.",
  ]);
}
