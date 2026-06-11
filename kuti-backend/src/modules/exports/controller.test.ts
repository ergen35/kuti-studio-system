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
    mockReturnValue: (value: TResult) => {
      implementation = () => value;
    },
    mockImplementation: (fn: (...args: TArgs) => TResult | Promise<TResult>) => {
      implementation = fn;
    },
  }) as ((...args: TArgs) => Promise<TResult>) & {
    mock: { calls: TArgs[] };
    mockReset: () => void;
    mockResolvedValue: (value: TResult) => void;
    mockReturnValue: (value: TResult) => void;
    mockImplementation: (fn: (...args: TArgs) => TResult | Promise<TResult>) => void;
  };

  return spy;
}

function createSyncSpy<TArgs extends Array<unknown>, TResult>() {
  let implementation: (...args: TArgs) => TResult = () => undefined as TResult;

  const state = { calls: [] as TArgs[] };
  const spy = Object.assign((...args: TArgs): TResult => {
    state.calls.push(args);
    return implementation(...args);
  }, {
    mock: state,
    mockReset: () => {
      state.calls = [];
      implementation = () => undefined as TResult;
    },
    mockReturnValue: (value: TResult) => {
      implementation = () => value;
    },
    mockImplementation: (fn: (...args: TArgs) => TResult) => {
      implementation = fn;
    },
  }) as ((...args: TArgs) => TResult) & {
    mock: { calls: TArgs[] };
    mockReset: () => void;
    mockReturnValue: (value: TResult) => void;
    mockImplementation: (fn: (...args: TArgs) => TResult) => void;
  };

  return spy;
}

const projectFindUnique = createAsyncSpy<[unknown], { id: string } | null>();
const exportRecordCreate = createAsyncSpy<[any], any>();
const sendExportProjectEvent = createAsyncSpy<[any], void>();
const sendDeleteProjectEvent = createAsyncSpy<[any], void>();
const sendGenerateSceneMangaEvent = createAsyncSpy<[any], void>();
const sendGenerateDramaVideoEvent = createAsyncSpy<[any], void>();
const sendGenerateChapterScenesEvent = createAsyncSpy<[any], void>();
const captureVersionSnapshot = createAsyncSpy<[string], unknown>();
const summarizeVersionSnapshot = createSyncSpy<[unknown], unknown>();

mock.module("@lib/db", () => ({
  db: {
    project: {
      findUnique: projectFindUnique,
    },
    exportRecord: {
      create: exportRecordCreate,
    },
  },
  prisma: {
    project: {
      findUnique: projectFindUnique,
    },
    exportRecord: {
      create: exportRecordCreate,
    },
  },
}));

mock.module("@lib/inngest", () => ({
  sendExportProjectEvent,
  sendDeleteProjectEvent,
  sendGenerateSceneMangaEvent,
  sendGenerateDramaVideoEvent,
  sendGenerateChapterScenesEvent,
}));

mock.module("@lib/version-snapshot", () => ({
  captureVersionSnapshot,
  summarizeVersionSnapshot,
}));

const { createExport } = await import("./controller");

function buildExportRecord(data: any) {
  const now = new Date("2026-06-01T12:00:00.000Z");

  return {
    id: "export-1",
    projectId: data.projectId,
    kind: data.kind,
    format: data.format,
    status: data.status,
    label: data.label,
    summary: data.summary,
    artifactPath: null,
    artifactName: null,
    metadataJson: data.metadataJson,
    sizeBytes: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
  };
}

describe("createExport", () => {
  beforeEach(() => {
    projectFindUnique.mockReset();
    exportRecordCreate.mockReset();
    sendExportProjectEvent.mockReset();
    sendDeleteProjectEvent.mockReset();
    sendGenerateSceneMangaEvent.mockReset();
    sendGenerateDramaVideoEvent.mockReset();
    sendGenerateChapterScenesEvent.mockReset();
    captureVersionSnapshot.mockReset();
    summarizeVersionSnapshot.mockReset();
  });

  test("stores the source snapshot summary in export metadata and enqueues the export", async () => {
    const sourceSnapshot = {
      schemaVersion: 1,
      capturedAt: "2026-06-01T11:59:00.000Z",
      project: {
        id: "project-1",
        name: "Nebula",
        slug: "nebula",
        status: "active",
      },
      counts: {
        characters: 3,
        tomes: 1,
        chapters: 2,
        scenes: 5,
      },
    };

    projectFindUnique.mockResolvedValue({ id: "project-1" });
    captureVersionSnapshot.mockResolvedValue({});
    summarizeVersionSnapshot.mockReturnValue(sourceSnapshot);
    exportRecordCreate.mockImplementation(async ({ data }) => buildExportRecord(data));

    const result = await createExport("project-1", {
      kind: "publication",
      format: "paged_images",
      label: "Publication export",
      summary: "Ready for print",
    });

    expect(result).not.toBeNull();
    expect(exportRecordCreate.mock.calls.length).toBe(1);

    const createArgs = exportRecordCreate.mock.calls[0]?.[0] as any;
    expect(createArgs.data.metadataJson.sourceSnapshot).toEqual(sourceSnapshot);

    expect(sendExportProjectEvent.mock.calls.length).toBe(1);
    expect(sendExportProjectEvent.mock.calls[0]?.[0]).toEqual({
      projectId: "project-1",
      exportId: "export-1",
      kind: "publication",
      format: "paged_images",
    });

    expect(result?.metadataJson.sourceSnapshot).toEqual(sourceSnapshot);
  });
});
