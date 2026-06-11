import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

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

const chapterFindFirst = createAsyncSpy<[unknown], any>();
const generationJobCreate = createAsyncSpy<[unknown], any>();
const sceneFindMany = createAsyncSpy<[unknown], any>();
const sceneMangaPageFindMany = createAsyncSpy<[unknown], any>();

const txSceneFindUnique = createAsyncSpy<[unknown], any>();
const txSceneCreate = createAsyncSpy<[unknown], any>();
const txSceneDeleteMany = createAsyncSpy<[unknown], any>();
const txSceneMangaPageDeleteMany = createAsyncSpy<[unknown], any>();
const txChapterUpdate = createAsyncSpy<[unknown], any>();
const txStoryReferenceDeleteMany = createAsyncSpy<[unknown], any>();
const txStoryReferenceCreateMany = createAsyncSpy<[unknown], any>();
const transaction = createAsyncSpy<[unknown], any>();

const sendGenerateChapterScenesEvent = createAsyncSpy<[unknown], void>();
const sendGenerateSceneMangaEvent = createAsyncSpy<[unknown], void>();

const transactionClient = {
  scene: {
    findUnique: txSceneFindUnique,
    create: txSceneCreate,
    deleteMany: txSceneDeleteMany,
  },
  sceneMangaPage: {
    deleteMany: txSceneMangaPageDeleteMany,
  },
  chapter: {
    update: txChapterUpdate,
  },
  storyReference: {
    deleteMany: txStoryReferenceDeleteMany,
    createMany: txStoryReferenceCreateMany,
  },
};

const mockDb = {
  chapter: {
    findFirst: chapterFindFirst,
  },
  generationJob: {
    create: generationJobCreate,
    findFirst: createAsyncSpy<[unknown], any>(),
    findMany: createAsyncSpy<[unknown], any>(),
    update: createAsyncSpy<[unknown], any>(),
  },
  scene: {
    findMany: sceneFindMany,
  },
  sceneMangaPage: {
    findMany: sceneMangaPageFindMany,
  },
  project: {
    findUnique: createAsyncSpy<[unknown], any>(),
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
}));

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

mock.module("@lib/inngest", () => ({
  sendGenerateChapterScenesEvent,
  sendGenerateSceneMangaEvent,
}));

const originalFetch = globalThis.fetch;

const { autoGenerateChapterScenes } = await import("./controller");
const {
  buildChapterSceneGenerationPrompt,
  requestChapterSceneGeneration,
  replaceChapterScenesWithDrafts,
} = await import("./chapter-auto-generation");

function resetBaseMocks() {
  chapterFindFirst.mockReset();
  generationJobCreate.mockReset();
  sceneFindMany.mockReset();
  sceneMangaPageFindMany.mockReset();
  txSceneFindUnique.mockReset();
  txSceneCreate.mockReset();
  txSceneDeleteMany.mockReset();
  txSceneMangaPageDeleteMany.mockReset();
  txChapterUpdate.mockReset();
  txStoryReferenceDeleteMany.mockReset();
  txStoryReferenceCreateMany.mockReset();
  transaction.mockReset();
  sendGenerateChapterScenesEvent.mockReset();
  sendGenerateSceneMangaEvent.mockReset();

  transaction.mockImplementation(async (callback: any) => callback(transactionClient));
}

