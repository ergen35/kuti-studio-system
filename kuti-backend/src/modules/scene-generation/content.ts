export function normalizeSceneContent(content: string | null | undefined): string {
  return typeof content === "string" ? content.trim() : "";
}

export type SceneContentBeatKind = "dialogue" | "thought" | "narration";

export type SceneContentBeat = {
  kind: SceneContentBeatKind;
  text: string;
  raw: string;
  promptLine: string;
  explicitPrefix: boolean;
};

function cleanSceneContentText(value: string): string {
  return value
    .replace(/^[-*•]\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function formatSceneContentBeatLine(kind: SceneContentBeatKind, text: string): string {
  const prefix = kind.toUpperCase();
  return text.length > 0 ? `${prefix}: ${text}` : `${prefix}:`;
}

function isCanonicalReference(value: string): boolean {
  return /@(?:chara|character):[^\s]+/i.test(value);
}

function isDialogueLike(value: string): boolean {
  return (
    /^@(?:chara|character):[^\s]+(?:\s+.+)?$/i.test(value) ||
    /^[A-ZÀ-ÖØ-Þ0-9 _'’.-]{2,}\s*[:：]\s*\S/.test(value) ||
    /^[-—]\s+\S/.test(value) ||
    /^[«"“”]/.test(value)
  );
}

function isThoughtLike(value: string): boolean {
  return /^(?:\(|（|\[|⟦).+(?:\)|）|\]|⟧)$/.test(value);
}

function isSoundOnly(value: string): boolean {
  return /^Son\s*[—:-]/i.test(value) || /^SFX\s*[—:-]/i.test(value);
}

function inferLegacyBeatKind(value: string): SceneContentBeatKind {
  if (isThoughtLike(value)) return "thought";
  if (isDialogueLike(value)) return "dialogue";
  return "narration";
}

function shouldKeepLegacyBeat(value: string, kind: SceneContentBeatKind): boolean {
  if (!value || isSoundOnly(value)) return false;
  if (isCanonicalReference(value)) return true;

  switch (kind) {
    case "dialogue":
    case "thought":
      return value.length >= 4;
    case "narration":
      return value.length >= 18;
  }
}

function splitLegacyNarration(value: string): string[] {
  const parts = value
    .split(/(?<=[.!?。！？])\s+/)
    .map(cleanSceneContentText)
    .filter((part) => part.length > 0);

  return parts.length > 1 ? parts : [value];
}

function parseSceneContentLine(value: string): SceneContentBeat[] {
  const explicitMatch = value.match(/^(dialogue|thought|narration)\s*[:：]\s*(.*)$/i);
  if (explicitMatch) {
    const kind = explicitMatch[1].toLowerCase() as SceneContentBeatKind;
    const text = cleanSceneContentText(explicitMatch[2] ?? "");
    return [
      {
        kind,
        text,
        raw: value,
        promptLine: formatSceneContentBeatLine(kind, text),
        explicitPrefix: true,
      },
    ];
  }

  const cleaned = cleanSceneContentText(value);
  if (!cleaned || isSoundOnly(cleaned)) return [];

  const kind = inferLegacyBeatKind(cleaned);
  const segments = kind === "narration" ? splitLegacyNarration(cleaned) : [cleaned];

  return segments
    .map((segment) => cleanSceneContentText(segment))
    .filter((segment) => shouldKeepLegacyBeat(segment, kind))
    .map((segment) => ({
      kind,
      text: segment,
      raw: value,
      promptLine: formatSceneContentBeatLine(kind, segment),
      explicitPrefix: false,
    }));
}

export function parseSceneContentBeats(
  content: string | null | undefined,
  fallbackTitle = "Scene",
): SceneContentBeat[] {
  const source = normalizeSceneContent(content);
  if (!source) {
    const fallbackText = `${fallbackTitle} - visual beat 1`;
    return [{
      kind: "narration",
      text: fallbackText,
      raw: fallbackText,
      promptLine: formatSceneContentBeatLine("narration", fallbackText),
      explicitPrefix: false,
    }];
  }

  const beats = source
    .split(/\n+/)
    .flatMap((line) => parseSceneContentLine(line.trim()))
    .filter((beat) => beat.text.length > 0 || beat.promptLine.length > 0);

  if (beats.length > 0) {
    return beats;
  }

  const fallbackText = `${fallbackTitle} - visual beat 1`;
  return [{
    kind: "narration",
    text: fallbackText,
    raw: fallbackText,
    promptLine: formatSceneContentBeatLine("narration", fallbackText),
    explicitPrefix: false,
  }];
}

export function hasSceneContent(content: string | null | undefined): boolean {
  return normalizeSceneContent(content).length > 0;
}

export function requireSceneContent(
  content: string | null | undefined,
  errorMessage = "Scene content is required before manga generation",
): string {
  const normalized = normalizeSceneContent(content);
  if (!normalized) {
    throw new Error(errorMessage);
  }

  return normalized;
}
