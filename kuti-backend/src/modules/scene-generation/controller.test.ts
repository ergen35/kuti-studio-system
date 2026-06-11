import { beforeEach, describe, expect, mock, test } from "bun:test";

const sceneFindFirst = mock(async (): Promise<unknown> => null);
const storyReferenceFindMany = mock(async (): Promise<Array<Record<string, unknown>>> => []);
const projectFindFirst = mock(async (): Promise<unknown> => null);
const sceneGenerationConfigFindFirst = mock(async (): Promise<unknown> => null);

const sceneGenerationEvent = mock(async () => undefined);
const dramaVideoEvent = mock(async () => undefined);

const mockDb = {
  scene: {
    findFirst: sceneFindFirst,
  },
  storyReference: {
    findMany: storyReferenceFindMany,
  },
  project: {
    findFirst: projectFindFirst,
  },
  sceneGenerationConfig: {
    findFirst: sceneGenerationConfigFindFirst,
  },
};

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

mock.module("@lib/inngest", () => ({
  sendGenerateSceneMangaEvent: sceneGenerationEvent,
  sendGenerateDramaVideoEvent: dramaVideoEvent,
}));

const { generateSceneManga, previewPrompt } = await import("./controller");

describe("scene-generation controller", () => {
  beforeEach(() => {
    sceneFindFirst.mockReset();
    storyReferenceFindMany.mockReset();
    projectFindFirst.mockReset();
    sceneGenerationConfigFindFirst.mockReset();
    sceneGenerationEvent.mockReset();
    dramaVideoEvent.mockReset();

    sceneFindFirst.mockResolvedValue({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Arrival",
      location: "Harbor dock",
      summary: "Ignored summary",
      content: "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.\nNARRATION: Le quai grince sous leurs pas.",
      notes: "Keep the exchange tense.",
      charactersJson: [],
      tome: { title: "Tome 1" },
      chapter: { title: "Chapter 2" },
    });

    storyReferenceFindMany.mockResolvedValue([]);
    projectFindFirst.mockResolvedValue({
      settingsJson: { locationsJson: [] },
    });
    sceneGenerationConfigFindFirst.mockResolvedValue({
      id: "config-1",
      name: "Default manga",
      systemPrompt: "Be precise.",
      stylePreset: "shonen",
      colorMode: "bw",
      defaultImageCount: 6,
      allowMultiPage: true,
    });
  });

  test("previewPrompt keeps typed script beats in order and omits the scene summary", async () => {
    const result = await previewPrompt("project-1", "scene-1", {
      panelCount: 3,
    });

    expect(result.systemPrompt).toContain("Treat the scene content as canonical script text, not as prose summary.");
    expect(result.systemPrompt).toContain("DIALOGUE: speech bubble with a pointer.");
    expect(result.prompts).toHaveLength(3);
    expect(result.prompts[0]?.caption).toContain("DIALOGUE: @chara:asha On y va.");
    expect(result.prompts[1]?.caption).toContain("THOUGHT: @chara:kairo Je dois rester calme.");
    expect(result.prompts[2]?.caption).toContain("NARRATION: Le quai grince sous leurs pas.");
    expect(result.prompts[0]?.prompt).toContain("Scene content");
    expect(result.prompts[0]?.prompt).not.toContain("Summary:");
    expect(result.prompts[0]?.prompt).not.toContain("Ignored summary");
  });

  test("previewPrompt keeps short canonical @chara beats visible", async () => {
    sceneFindFirst.mockResolvedValueOnce({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Arrival",
      location: "Harbor dock",
      summary: "Ignored summary",
      content: "@chara:asha\n@chara:kairo\nLe quai grince.",
      notes: "Keep the exchange tense.",
      charactersJson: [],
      tome: { title: "Tome 1" },
      chapter: { title: "Chapter 2" },
    });

    const result = await previewPrompt("project-1", "scene-1", {
      panelCount: 2,
    });

    expect(result.prompts[0]?.caption).toContain("@chara:asha");
    expect(result.prompts[1]?.caption).toContain("@chara:kairo");
    expect(result.prompts[0]?.prompt).toContain("@chara:asha");
  });

  test("previewPrompt rejects empty scene content before building the prompt", async () => {
    sceneFindFirst.mockResolvedValueOnce({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Arrival",
      location: "Harbor dock",
      summary: "Ignored summary",
      content: "   ",
      notes: "Keep the exchange tense.",
      charactersJson: [],
      tome: { title: "Tome 1" },
      chapter: { title: "Chapter 2" },
    });

    await expect(previewPrompt("project-1", "scene-1", { panelCount: 2 })).rejects.toThrow(
      "Scene content is required before manga preview",
    );
    expect(storyReferenceFindMany.mock.calls).toHaveLength(0);
    expect(projectFindFirst.mock.calls).toHaveLength(0);
    expect(sceneGenerationConfigFindFirst.mock.calls).toHaveLength(0);
  });

  test("generateSceneManga rejects empty scene content before queuing a job", async () => {
    sceneFindFirst.mockResolvedValueOnce({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Arrival",
      location: "Harbor dock",
      summary: "Ignored summary",
      content: "",
      notes: "Keep the exchange tense.",
      charactersJson: [],
      tome: { title: "Tome 1" },
      chapter: { title: "Chapter 2" },
    });

    await expect(
      generateSceneManga("project-1", "scene-1", {
        imageCount: 2,
      }),
    ).rejects.toThrow("Scene content is required before manga generation");

    expect(sceneGenerationConfigFindFirst.mock.calls).toHaveLength(0);
    expect(sceneGenerationEvent.mock.calls).toHaveLength(0);
  });
});
