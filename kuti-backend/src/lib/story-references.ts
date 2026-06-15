import slugify from "slugify";
import { prisma } from "@lib/db";

export type StoryReferenceKind =
  | "character"
  | "scene"
  | "chapter"
  | "tome"
  | "asset"
  | "environment";

export type ParsedStoryReference = {
  referenceKind: StoryReferenceKind;
  targetSlug: string;
  rawToken: string;
};

type ReferenceSourceText = {
  content?: string | null;
};

const REFERENCE_KIND_ALIASES: Record<string, StoryReferenceKind> = {
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

const REFERENCE_DISPLAY_TOKENS: Record<StoryReferenceKind, string> = {
  character: "chara",
  scene: "scene",
  chapter: "chapter",
  tome: "tome",
  asset: "file",
  environment: "environment",
};

// Matches typed references without swallowing trailing punctuation.
const REFERENCE_TOKEN_PATTERN = /@([a-z][a-z0-9_-]*):([a-z0-9](?:[a-z0-9._/-]*[a-z0-9])?)/gi;

export function normalizeReferenceKind(value: string | null | undefined): StoryReferenceKind | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  return REFERENCE_KIND_ALIASES[normalized] ?? null;
}

export function getReferenceDisplayToken(kind: StoryReferenceKind): string {
  return REFERENCE_DISPLAY_TOKENS[kind];
}

export function buildReferenceToken(kind: StoryReferenceKind, slug: string): string {
  return `@${getReferenceDisplayToken(kind)}:${slug}`;
}

export function parseStoryReferencesFromText(text: string): ParsedStoryReference[] {
  if (!text) return [];

  const references: ParsedStoryReference[] = [];

  for (const match of text.matchAll(REFERENCE_TOKEN_PATTERN)) {
    const referenceKind = normalizeReferenceKind(match[1]);
    if (!referenceKind) continue;

    const targetSlug = normalizeReferenceSlug(match[2]);
    if (!targetSlug) continue;

    references.push({
      referenceKind,
      targetSlug,
      rawToken: match[0],
    });
  }

  return references;
}

export function parseSceneReferences(source: ReferenceSourceText): ParsedStoryReference[] {
  const seen = new Set<string>();
  const references: ParsedStoryReference[] = [];

  for (const reference of parseStoryReferencesFromText(source.content ?? "")) {
    const key = `${reference.referenceKind}::${reference.targetSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    references.push(reference);
  }

  return references;
}

export function extractCharacterSlugsFromText(text: string): string[] {
  const refs = parseStoryReferencesFromText(text);
  return [...new Set(
    refs
      .filter(r => r.referenceKind === "character")
      .map(r => r.targetSlug)
  )];
}

export async function syncSceneReferences(
  sceneId: string,
  projectId: string,
  source: ReferenceSourceText,
  client: any = prisma,
): Promise<ParsedStoryReference[]> {
  const references = parseSceneReferences(source);

  await client.storyReference.deleteMany({
    where: {
      projectId,
      sceneId,
    },
  });

  if (references.length > 0) {
    await client.storyReference.createMany({
      data: references.map((reference) => ({
        projectId,
        sceneId,
        referenceKind: reference.referenceKind,
        targetSlug: reference.targetSlug,
        rawToken: reference.rawToken,
      })),
    });
  }

  return references;
}

function normalizeReferenceSlug(value: string): string {
  return slugify(value.trim(), {
    lower: true,
    strict: true,
    replacement: "-",
  });
}
