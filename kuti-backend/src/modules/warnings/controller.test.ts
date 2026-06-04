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
const sceneFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const warningFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const warningCreate = createAsyncSpy<[unknown], Record<string, unknown>>();
const warningUpdate = createAsyncSpy<[unknown], Record<string, unknown>>();
const characterFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const relationFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const storyReferenceFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const assetFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const chapterFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const tomeFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();

const mockDb = {
  project: { findUnique: projectFindUnique },
  scene: { findMany: sceneFindMany, findFirst: sceneFindMany },
  warning: {
    findMany: warningFindMany,
    create: warningCreate,
    update: warningUpdate,
    findFirst: warningFindMany,
    updateMany: createAsyncSpy<[unknown], unknown>(),
  },
  character: { findMany: characterFindMany },
  characterRelation: { findMany: relationFindMany },
  storyReference: { findMany: storyReferenceFindMany },
  asset: { findMany: assetFindMany },
  chapter: { findMany: chapterFindMany },
  tome: { findMany: tomeFindMany },
};

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

const { scanWarnings } = await import("./controller");

describe("scanWarnings", () => {
  beforeEach(() => {
    projectFindUnique.mockReset();
    sceneFindMany.mockReset();
    warningFindMany.mockReset();
    warningCreate.mockReset();
    warningUpdate.mockReset();
    characterFindMany.mockReset();
    relationFindMany.mockReset();
    storyReferenceFindMany.mockReset();
    assetFindMany.mockReset();
    chapterFindMany.mockReset();
    tomeFindMany.mockReset();
  });

  test("scans the stable coherence registry and creates timeline, continuity, tone and impossible fact warnings", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    let counter = 0;
    const warningStore: Array<Record<string, unknown>> = [];

    projectFindUnique.mockResolvedValue({
      settingsJson: {
        coherenceRulesJson: {
          orphanCharacter: false,
          brokenReference: false,
          emptyScene: false,
          locationConflict: false,
          timelineConflict: true,
          continuityBreak: true,
          toneBreak: true,
          impossibleFact: true,
        },
        coherenceSignalsJson: {
          timelineAnchorsJson: [
            { slug: "chapter-1", label: "Chapter 1", orderIndex: 0, note: "opening" },
          ],
          toneProfileJson: {
            requiredTagsJson: ["noir"],
            forbiddenTagsJson: ["comedic"],
          },
          continuityFactsJson: [
            { key: "ship-status", value: "operational", scope: "project" },
          ],
          impossibleFactsJson: [
            { key: "gravity", value: "zero", scope: "project" },
          ],
        },
      },
    });

    sceneFindMany.mockImplementation(async () => [
      {
        id: "scene-1",
        projectId: "project-1",
        tomeId: "tome-1",
        chapterId: "chapter-1",
        title: "Opening",
        slug: "opening",
        sceneType: "",
        location: "",
        summary: "@timeline:chapter-1 @continuity:ship-status=damaged",
        content: "The crew keeps a comedic tone with @tone:comedic",
        notes: "Never mention @fact:gravity=zero",
        tagsJson: ["tense"],
        status: "active",
        orderIndex: 1,
        chapter: { title: "Chapter 1" },
        tome: { title: "Tome 1" },
        createdAt: now,
        updatedAt: now,
      },
    ]);

    warningFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === "open") {
        return warningStore.filter((warning) => warning.status === "open");
      }

      return warningStore;
    });

    warningCreate.mockImplementation(async ({ data }: any) => {
      const record = {
        id: `warning-${counter + 1}`,
        ...data,
        createdAt: new Date(now.getTime() + counter * 1000),
        updatedAt: new Date(now.getTime() + counter * 1000),
        resolvedAt: null,
      };
      counter += 1;
      warningStore.push(record);
      return record;
    });

    const result = await scanWarnings("project-1");

    expect(result.added).toBe(4);
    expect(result.items).toHaveLength(4);
    expect(warningCreate.mock.calls).toHaveLength(4);

    const kinds = warningCreate.mock.calls.map((call) => (call[0] as any).data.kind).sort();
    expect(kinds).toEqual([
      "continuity_break",
      "impossible_fact",
      "timeline_conflict",
      "tone_break",
    ]);

    expect(result.items.map((warning) => warning.kind).sort()).toEqual(kinds);
    expect(result.items.every((warning) => warning.metadataJson.signalSource === "scene")).toBe(true);
  });

  test("flags broken file and environment references through the canonical aliases", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    let counter = 0;
    const warningStore: Array<Record<string, unknown>> = [];

    projectFindUnique.mockResolvedValue({
      settingsJson: {
        coherenceRulesJson: {
          orphanCharacter: false,
          brokenReference: true,
          emptyScene: false,
          locationConflict: false,
          timelineConflict: false,
          continuityBreak: false,
          toneBreak: false,
          impossibleFact: false,
        },
        coherenceSignalsJson: {},
      },
    });

    sceneFindMany.mockImplementation(async (args: any) => {
      if (args?.select?.slug && args?.select?.location) {
        return [];
      }

      return [];
    });

    storyReferenceFindMany.mockResolvedValue([
      {
        id: "ref-asset",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "file",
        targetSlug: "reference-card",
        rawToken: "@file:reference-card",
        createdAt: now,
        scene: {
          title: "Opening",
          tomeId: "tome-1",
          chapterId: "chapter-1",
        },
      },
      {
        id: "ref-environment",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "environment",
        targetSlug: "main-hall",
        rawToken: "@environment:main-hall",
        createdAt: now,
        scene: {
          title: "Opening",
          tomeId: "tome-1",
          chapterId: "chapter-1",
        },
      },
    ]);

    characterFindMany.mockResolvedValue([]);
    relationFindMany.mockResolvedValue([]);
    assetFindMany.mockResolvedValue([]);
    chapterFindMany.mockResolvedValue([]);
    tomeFindMany.mockResolvedValue([]);

    warningFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === "open") {
        return warningStore.filter((warning) => warning.status === "open");
      }

      return warningStore;
    });

    warningCreate.mockImplementation(async ({ data }: any) => {
      const record = {
        id: `warning-${counter + 1}`,
        ...data,
        createdAt: new Date(now.getTime() + counter * 1000),
        updatedAt: new Date(now.getTime() + counter * 1000),
        resolvedAt: null,
      };
      counter += 1;
      warningStore.push(record);
      return record;
    });

    const result = await scanWarnings("project-1");

    expect(result.added).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(warningCreate.mock.calls).toHaveLength(2);

    const createdKinds = warningCreate.mock.calls.map((call) => (call[0] as any).data.kind).sort();
    expect(createdKinds).toEqual(["broken_reference", "broken_reference"]);

    const createdTargets = warningCreate.mock.calls.map((call) => (call[0] as any).data.metadataJson.targetKind).sort();
    expect(createdTargets).toEqual(["asset", "environment"]);

    const titles = result.items.map((warning) => warning.title).sort();
    expect(titles).toEqual(["Broken asset reference", "Broken location reference"]);
  });

  test("flags broken character references through the canonical alias", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    let counter = 0;
    const warningStore: Array<Record<string, unknown>> = [];

    projectFindUnique.mockResolvedValue({
      settingsJson: {
        coherenceRulesJson: {
          orphanCharacter: false,
          brokenReference: true,
          emptyScene: false,
          locationConflict: false,
          timelineConflict: false,
          continuityBreak: false,
          toneBreak: false,
          impossibleFact: false,
        },
        coherenceSignalsJson: {},
      },
    });

    sceneFindMany.mockImplementation(async () => []);
    storyReferenceFindMany.mockResolvedValue([
      {
        id: "ref-character",
        projectId: "project-1",
        sceneId: "scene-1",
        referenceKind: "character",
        targetSlug: "lemillion",
        rawToken: "@chara:lemillion",
        createdAt: now,
        scene: {
          title: "Opening",
          tomeId: "tome-1",
          chapterId: "chapter-1",
        },
      },
    ]);

    characterFindMany.mockResolvedValue([]);
    relationFindMany.mockResolvedValue([]);
    assetFindMany.mockResolvedValue([]);
    chapterFindMany.mockResolvedValue([]);
    tomeFindMany.mockResolvedValue([]);

    warningFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.status === "open") {
        return warningStore.filter((warning) => warning.status === "open");
      }

      return warningStore;
    });

    warningCreate.mockImplementation(async ({ data }: any) => {
      const record = {
        id: `warning-${counter + 1}`,
        ...data,
        createdAt: new Date(now.getTime() + counter * 1000),
        updatedAt: new Date(now.getTime() + counter * 1000),
        resolvedAt: null,
      };
      counter += 1;
      warningStore.push(record);
      return record;
    });

    const result = await scanWarnings("project-1");

    expect(result.added).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(warningCreate.mock.calls).toHaveLength(1);

    expect((warningCreate.mock.calls[0][0] as any).data.kind).toBe("broken_reference");
    expect((warningCreate.mock.calls[0][0] as any).data.metadataJson.targetKind).toBe("character");
    expect(result.items[0].title).toBe("Broken character reference");
  });
});
