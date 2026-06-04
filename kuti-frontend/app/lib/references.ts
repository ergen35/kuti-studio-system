import { createLinkMatcherWithRegExp, type LinkMatcher } from "@lexical/link";

export type ReferenceKind =
  | "character"
  | "scene"
  | "chapter"
  | "tome"
  | "asset"
  | "environment";

export type ReferenceUrlResolver = (
  kind: ReferenceKind,
  slug: string,
) => string | null;

export type ReferenceOption = {
  kind: ReferenceKind;
  syntax: string;
  label: string;
  description: string;
  aliases: string[];
};

const KIND_ALIASES: Record<string, ReferenceKind> = {
  chara: "character",
  character: "character",
  scene: "scene",
  chapter: "chapter",
  tome: "tome",
  file: "asset",
  asset: "asset",
  environment: "environment",
  location: "environment",
};

const DISPLAY_SYNTAX: Record<ReferenceKind, string> = {
  character: "chara",
  scene: "scene",
  chapter: "chapter",
  tome: "tome",
  asset: "file",
  environment: "environment",
};

export const REFERENCE_OPTIONS: ReferenceOption[] = [
  {
    kind: "character",
    syntax: "@chara:",
    label: "Personnage",
    description: "Référence une fiche personnage.",
    aliases: ["@character:"],
  },
  {
    kind: "scene",
    syntax: "@scene:",
    label: "Scène",
    description: "Référence une autre scène du projet.",
    aliases: [],
  },
  {
    kind: "chapter",
    syntax: "@chapter:",
    label: "Chapitre",
    description: "Référence un chapitre existant.",
    aliases: [],
  },
  {
    kind: "tome",
    syntax: "@tome:",
    label: "Tome",
    description: "Référence un tome du projet.",
    aliases: [],
  },
  {
    kind: "asset",
    syntax: "@file:",
    label: "Fichier",
    description: "Référence un asset de la bibliothèque.",
    aliases: ["@asset:"],
  },
  {
    kind: "environment",
    syntax: "@environment:",
    label: "Lieu",
    description: "Référence un lieu défini dans les settings.",
    aliases: ["@location:"],
  },
];

const REFERENCE_TOKEN_PATTERN =
  /@([a-z][a-z0-9_-]*):([a-z0-9](?:[a-z0-9._/-]*[a-z0-9])?)/gi;

export function normalizeReferenceKind(
  value: string | null | undefined,
): ReferenceKind | null {
  if (!value) return null;
  return KIND_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function getReferenceSyntax(kind: ReferenceKind): string {
  return `@${DISPLAY_SYNTAX[kind]}:`;
}

export function buildReferenceToken(kind: ReferenceKind, slug: string): string {
  return `${getReferenceSyntax(kind)}${slug}`;
}

export function normalizeReferenceSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseReferenceQuery(rawQuery: string | null): {
  rawQuery: string;
  kindPart: string;
  search: string;
  kind: ReferenceKind | null;
  isEntityQuery: boolean;
} {
  const raw = (rawQuery ?? "").trim();
  const [rawKindPart = "", ...rest] = raw.split(":");
  const kindPart = rawKindPart.replace(/^@/, "");
  const search = rest.join(":").trim();
  const kind = normalizeReferenceKind(kindPart);

  return {
    rawQuery: raw,
    kindPart,
    search,
    kind,
    isEntityQuery: raw.includes(":"),
  };
}

export function createReferenceLinkMatcher(
  resolveUrl: ReferenceUrlResolver,
): LinkMatcher {
  return (text) => {
    for (const match of text.matchAll(REFERENCE_TOKEN_PATTERN)) {
      const kind = normalizeReferenceKind(match[1]);
      if (!kind) continue;

      const url = resolveUrl(kind, match[2]);
      if (!url) continue;

      return {
        index: match.index ?? 0,
        length: match[0].length,
        text: match[0],
        url,
      };
    }

    return null;
  };
}

export function matchReferenceOption(
  filter: string,
  option: ReferenceOption,
): boolean {
  if (!filter) return true;

  const query = filter.toLowerCase();
  return [option.syntax, option.label, ...option.aliases].some((value) =>
    value.toLowerCase().includes(query),
  );
}

export function filterReferenceOptions(filter: string): ReferenceOption[] {
  return REFERENCE_OPTIONS.filter((option) =>
    matchReferenceOption(filter, option),
  );
}
