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

const tomeFindFirst = createAsyncSpy<[unknown], any>();
const chapterFindFirst = createAsyncSpy<[unknown], any>();
const sceneFindFirst = createAsyncSpy<[unknown], any>();
const sceneFindUnique = createAsyncSpy<[unknown], any>();
const tomeUpdate = createAsyncSpy<[unknown], any>();
const chapterUpdate = createAsyncSpy<[unknown], any>();

const txSceneCreate = createAsyncSpy<[unknown], any>();
const txSceneUpdate = createAsyncSpy<[unknown], any>();
const txStoryReferenceDeleteMany = createAsyncSpy<[unknown], any>();
const txStoryReferenceCreateMany = createAsyncSpy<[unknown], any>();
const transaction = createAsyncSpy<[unknown], any>();

const transactionClient = {
  scene: {
    create: txSceneCreate,
    update: txSceneUpdate,
  },
  storyReference: {
    deleteMany: txStoryReferenceDeleteMany,
    createMany: txStoryReferenceCreateMany,
  },
};

const mockDb = {
  tome: {
    findFirst: tomeFindFirst,
    update: tomeUpdate,
  },
  chapter: {
    findFirst: chapterFindFirst,
    update: chapterUpdate,
  },
  scene: {
    findFirst: sceneFindFirst,
    findUnique: sceneFindUnique,
  },
  $transaction: transaction,
};

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

mock.module("@lib/coherence-scan", () => ({
  runCoherenceScanIfEnabled: async () => undefined,
}));

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

const { createScene, updateChapter, updateScene, updateTome } = await import("./controller");

