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

const deleteMany = createAsyncSpy<[unknown], void>();
const createMany = createAsyncSpy<[unknown], void>();

const mockDb = {
  storyReference: {
    deleteMany,
    createMany,
  },
};

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

const {
  buildReferenceToken,
  normalizeReferenceKind,
  parseSceneReferences,
  syncSceneReferences,
} = await import("./story-references");

describe("story-references", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    createMany.mockReset();
  });

  test("normalizes aliases to the canonical reference kinds", () => {
    expect(normalizeReferenceKind("chara")).toBe("character");
    expect(normalizeReferenceKind("file")).toBe("asset");
    expect(normalizeReferenceKind("location")).toBe("environment");
    expect(buildReferenceToken("asset", "reference-card")).toBe("@file:reference-card");
    expect(buildReferenceToken("environment", "main-hall")).toBe("@environment:main-hall");
  });

  test("parses and syncs character, chapter, tome, file and environment references", async () => {
    const source = {
      summary: "@chara:lemillion @chapter:chapter-1 @tome:tome-zero",
      content: "A reference to @file:reference-card and @environment:main-hall appears here.",
      notes: "Duplicate alias tokens @asset:reference-card and @location:main-hall should be deduped.",
    };

    const parsed = parseSceneReferences(source);

    expect(parsed).toEqual([
      { referenceKind: "character", targetSlug: "lemillion", rawToken: "@chara:lemillion" },
      { referenceKind: "chapter", targetSlug: "chapter-1", rawToken: "@chapter:chapter-1" },
      { referenceKind: "tome", targetSlug: "tome-zero", rawToken: "@tome:tome-zero" },
      { referenceKind: "asset", targetSlug: "reference-card", rawToken: "@file:reference-card" },
      { referenceKind: "environment", targetSlug: "main-hall", rawToken: "@environment:main-hall" },
    ]);

    const persisted = await syncSceneReferences("scene-1", "project-1", source, mockDb as any);

    expect(deleteMany.mock.calls).toEqual([
      [{ where: { projectId: "project-1", sceneId: "scene-1" } }],
    ]);
    expect(createMany.mock.calls).toEqual([
      [{
        data: [
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "character",
            targetSlug: "lemillion",
            rawToken: "@chara:lemillion",
          },
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "chapter",
            targetSlug: "chapter-1",
            rawToken: "@chapter:chapter-1",
          },
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "tome",
            targetSlug: "tome-zero",
            rawToken: "@tome:tome-zero",
          },
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "asset",
            targetSlug: "reference-card",
            rawToken: "@file:reference-card",
          },
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "environment",
            targetSlug: "main-hall",
            rawToken: "@environment:main-hall",
          },
        ],
      }],
    ]);

    expect(persisted).toEqual(parsed);
  });
});
