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

const projectFindUnique = createAsyncSpy<[unknown], Record<string, unknown> | null>();
const dramaVideoFindMany = createAsyncSpy<[unknown], Array<Record<string, unknown>>>();
const dramaVideoFindFirst = createAsyncSpy<[unknown], Record<string, unknown> | null>();
const dramaVideoUpdate = createAsyncSpy<[unknown], Record<string, unknown>>();
const sceneMangaPageFindFirst = createAsyncSpy<[unknown], Record<string, unknown> | null>();
const sceneFindFirst = createAsyncSpy<[unknown], Record<string, unknown> | null>();
const tomeFindFirst = createAsyncSpy<[unknown], Record<string, unknown> | null>();
const chapterFindFirst = createAsyncSpy<[unknown], Record<string, unknown> | null>();

const mockDb = {
  project: { findUnique: projectFindUnique },
  dramaVideo: { findMany: dramaVideoFindMany, findFirst: dramaVideoFindFirst, update: dramaVideoUpdate },
  sceneMangaPage: { findFirst: sceneMangaPageFindFirst },
  scene: { findFirst: sceneFindFirst },
  tome: { findFirst: tomeFindFirst },
  chapter: { findFirst: chapterFindFirst },
};

mock.module("@lib/db", () => ({
  db: mockDb,
  prisma: mockDb,
}));

const { listProjectDramaVideos } = await import("./controller");

describe("drama-videos controller", () => {
  beforeEach(() => {
    projectFindUnique.mockReset();
    dramaVideoFindMany.mockReset();
    dramaVideoFindFirst.mockReset();
    dramaVideoUpdate.mockReset();
    sceneMangaPageFindFirst.mockReset();
    sceneFindFirst.mockReset();
    tomeFindFirst.mockReset();
    chapterFindFirst.mockReset();
  });

  test("redacts local filesystem paths from public drama video payloads", async () => {
    projectFindUnique.mockResolvedValue({ id: "project-1" });
    dramaVideoFindMany.mockResolvedValue([
      {
        id: "video-1",
        projectId: "project-1",
        sourceMangaPageId: null,
        jobId: null,
        title: "Fallback render",
        prompt: "Prompt",
        modelKey: "model-x",
        stylePreset: "k-drama",
        status: "failed",
        videoUrl: null,
        durationSeconds: null,
        metadataJson: {
          providerFailureMessage: "ffmpeg failed on /home/kuti/data/projects/demo/generation/drama-videos/input.mp4",
          sourceImageUrl: "file:///tmp/kuti-source.png",
        },
        createdAt: new Date("2026-06-01T12:00:00.000Z"),
        updatedAt: new Date("2026-06-01T12:01:00.000Z"),
        completedAt: null,
        failedAt: new Date("2026-06-01T12:02:00.000Z"),
        errorMessage: "render failed at /home/kuti/data/projects/demo/generation/drama-videos/output.mp4",
      },
    ]);

    const videos = await listProjectDramaVideos("project-1");

    expect(videos).toHaveLength(1);
    expect(videos[0]?.errorMessage).toBe("render failed at [redacted-path]");
    expect(videos[0]?.metadata.providerFailureMessage).toBe("ffmpeg failed on [redacted-path]");
    expect(videos[0]?.metadata.sourceImageUrl).toBeUndefined();
    expect(videos[0]?.source).toBeNull();
  });

  test("archives a drama video without deleting its metadata or source link", async () => {
    sceneMangaPageFindFirst.mockResolvedValue({
      id: "page-1",
      projectId: "project-1",
      sceneId: "scene-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      boardId: "board-1",
      panelId: "panel-1",
      pageNumber: 1,
      imageUrl: "/api/projects/project-1/generation/boards/board-1/panels/panel-1/image",
      label: "Page 1",
      status: "selected",
      metadataJson: {},
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
    });
    sceneFindFirst.mockResolvedValue({
      id: "scene-1",
      projectId: "project-1",
      tomeId: "tome-1",
      chapterId: "chapter-1",
      title: "Scene one",
    });
    tomeFindFirst.mockResolvedValue({
      id: "tome-1",
      projectId: "project-1",
      title: "Tome Zero",
    });
    chapterFindFirst.mockResolvedValue({
      id: "chapter-1",
      projectId: "project-1",
      title: "Chapter 1",
    });

    dramaVideoFindFirst.mockResolvedValue({
      id: "video-1",
      projectId: "project-1",
      sourceMangaPageId: "page-1",
      jobId: "job-1",
      title: "Fallback render",
      prompt: "Prompt",
      modelKey: "model-x",
      stylePreset: "k-drama",
      status: "ready",
      videoPath: null,
      videoUrl: null,
      durationSeconds: null,
      metadataJson: {
        sourceImageUrl: "/api/projects/project-1/generation/boards/board-1/panels/panel-1/image",
      },
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:01:00.000Z"),
      completedAt: null,
      failedAt: null,
      errorMessage: null,
    });
    dramaVideoUpdate.mockResolvedValue({
      id: "video-1",
      projectId: "project-1",
      sourceMangaPageId: "page-1",
      jobId: "job-1",
      title: "Fallback render",
      prompt: "Prompt",
      modelKey: "model-x",
      stylePreset: "k-drama",
      status: "archived",
      videoPath: null,
      videoUrl: null,
      durationSeconds: null,
      metadataJson: {
        sourceImageUrl: "/api/projects/project-1/generation/boards/board-1/panels/panel-1/image",
      },
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:02:00.000Z"),
      completedAt: null,
      failedAt: null,
      errorMessage: null,
    });

    const { archiveDramaVideo } = await import("./controller");
    const archived = await archiveDramaVideo("project-1", "video-1");

    expect(dramaVideoFindFirst.mock.calls).toEqual([[{ where: { id: "video-1", projectId: "project-1" } }]]);
    expect(dramaVideoUpdate.mock.calls).toEqual([[{ where: { id: "video-1" }, data: { status: "archived" } }]]);
    expect(archived?.status).toBe("archived");
    expect(archived?.metadata.sourceImageUrl).toBe("/api/projects/project-1/generation/boards/board-1/panels/panel-1/image");
    expect(archived?.source?.sceneTitle).toBe("Scene one");
  });
});
