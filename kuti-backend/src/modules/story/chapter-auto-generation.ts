import { randomUUIDv7 } from "bun";
import slugify from "slugify";
import { config } from "@lib/config";
import { prisma } from "@lib/db";
import type { Prisma } from "@lib/db/generated/client";
import { getStoryCompletionModels } from "@lib/story-completion";
import { normalizeReferenceKind, parseStoryReferencesFromText, type ParsedStoryReference } from "@lib/story-references";
import { syncSceneReferences } from "@lib/story-references";

type TextLike = string | null | undefined;

export type ChapterSceneGenerationReference = {
  referenceKind: string;
  targetSlug: string;
  rawToken: string;
  resolvedLabel: string | null;
  description: string;
  isBroken: boolean;
};

export type ChapterSceneGenerationPromptInput = {
  chapterTitle: string;
  tomeTitle?: string | null;
  chapterSummary: string;
  sceneCount: number;
  references: ChapterSceneGenerationReference[];
};

export type ChapterSceneDraft = {
  title: string;
  content: string;
  sceneType: string;
  location: string;
  charactersJson: string[];
  tagsJson: string[];
  metadataJson: Record<string, unknown>;
};

export type GeneratedChapterScenes = {
  scenes: ChapterSceneDraft[];
};

export type PersistedChapterScenesResult = {
  chapterId: string;
  tomeId: string;
  deletedSceneIds: string[];
  deletedPageIds: string[];
  createdSceneIds: string[];
};

export class ChapterSceneGenerationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "generation_disabled"
      | "generation_missing_configuration"
      | "generation_model_not_allowed"
      | "generation_provider_failed"
      | "generation_provider_invalid_response",
  ) {
    super(message);
    this.name = "ChapterSceneGenerationError";
  }
}

function normalizeText(value: TextLike): string {
  return value?.trim() ?? "";
}

function compactText(value: TextLike): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function preserveMultilineText(value: TextLike): string {
  return normalizeText(value).replace(/\r/g, "").trim();
}

function truncateText(value: string, maxLength = 360): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatReferenceSection(title: string, references: ChapterSceneGenerationReference[]): string | null {
  if (references.length === 0) return null;

  return [
    title,
    ...references.map((reference) => {
      const label = reference.resolvedLabel || reference.targetSlug;
      const broken = reference.isBroken ? " [non resolue]" : "";
      return `- ${label} -> ${reference.rawToken}${broken}`;
    }),
  ].join("\n");
}

function buildPromptReferencesBlock(references: ChapterSceneGenerationReference[]): string | null {
  if (references.length === 0) {
    return [
      "Inventaire des references",
      "- Aucune reference canonique detectee dans le resume.",
    ].join("\n");
  }

  const grouped: Record<string, ChapterSceneGenerationReference[]> = {
    character: [],
    scene: [],
    chapter: [],
    tome: [],
    asset: [],
    environment: [],
  };

  for (const reference of references) {
    const canonicalKind = normalizeReferenceKind(reference.referenceKind);
    if (!canonicalKind) continue;
    grouped[canonicalKind].push(reference);
  }

  return [
    "Inventaire des references",
    formatReferenceSection("Personnages", grouped.character),
    formatReferenceSection("Scenes", grouped.scene),
    formatReferenceSection("Chapitres", grouped.chapter),
    formatReferenceSection("Tomes", grouped.tome),
    formatReferenceSection("Ressources", grouped.asset),
    formatReferenceSection("Lieux", grouped.environment),
  ]
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n\n");
}

function buildSceneSchemaExample(sceneCount: number): string {
  return JSON.stringify(
    {
      scenes: Array.from({ length: Math.max(1, sceneCount) }, () => ({
        title: "Titre de scene",
        content: [
          "DIALOGUE: @chara:asha On y va.",
          "THOUGHT: @chara:kairo Je dois rester calme.",
          "NARRATION: Le vent se leve sur le quai.",
        ].join("\n"),
        sceneType: "free",
        location: "Quai",
        charactersJson: ["asha", "kairo"],
        tagsJson: ["ouverture", "tension"],
        metadataJson: {
          narrativeIntent: "",
          visualConstraints: "",
          stagingNotes: "",
        },
      })),
    },
    null,
    2,
  );
}