describe("story controller scene reference sync", () => {
  beforeEach(() => {
    tomeFindFirst.mockReset();
    chapterFindFirst.mockReset();
    sceneFindFirst.mockReset();
    sceneFindUnique.mockReset();
    tomeUpdate.mockReset();
    chapterUpdate.mockReset();
    txSceneCreate.mockReset();
    txSceneUpdate.mockReset();
    txStoryReferenceDeleteMany.mockReset();
    txStoryReferenceCreateMany.mockReset();
    transaction.mockReset();

    transaction.mockImplementation(async (callback: any) => callback(transactionClient));
  });

  test("syncs typed references when creating a scene", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");

    tomeFindFirst.mockResolvedValue({
      id: "tome-1",
      projectId: "project-1",
      title: "Tome Zero",
      slug: "tome-zero",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    chapterFindFirst.mockResolvedValue({
      id: "chapter-1",
      projectId: "project-1",
      tomeId: "tome-1",
      title: "Chapter 1",
      slug: "chapter-1",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    txSceneCreate.mockImplementation(async ({ data }: any) => ({
      id: "scene-1",
      projectId: data.projectId,
      tomeId: data.tomeId,
      chapterId: data.chapterId,
      title: data.title,
      slug: data.slug,
      sceneType: data.sceneType ?? "",
      location: data.location ?? "",
      summary: data.summary ?? "",
      content: data.content ?? "",
      notes: data.notes ?? "",
      charactersJson: data.charactersJson ?? [],
      tagsJson: data.tagsJson ?? [],
      metadataJson: data.metadataJson ?? {},
      status: data.status ?? "draft",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: now,
    }));

    const created = await createScene("project-1", {
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Scene with references",
      sceneType: "action",
      content: "Content with @file:reference-card and @chapter:chapter-1 and @tome:tome-zero and @environment:main-hall",
      charactersJson: ["lemillion"],
      tagsJson: ["combat"],
      metadataJson: { narrativeIntent: "test" },
      status: "active",
      orderIndex: 2,
    });

    expect(created?.slug).toBe("scene-with-references");
    expect(txStoryReferenceDeleteMany.mock.calls).toEqual([
      [{ where: { projectId: "project-1", sceneId: "scene-1" } }],
    ]);
    expect(txStoryReferenceCreateMany.mock.calls).toEqual([
      [{
        data: [
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
  });

  test("replaces previous references when updating a scene", async () => {
    const now = new Date("2026-06-01T13:00:00.000Z");

    sceneFindFirst.mockResolvedValue({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Scene one",
      slug: "scene-one",
      sceneType: "dialogue",
      location: "Old room",
      summary: "Old @file:old-card",
      content: "Legacy content",
      notes: "",
      charactersJson: [],
      tagsJson: [],
      metadataJson: {},
      status: "draft",
      orderIndex: 1,
      createdAt: now,
      updatedAt: now,
    });

    txSceneUpdate.mockImplementation(async ({ data }: any) => ({
      id: "scene-1",
      projectId: "project-1",
      tomeId: data.tomeId ?? "tome-1",
      chapterId: data.chapterId ?? "chapter-1",
      title: data.title ?? "Scene one",
      slug: "scene-one",
      sceneType: data.sceneType ?? "dialogue",
      location: data.location ?? "Old room",
      summary: data.summary ?? "Old @file:old-card",
      content: data.content ?? "Legacy content",
      notes: data.notes ?? "",
      charactersJson: data.charactersJson ?? [],
      tagsJson: data.tagsJson ?? [],
      metadataJson: data.metadataJson ?? {},
      status: data.status ?? "draft",
      orderIndex: data.orderIndex ?? 1,
      createdAt: now,
      updatedAt: new Date("2026-06-01T13:10:00.000Z"),
    }));

    const updated = await updateScene("project-1", "scene-1", {
      title: "Scene one revised",
      content: "Updated @file:reference-card and @environment:main-hall and @chapter:chapter-1 and @tome:tome-zero",
      metadataJson: { narrativeIntent: "updated" },
    });

    expect(updated?.title).toBe("Scene one revised");
    expect(txStoryReferenceDeleteMany.mock.calls).toEqual([
      [{ where: { projectId: "project-1", sceneId: "scene-1" } }],
    ]);
    expect(txStoryReferenceCreateMany.mock.calls).toEqual([
      [{
        data: [
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
          {
            projectId: "project-1",
            sceneId: "scene-1",
            referenceKind: "tome",
            targetSlug: "tome-zero",
            rawToken: "@tome:tome-zero",
          },
        ],
      }],
    ]);
  });

  test("keeps tome slugs stable when the title changes", async () => {
    const now = new Date("2026-06-01T14:00:00.000Z");

    tomeFindFirst.mockResolvedValue({
      id: "tome-1",
      projectId: "project-1",
      title: "Tome Zero",
      slug: "tome-zero",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    tomeUpdate.mockImplementation(async ({ data }: any) => ({
      id: "tome-1",
      projectId: "project-1",
      title: data.title ?? "Tome Zero",
      slug: "tome-zero",
      synopsis: data.synopsis ?? "",
      status: data.status ?? "active",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: new Date("2026-06-01T14:05:00.000Z"),
    }));

    const updated = await updateTome("project-1", "tome-1", {
      title: "Tome Zero Revised",
    });

    expect(updated?.slug).toBe("tome-zero");
  });

  test("keeps chapter slugs stable when the title changes", async () => {
    const now = new Date("2026-06-01T15:00:00.000Z");

    chapterFindFirst.mockResolvedValue({
      id: "chapter-1",
      projectId: "project-1",
      tomeId: "tome-1",
      title: "Chapter 1",
      slug: "chapter-1",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    });

    chapterUpdate.mockImplementation(async ({ data }: any) => ({
      id: "chapter-1",
      projectId: "project-1",
      tomeId: data.tomeId ?? "tome-1",
      title: data.title ?? "Chapter 1",
      slug: "chapter-1",
      synopsis: data.synopsis ?? "",
      status: data.status ?? "active",
      orderIndex: data.orderIndex ?? 0,
      createdAt: now,
      updatedAt: new Date("2026-06-01T15:05:00.000Z"),
    }));

    const updated = await updateChapter("project-1", "chapter-1", {
      title: "Chapter 1 Revised",
    });

    expect(updated?.slug).toBe("chapter-1");
  });
});
