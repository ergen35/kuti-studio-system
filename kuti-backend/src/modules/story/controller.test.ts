import { beforeEach, describe, expect, mock, test } from "bun:test";

function createAsyncSpy<TArgs extends Array<unknown>, TResult>() {
  let implementation: (...args: TArgs) => TResult | Promise<TResult> = async () => undefined as TResult;

  const state = { calls: [] as TArgs[] };
  const spy = Object.assign(async (...args: TArgs): Promise<TResult> => {
    state.calls.push(args);
    return await implementation(...args);
  }, {
    mock: state,
    mockReset: () => {
      state.calls = [];
      implementation = async () => undefined as TResult;
    },
    mockResolvedValue: (value: TResult) => {
      implementation = async () => value;
    },
    mockImplementation: (fn: (...args: TArgs) => TResult | Promise<TResult>) => {
      implementation = fn;
    },
  }) as ((...args: TArgs) => Promise<TResult>) & {
    mock: { calls: TArgs[] };
    mockReset: () => void;
    mockResolvedValue: (value: TResult) => void;
    mockImplementation: (fn: (...args: TArgs) => TResult | Promise<TResult>) => void;
  };

  return spy;
}

const projectFindUnique = createAsyncSpy<[unknown], { settingsJson: Record<string, unknown> } | null>();
const characterFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const sceneFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const chapterFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const tomeFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const assetFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const storyReferenceFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();

const mockDb = {
  project: { findUnique: projectFindUnique },
  character: { findMany: characterFindMany },
  scene: { findMany: sceneFindMany },
  chapter: { findMany: chapterFindMany },
  tome: { findMany: tomeFindMany },
  asset: { findMany: assetFindMany },
  storyReference: { findMany: storyReferenceFindMany },
};

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

mock.module("@lib/config", () => ({
  config: {
    databaseUrl: "postgresql://localhost:5432/kuti",
    storyCompletionModels: [],
    storyCompletionDefaultModel: "gpt-5.4-nano",
    storyCompletionEnabled: true,
    storyCompletionEndpoint: "http://localhost:1234",
    storyCompletionApiKey: "test-key",
  },
  getProjectDir: (slug: string) => `/data/projects/${slug}`,
  resolveModelProvider: () => ({
    key: "gpt_images_2",
    kind: "image",
    displayName: "GPT Images 2",
    baseUrl: "http://localhost:1234",
    apiKey: "test-key",
    enabled: true,
    apiModel: "gpt-image-2",
  }),
}));

const { getReferenceSuggestions, getStorySummary } = await import("./controller");