function allowedStoryCompletionModels(): string[] {
  return getStoryCompletionModels()
    .filter((model) => model.enabled && model.configured)
    .map((model) => model.key);
}

function resolveStoryCompletionModelKey(modelKey?: string): string {
  const allowed = allowedStoryCompletionModels();
  if (allowed.length === 0) {
    throw new ChapterSceneGenerationError(
      "Story completion provider not configured",
      "generation_missing_configuration",
    );
  }

  const selected = modelKey?.trim() || allowed[0];
  if (!allowed.includes(selected)) {
    throw new ChapterSceneGenerationError(
      `Model not allowed: ${selected}`,
      "generation_model_not_allowed",
    );
  }

  return selected;
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;

  const choices = obj["choices"];
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const choiceObj = choice as Record<string, unknown>;
      const message = choiceObj["message"];
      if (message && typeof message === "object") {
        const content = (message as Record<string, unknown>)["content"];
        if (typeof content === "string" && content.trim()) return content.trim();
      }
      const text = choiceObj["text"];
      if (typeof text === "string" && text.trim()) return text.trim();
    }
  }

  const outputText = obj["output_text"];
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  return null;
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    return codeFenceMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1).trim();
  }

  return trimmed;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeCharacterTokens(value: unknown): string[] {
  return normalizeStringArray(value)
    .map((item) => {
      const trimmed = item.trim();
      const match = trimmed.match(/^@(?:chara|character):(.+)$/i);
      const slug = match?.[1] ?? trimmed;
      return slugify(slug, { lower: true, strict: true, replacement: "-" });
    })
    .filter((item) => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSceneDraft(draft: Record<string, unknown>): ChapterSceneDraft {
  const metadataJson = isRecord(draft.metadataJson) ? draft.metadataJson : {};

  return {
    title: compactText(draft.title as TextLike),
    content: preserveMultilineText(draft.content as TextLike),
    sceneType: compactText(draft.sceneType as TextLike) || "free",
    location: compactText(draft.location as TextLike),
    charactersJson: normalizeCharacterTokens(draft.charactersJson),
    tagsJson: normalizeStringArray(draft.tagsJson),
    metadataJson,
  };
}

function parseChapterScenePayload(payload: unknown, sceneCount: number): GeneratedChapterScenes {
  const parsed = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const scenesValue = parsed?.scenes ?? parsed?.chapterScenes ?? payload;
  const scenesArray = Array.isArray(scenesValue) ? scenesValue : [];

  const scenes = scenesArray.map((scene) => {
    if (!scene || typeof scene !== "object") {
      throw new ChapterSceneGenerationError(
        "Invalid generated scene payload",
        "generation_provider_invalid_response",
      );
    }

    return normalizeSceneDraft(scene as Record<string, unknown>);
  });

  if (scenes.length !== sceneCount) {
    throw new ChapterSceneGenerationError(
      `Expected ${sceneCount} scenes, received ${scenes.length}`,
      "generation_provider_invalid_response",
    );
  }

  for (const scene of scenes) {
    if (!scene.title || !scene.content) {
      throw new ChapterSceneGenerationError(
        "Generated scene is missing required fields",
        "generation_provider_invalid_response",
      );
    }
  }

  return { scenes };
}

export function buildChapterSceneGenerationPrompt(input: ChapterSceneGenerationPromptInput): string {
  const referencesBlock = buildPromptReferencesBlock(input.references);

  return [
    "Tu es l'assistant narratif de Kuti Studio.",
    "Ta mission est de decomposer un chapitre en scenes coherentes, strictement en JSON.",
    "Le resume du chapitre est la source canonique: ne l'ignore pas, ne le paraphrase pas globalement, et respecte l'ordre logique des evenements.",
    "Chaque scene doit rester compatible avec une future planche manga, avec dialogues, pensees et narrations clairement separés dans le contenu.",
    "Les references canoniques doivent etre preservees exactes avec la syntaxe @chara:<slug>, @scene:<slug>, @chapter:<slug>, @tome:<slug>, @file:<slug> et @environment:<slug> quand elles apparaissent.",
    "Ne fabrique jamais de reference canonique nouvelle si elle n'existe pas dans l'inventaire.",
    "Retourne uniquement un JSON valide, sans markdown, sans explication et sans texte autour du JSON.",
    "",
    `Chapitre: ${input.chapterTitle}`,
    input.tomeTitle ? `Tome: ${input.tomeTitle}` : null,
    `Nombre de scenes a generer: ${input.sceneCount}`,
    "",
    "Resume du chapitre:",
    input.chapterSummary,
    "",
    referencesBlock,
    "",
    "Contraintes de sortie:",
    `- Retourne exactement ${input.sceneCount} scenes dans un tableau JSON nomme scenes.`,
    "- Chaque scene doit contenir les cles: title, content, sceneType, location, charactersJson, tagsJson, metadataJson.",
    "- content doit etre un script de scene ligne par ligne avec les prefixes DIALOGUE:, THOUGHT: et NARRATION:.",
    "- sceneType doit etre l'un de: free, dialogue, action, reveal, transition, confrontation, flashback, quiet_beat, climax, resolution.",
    "- charactersJson doit lister les slugs canoniques des personnages principaux, sans prefixe @.",
    "- tagsJson doit contenir des tags courts et coherents.",
    "- metadataJson peut contenir narrativeIntent, visualConstraints et stagingNotes.",
    "- Garde la coherence de ton, de lieu et de progression entre les scenes.",
    "- N'invente pas de scene de remplissage: chaque scene doit faire avancer le chapitre.",
    "",
    "Exemple de forme attendue:",
    buildSceneSchemaExample(input.sceneCount),
  ]
    .filter((line): line is string => Boolean(line && line.trim().length > 0))
    .join("\n");
}

export async function requestChapterSceneGeneration(
  input: ChapterSceneGenerationPromptInput & { modelKey?: string },
): Promise<{ modelKey: string; prompt: string; scenes: ChapterSceneDraft[] }> {
  if (!config.storyCompletionEnabled) {
    throw new ChapterSceneGenerationError("Story completion disabled", "generation_disabled");
  }
  if (!config.storyCompletionEndpoint || !config.storyCompletionApiKey) {
    throw new ChapterSceneGenerationError(
      "Story completion provider not configured",
      "generation_missing_configuration",
    );
  }

  const modelKey = resolveStoryCompletionModelKey(input.modelKey);
  const prompt = buildChapterSceneGenerationPrompt(input);

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
            content: "Tu generes des structures de scenes pour un studio local-first.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new ChapterSceneGenerationError(
        `Provider returned ${response.status}: ${await response.text()}`,
        "generation_provider_failed",
      );
    }

    const text = extractText(await response.json());
    if (!text) {
      throw new ChapterSceneGenerationError(
        "Invalid generation response",
        "generation_provider_invalid_response",
      );
    }

    const jsonText = extractJsonText(text);
    const parsed = JSON.parse(jsonText) as unknown;
    const scenes = parseChapterScenePayload(parsed, input.sceneCount).scenes;

    return { modelKey, prompt, scenes };
  } catch (error) {
    clearTimeout(timeout);

    if (error instanceof ChapterSceneGenerationError) {
      throw error;
    }

    if ((error as Error).name === "AbortError") {
      throw new ChapterSceneGenerationError("Chapter generation timeout", "generation_provider_failed");
    }

    throw new ChapterSceneGenerationError(String(error), "generation_provider_failed");
  }
}