describe("chapter auto-generation", () => {
  beforeEach(() => {
    resetBaseMocks();

    chapterFindFirst.mockResolvedValue({
      id: "chapter-1",
      projectId: "project-1",
      tomeId: "tome-1",
      title: "Chapter 1",
      slug: "chapter-1",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      tome: {
        title: "Tome 1",
      },
    });

    generationJobCreate.mockResolvedValue({ id: "job-1" });

    sceneFindMany.mockResolvedValue([]);
    sceneMangaPageFindMany.mockResolvedValue([]);

    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  scenes: [
                    {
                      title: "Scene 1",
                      summary: "Asha and Kairo arrive at the dock.",
                      content: "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.",
                      notes: "",
                      sceneType: "action",
                      location: "Dock",
                      charactersJson: ["asha", "kairo"],
                      tagsJson: ["opening"],
                      metadataJson: {
                        narrativeIntent: "",
                        duration: "",
                        tone: "",
                        rhythm: "",
                        visualConstraints: "",
                        stagingNotes: "",
                      },
                    },
                    {
                      title: "Scene 2",
                      summary: "They move forward.",
                      content: "NARRATION: The wind cuts across the water.",
                      notes: "",
                      sceneType: "transition",
                      location: "Dock",
                      charactersJson: ["asha"],
                      tagsJson: ["bridge"],
                      metadataJson: {
                        narrativeIntent: "",
                        duration: "",
                        tone: "",
                        rhythm: "",
                        visualConstraints: "",
                        stagingNotes: "",
                      },
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("builds a strict chapter-scene prompt with canonical reference inventory", () => {
    const prompt = buildChapterSceneGenerationPrompt({
      chapterTitle: "Chapter 1",
      tomeTitle: "Tome 1",
      chapterSummary: "Asha and Kairo meet at the dock and mention @chara:asha and @file:map.",
      sceneCount: 2,
      references: [
        {
          referenceKind: "character",
          targetSlug: "asha",
          rawToken: "@chara:asha",
          resolvedLabel: "Asha",
          description: "character",
          isBroken: false,
        },
      ],
    });

    expect(prompt).toContain("Retourne uniquement un JSON valide");
    expect(prompt).toContain("Nombre de scenes a generer: 2");
    expect(prompt).toContain("Asha -> @chara:asha");
    expect(prompt).toContain("scenes");
    expect(prompt).toContain("DIALOGUE:");
    expect(prompt).toContain("THOUGHT:");
    expect(prompt).toContain("NARRATION:");
  });

  test("requests scene generation with strict JSON and preserves multiline content", async () => {
    const result = await requestChapterSceneGeneration({
      chapterTitle: "Chapter 1",
      tomeTitle: "Tome 1",
      chapterSummary: "Asha and Kairo meet at the dock and mention @chara:asha.",
      sceneCount: 2,
      references: [
        {
          referenceKind: "character",
          targetSlug: "asha",
          rawToken: "@chara:asha",
          resolvedLabel: "Asha",
          description: "character",
          isBroken: false,
        },
      ],
    });

    expect(result.modelKey).toBe("gpt-5.4-nano");
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]?.content).toBe(
      "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.",
    );

    const call = (globalThis.fetch as any).mock.calls[0];
    const payload = JSON.parse(String(call[1]?.body ?? "{}")) as {
      messages?: Array<{ content?: string }>;
    };

    expect(payload.messages?.[1]?.content).toContain("Asha -> @chara:asha");
    expect(payload.messages?.[1]?.content).toContain("Retourne uniquement un JSON valide");
  });

  test("rejects invalid chapter auto-generation payloads before touching persistence", async () => {
    await expect(autoGenerateChapterScenes("project-1", "chapter-1", {
      chapterSummary: "x".repeat(999),
      sceneCount: 2,
    })).rejects.toThrow();

    await expect(autoGenerateChapterScenes("project-1", "chapter-1", {
      chapterSummary: "x".repeat(1000),
      sceneCount: 9,
    })).rejects.toThrow();

    expect(chapterFindFirst.mock.calls).toHaveLength(0);
    expect(generationJobCreate.mock.calls).toHaveLength(0);
    expect(sendGenerateChapterScenesEvent.mock.calls).toHaveLength(0);
  });

  test("queues a generation job and dispatches the chapter worker event", async () => {
    const result = await autoGenerateChapterScenes("project-1", "chapter-1", {
      chapterSummary: "x".repeat(1000),
      sceneCount: 2,
    });

    expect(result).toEqual({ jobId: "job-1" });
    expect(generationJobCreate.mock.calls).toHaveLength(1);

    const jobData = generationJobCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(jobData.data.sourceKind).toBe("chapter");
    expect(jobData.data.sourceId).toBe("chapter-1");
    expect(jobData.data.entrypoint).toBe("gpt-5.4-nano");
    expect(jobData.data.metadataJson).toMatchObject({
      chapterId: "chapter-1",
      sceneCount: 2,
      modelKey: "gpt-5.4-nano",
    });

    expect(sendGenerateChapterScenesEvent.mock.calls).toEqual([
      [{ projectId: "project-1", chapterId: "chapter-1", jobId: "job-1" }],
    ]);
  });

  test("replaces a chapter atomically and archives existing drama videos", async () => {
    chapterFindFirst.mockResolvedValue({
      id: "chapter-1",
      projectId: "project-1",
      tomeId: "tome-1",
      title: "Chapter 1",
      slug: "chapter-1",
      synopsis: "",
      status: "active",
      orderIndex: 0,
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      tome: {
        title: "Tome 1",
      },
    });

    sceneFindMany.mockResolvedValue([
      { id: "scene-old-1" },
      { id: "scene-old-2" },
    ]);
    sceneMangaPageFindMany.mockResolvedValue([
      { id: "page-1" },
      { id: "page-2" },
    ]);
    txSceneFindUnique.mockResolvedValue(null);
    txSceneCreate.mockImplementation(async ({ data }: any) => ({
      id: `scene-${data.orderIndex + 1}`,
      projectId: data.projectId,
      tomeId: data.tomeId,
      chapterId: data.chapterId,
      slug: data.slug,
      title: data.title,
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
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
    }));

    const result = await replaceChapterScenesWithDrafts(
      "project-1",
      "chapter-1",
      [
        {
          title: "Scene one",
          summary: "Intro @chara:asha",
          content: "DIALOGUE: @chara:asha On y va.",
          notes: "",
          sceneType: "action",
          location: "Dock",
          charactersJson: ["asha"],
          tagsJson: ["opening"],
          metadataJson: { tone: "calm" },
        },
        {
          title: "Scene two",
          summary: "Follow-up",
          content: "NARRATION: The wind rises.",
          notes: "",
          sceneType: "transition",
          location: "Dock",
          charactersJson: ["asha"],
          tagsJson: ["bridge"],
          metadataJson: { tone: "tense" },
        },
      ],
      { jobId: "job-1" },
    );

    expect(result.deletedSceneIds).toEqual(["scene-old-1", "scene-old-2"]);
    expect(result.deletedPageIds).toEqual(["page-1", "page-2"]);
    expect(result.createdSceneIds).toEqual(["scene-1", "scene-2"]);

    expect(txSceneMangaPageDeleteMany.mock.calls[0]?.[0]).toMatchObject({
      where: { projectId: "project-1", id: { in: ["page-1", "page-2"] } },
    });
    expect(txSceneDeleteMany.mock.calls[0]?.[0]).toMatchObject({
      where: { projectId: "project-1", id: { in: ["scene-old-1", "scene-old-2"] } },
    });
    expect(txStoryReferenceCreateMany.mock.calls.length).toBeGreaterThan(0);
  });
});