describe("story controller reference suggestions", () => {
  beforeEach(() => {
    projectFindUnique.mockReset();
    characterFindMany.mockReset();
    sceneFindMany.mockReset();
    chapterFindMany.mockReset();
    tomeFindMany.mockReset();
    assetFindMany.mockReset();
    storyReferenceFindMany.mockReset();

    projectFindUnique.mockResolvedValue({
      settingsJson: {
        locationsJson: ["Main Hall", "Archive Wing"],
      },
    });

    characterFindMany.mockResolvedValue([
      { id: "character-1", slug: "lemillion", name: "LeMillion" },
    ]);
    sceneFindMany.mockImplementation(async (args: any) => {
      if (args?.select?.location) {
        return [
          { location: "Main Hall" },
          { location: "Archive Wing" },
          { location: "Main Hall" },
        ];
      }

      return [
        {
          id: "scene-1",
          projectId: "project-1",
          tomeId: "tome-1",
          chapterId: "chapter-1",
          title: "La concussion",
          slug: "la-concussion",
          sceneType: "action",
          location: "Main Hall",
          summary: "Le combat commence",
          content: "Le dragon rouge surgit au-dessus du pont.",
          notes: "Faire ressortir l'ombre du dragon.",
          charactersJson: ["lemillion"],
          tagsJson: ["combat", "dragon"],
          metadataJson: {},
          status: "active",
          orderIndex: 1,
          createdAt: new Date("2026-06-01T11:58:00.000Z"),
          updatedAt: new Date("2026-06-01T11:59:00.000Z"),
        },
      ];
    });
    chapterFindMany.mockResolvedValue([
      {
        id: "chapter-1",
        projectId: "project-1",
        tomeId: "tome-1",
        title: "Chapitre 1",
        slug: "chapitre-1",
        synopsis: "Le héros arrive",
        status: "active",
        orderIndex: 0,
        createdAt: new Date("2026-06-01T11:50:00.000Z"),
        updatedAt: new Date("2026-06-01T11:55:00.000Z"),
      },
    ]);
    tomeFindMany.mockResolvedValue([
      {
        id: "tome-1",
        projectId: "project-1",
        title: "Tome Zero",
        slug: "tome-zero",
        synopsis: "Saga épique",
        status: "active",
        orderIndex: 0,
        createdAt: new Date("2026-06-01T11:40:00.000Z"),
        updatedAt: new Date("2026-06-01T11:45:00.000Z"),
      },
    ]);
    assetFindMany.mockResolvedValue([
      { id: "asset-1", projectId: "project-1", slug: "reference-card", name: "Reference Card" },
    ]);
  });

  test("returns navigation-ready suggestions for canonical and aliased reference kinds", async () => {
    await expect(getReferenceSuggestions("project-1", "character", "")).resolves.toEqual([
      {
        kind: "character",
        slug: "lemillion",
        label: "LeMillion",
        entityId: "character-1",
        href: "/projects/project-1/characters/character-1",
        description: "character",
      },
    ]);

    await expect(getReferenceSuggestions("project-1", "scene", "")).resolves.toEqual([
      {
        kind: "scene",
        slug: "la-concussion",
        label: "La concussion",
        entityId: "scene-1",
        href: "/projects/project-1/story/tome-1/scenes/scene-1",
        description: "scene",
      },
    ]);

    await expect(getReferenceSuggestions("project-1", "chapter", "")).resolves.toEqual([
      {
        kind: "chapter",
        slug: "chapitre-1",
        label: "Chapitre 1",
        entityId: "chapter-1",
        href: "/projects/project-1/story/tome-1/chapters/chapter-1",
        description: "chapter",
      },
    ]);

    await expect(getReferenceSuggestions("project-1", "tome", "")).resolves.toEqual([
      {
        kind: "tome",
        slug: "tome-zero",
        label: "Tome Zero",
        entityId: "tome-1",
        href: "/projects/project-1/story/tome-1",
        description: "tome",
      },
    ]);

    await expect(getReferenceSuggestions("project-1", "file", "")).resolves.toEqual([
      {
        kind: "asset",
        slug: "reference-card",
        label: "Reference Card",
        entityId: "asset-1",
        href: "/projects/project-1/assets?asset=reference-card",
        description: "asset",
      },
    ]);

    await expect(getReferenceSuggestions("project-1", "location", "main")).resolves.toEqual([
      {
        kind: "environment",
        slug: "main-hall",
        label: "Main Hall",
        entityId: "main-hall",
        href: "/projects/project-1/settings?location=main-hall",
        description: "environment",
      },
    ]);
  });

  test("returns the story summary with canonical references and orphans for the reference panel", async () => {
    storyReferenceFindMany.mockResolvedValue([
      {
        id: "ref-character",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "character",
        targetSlug: "lemillion",
        rawToken: "@chara:lemillion",
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
      },
      {
        id: "ref-chapter",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "chapter",
        targetSlug: "chapitre-1",
        rawToken: "@chapter:chapitre-1",
        createdAt: new Date("2026-06-01T12:01:00.000Z"),
      },
      {
        id: "ref-tome",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "tome",
        targetSlug: "tome-zero",
        rawToken: "@tome:tome-zero",
        createdAt: new Date("2026-06-01T12:02:00.000Z"),
      },
      {
        id: "ref-scene",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "scene",
        targetSlug: "la-concussion",
        rawToken: "@scene:la-concussion",
        createdAt: new Date("2026-06-01T12:03:00.000Z"),
      },
      {
        id: "ref-file",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "file",
        targetSlug: "reference-card",
        rawToken: "@file:reference-card",
        createdAt: new Date("2026-06-01T12:04:00.000Z"),
      },
      {
        id: "ref-environment",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "environment",
        targetSlug: "main-hall",
        rawToken: "@environment:main-hall",
        createdAt: new Date("2026-06-01T12:05:00.000Z"),
      },
      {
        id: "ref-missing-asset",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "file",
        targetSlug: "missing-card",
        rawToken: "@file:missing-card",
        createdAt: new Date("2026-06-01T12:06:00.000Z"),
      },
      {
        id: "ref-missing-location",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "location",
        targetSlug: "missing-room",
        rawToken: "@location:missing-room",
        createdAt: new Date("2026-06-01T12:07:00.000Z"),
      },
    ]);

    const summary = await getStorySummary("project-1");

    expect(summary.references.map((reference) => reference.referenceKind)).toEqual([
      "character",
      "chapter",
      "tome",
      "scene",
      "file",
      "environment",
      "file",
      "location",
    ]);

    expect(summary.orphanReferences).toEqual([
      {
        reference: {
          id: "ref-missing-asset",
          projectId: "project-1",
          sceneId: "scene-1",
          referenceKind: "file",
          targetSlug: "missing-card",
          rawToken: "@file:missing-card",
          createdAt: "2026-06-01T12:06:00.000Z",
        },
        reason: "Asset not found",
      },
      {
        reference: {
          id: "ref-missing-location",
          projectId: "project-1",
          sceneId: "scene-1",
          referenceKind: "location",
          targetSlug: "missing-room",
          rawToken: "@location:missing-room",
          createdAt: "2026-06-01T12:07:00.000Z",
        },
        reason: "Location not found",
      },
    ]);

    expect(summary.references).toHaveLength(8);
    expect(summary.orphanReferences).toHaveLength(2);
  });
});