async function generateUniqueSceneSlug(
  client: typeof prisma | Prisma.TransactionClient,
  projectId: string,
  title: string,
): Promise<string> {
  const baseSlug = slugify(title, { lower: true, strict: true }) || "scene";
  let candidate = baseSlug;
  let index = 2;

  while (await client.scene.findUnique({
    where: { projectId_slug: { projectId, slug: candidate } },
  })) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }

  return candidate;
}

export async function createSceneRecord(
  client: typeof prisma | Prisma.TransactionClient,
  input: {
    projectId: string;
    tomeId: string;
    chapterId: string;
    slug: string;
    title: string;
    sceneType?: string;
    location?: string;
    content?: string;
    charactersJson?: string[];
    tagsJson?: string[];
    metadataJson?: Prisma.InputJsonValue;
    targetPageCount?: number;
    status?: "active" | "draft" | "archived";
    orderIndex?: number;
    createdAt?: Date;
    updatedAt?: Date;
  },
) {
  const now = input.createdAt ?? new Date();

  const scene = await client.scene.create({
    data: {
      id: randomUUIDv7(),
      projectId: input.projectId,
      tomeId: input.tomeId,
      chapterId: input.chapterId,
      slug: input.slug,
      title: input.title,
      sceneType: input.sceneType ?? "free",
      location: input.location ?? "",
      content: input.content ?? "",
      charactersJson: input.charactersJson ?? [],
      tagsJson: input.tagsJson ?? [],
      metadataJson: (input.metadataJson ?? {}) as Prisma.InputJsonValue,
      targetPageCount: input.targetPageCount ?? 1,
      status: input.status ?? "draft",
      orderIndex: input.orderIndex ?? 0,
      createdAt: now,
      updatedAt: input.updatedAt ?? now,
    },
  });

  await syncSceneReferences(scene.id, input.projectId, {
    content: scene.content,
  }, client);

  return scene;
}

export async function replaceChapterScenesWithDrafts(
  projectId: string,
  chapterId: string,
  drafts: ChapterSceneDraft[],
  options: {
    jobId?: string;
    archiveReason?: string;
  } = {},
): Promise<PersistedChapterScenesResult> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, projectId },
    select: {
      id: true,
      tomeId: true,
    },
  });

  if (!chapter) {
    throw new Error("chapter_not_found");
  }

  const existingScenes = await prisma.scene.findMany({
    where: { projectId, chapterId },
    orderBy: { orderIndex: "asc" },
    select: { id: true },
  });

  const deletedSceneIds = existingScenes.map((scene) => scene.id);
  const existingPages = deletedSceneIds.length > 0
    ? await prisma.sceneMangaPage.findMany({
        where: { projectId, sceneId: { in: deletedSceneIds } },
        select: { id: true },
      })
    : [];

  const deletedPageIds = existingPages.map((page) => page.id);
  const now = new Date();

  const createdSceneIds = await prisma.$transaction(async (tx) => {
    if (deletedPageIds.length > 0) {
      await tx.sceneMangaPage.deleteMany({
        where: { projectId, id: { in: deletedPageIds } },
      });
    }

    if (deletedSceneIds.length > 0) {
      await tx.scene.deleteMany({
        where: { projectId, id: { in: deletedSceneIds } },
      });
    }

    const createdSceneIds: string[] = [];

    for (let index = 0; index < drafts.length; index += 1) {
      const draft = drafts[index];
      const slug = await generateUniqueSceneSlug(tx, projectId, draft.title);

      const scene = await createSceneRecord(tx, {
        projectId,
        tomeId: chapter.tomeId,
        chapterId: chapter.id,
        slug,
        title: draft.title,
        sceneType: draft.sceneType,
        location: draft.location,
        content: draft.content,
        charactersJson: draft.charactersJson,
        tagsJson: draft.tagsJson,
        metadataJson: {
          ...draft.metadataJson,
          autoGeneratedFromChapter: true,
          autoGeneratedFromChapterId: chapter.id,
          autoGeneratedFromJobId: options.jobId ?? null,
          autoGeneratedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
        status: "draft",
        orderIndex: index,
        createdAt: now,
        updatedAt: now,
      });

      createdSceneIds.push(scene.id);
    }

    await tx.chapter.update({
      where: { id: chapter.id },
      data: {
        updatedAt: now,
      },
    });

    return createdSceneIds;
  });

  return {
    chapterId: chapter.id,
    tomeId: chapter.tomeId,
    deletedSceneIds,
    deletedPageIds,
    createdSceneIds,
  };
}

export async function resolveChapterSceneGenerationReferences(
  projectId: string,
  chapterSummary: string,
): Promise<ChapterSceneGenerationReference[]> {
  const parsed = parseStoryReferencesFromText(chapterSummary);
  if (parsed.length === 0) return [];

  const sceneReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "scene");
  const chapterReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "chapter");
  const tomeReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "tome");
  const assetReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "asset");
  const characterReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "character");
  const environmentReferences = parsed.filter((reference) => normalizeReferenceKind(reference.referenceKind) === "environment");

  const characterSlugs = characterReferences.map((reference) => reference.targetSlug);
  const sceneSlugs = sceneReferences.map((reference) => reference.targetSlug);
  const chapterSlugs = chapterReferences.map((reference) => reference.targetSlug);
  const tomeSlugs = tomeReferences.map((reference) => reference.targetSlug);
  const assetSlugs = assetReferences.map((reference) => reference.targetSlug);

  const [characters, scenes, chapters, tomes, project, projectScenes] = await Promise.all([
    characterSlugs.length > 0
      ? prisma.character.findMany({
          where: { projectId, slug: { in: characterSlugs } },
          select: { slug: true, name: true },
        })
      : Promise.resolve([]),
    sceneSlugs.length > 0
      ? prisma.scene.findMany({
          where: { projectId, slug: { in: sceneSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
    chapterSlugs.length > 0
      ? prisma.chapter.findMany({
          where: { projectId, slug: { in: chapterSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
    tomeSlugs.length > 0
      ? prisma.tome.findMany({
          where: { projectId, slug: { in: tomeSlugs } },
          select: { slug: true, title: true },
        })
      : Promise.resolve([]),
    prisma.project.findFirst({
      where: { id: projectId },
      select: { settingsJson: true },
    }),
    prisma.scene.findMany({
      where: { projectId },
      select: { location: true },
    }),
  ]);

  const projectLocations = Array.isArray((project?.settingsJson as Record<string, unknown> | null)?.locationsJson)
    ? ((project?.settingsJson as Record<string, unknown>).locationsJson as string[])
    : [];

  const locationMap = new Map<string, string>();
  for (const location of [...projectLocations, ...projectScenes.map((scene: { location: string }) => scene.location)]) {
    const trimmed = typeof location === "string" ? location.trim() : "";
    if (!trimmed) continue;
    locationMap.set(slugify(trimmed, { lower: true, strict: true, replacement: "-" }), trimmed);
  }

  const assets: Array<{ slug: string; name: string }> = [];

  const characterMap = new Map(characters.map((entry: { slug: string; name: string }) => [entry.slug, entry.name]));
  const sceneMap = new Map(scenes.map((entry: { slug: string; title: string }) => [entry.slug, entry.title]));
  const chapterMap = new Map(chapters.map((entry: { slug: string; title: string }) => [entry.slug, entry.title]));
  const tomeMap = new Map(tomes.map((entry: { slug: string; title: string }) => [entry.slug, entry.title]));
  const assetMap = new Map(assets.map((entry: { slug: string; name: string }) => [entry.slug, entry.name]));

  const references: ChapterSceneGenerationReference[] = [];

  for (const reference of parsed) {
    const canonicalKind = normalizeReferenceKind(reference.referenceKind);
    if (!canonicalKind) {
      references.push({
        referenceKind: reference.referenceKind,
        targetSlug: reference.targetSlug,
        rawToken: reference.rawToken,
        resolvedLabel: null,
        description: "unsupported reference kind",
        isBroken: true,
      });
      continue;
    }

    switch (canonicalKind) {
      case "character": {
        const label = characterMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "character" : "missing character",
          isBroken: !label,
        });
        break;
      }
      case "scene": {
        const label = sceneMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "scene" : "missing scene",
          isBroken: !label,
        });
        break;
      }
      case "chapter": {
        const label = chapterMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "chapter" : "missing chapter",
          isBroken: !label,
        });
        break;
      }
      case "tome": {
        const label = tomeMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "tome" : "missing tome",
          isBroken: !label,
        });
        break;
      }
      case "asset": {
        const label = assetMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "asset" : "missing asset",
          isBroken: !label,
        });
        break;
      }
      case "environment": {
        const label = locationMap.get(reference.targetSlug) ?? null;
        references.push({
          referenceKind: reference.referenceKind,
          targetSlug: reference.targetSlug,
          rawToken: reference.rawToken,
          resolvedLabel: label,
          description: label ? "environment" : "missing environment",
          isBroken: !label,
        });
        break;
      }
    }
  }

  return references;
}
