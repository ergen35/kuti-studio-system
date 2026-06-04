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

const assetFindFirst = createAsyncSpy<[unknown], any>();
const assetFindMany = createAsyncSpy<[unknown], any[]>();
const assetUpdate = createAsyncSpy<[unknown], any>();
const assetDelete = createAsyncSpy<[unknown], any>();
const assetDeleteMany = createAsyncSpy<[unknown], any>();
const assetLinkFindFirst = createAsyncSpy<[unknown], any>();
const assetLinkDelete = createAsyncSpy<[unknown], any>();
const assetLinkDeleteMany = createAsyncSpy<[unknown], any>();
const projectFindUnique = createAsyncSpy<[unknown], any>();

mock.module("@lib/db", () => ({
  db: {
    asset: {
      findFirst: assetFindFirst,
      findMany: assetFindMany,
      update: assetUpdate,
      delete: assetDelete,
      deleteMany: assetDeleteMany,
    },
    assetLink: {
      findFirst: assetLinkFindFirst,
      delete: assetLinkDelete,
      deleteMany: assetLinkDeleteMany,
    },
    project: {
      findUnique: projectFindUnique,
    },
    characterImage: {
      findMany: createAsyncSpy<[unknown], any[]>(),
    },
    generationBoardPanel: {
      findMany: createAsyncSpy<[unknown], any[]>(),
    },
    character: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    scene: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    chapter: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    tome: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
  },
  prisma: {
    asset: {
      findFirst: assetFindFirst,
      findMany: assetFindMany,
      update: assetUpdate,
      delete: assetDelete,
      deleteMany: assetDeleteMany,
    },
    assetLink: {
      findFirst: assetLinkFindFirst,
      delete: assetLinkDelete,
      deleteMany: assetLinkDeleteMany,
    },
    project: {
      findUnique: projectFindUnique,
    },
    characterImage: {
      findMany: createAsyncSpy<[unknown], any[]>(),
    },
    generationBoardPanel: {
      findMany: createAsyncSpy<[unknown], any[]>(),
    },
    character: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    scene: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    chapter: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
    tome: {
      findFirst: createAsyncSpy<[unknown], any>(),
    },
  },
}));

const { deleteAsset, deleteAssetLink } = await import("./controller");

describe("assets controller", () => {
  beforeEach(() => {
    assetFindFirst.mockReset();
    assetFindMany.mockReset();
    assetUpdate.mockReset();
    assetDelete.mockReset();
    assetDeleteMany.mockReset();
    assetLinkFindFirst.mockReset();
    assetLinkDelete.mockReset();
    assetLinkDeleteMany.mockReset();
    projectFindUnique.mockReset();
  });

  test("archives an asset instead of deleting it when archiveOnDelete is enabled", async () => {
    assetFindFirst.mockResolvedValue({
      id: "asset-1",
      projectId: "project-1",
      status: "active",
      storagePath: "/data/projects/lemillion/assets/images/smoke-card.png",
    });
    projectFindUnique.mockResolvedValue({ settingsJson: { assetSettingsJson: { archiveOnDelete: true } } });
    assetUpdate.mockResolvedValue({
      id: "asset-1",
      projectId: "project-1",
      status: "archived",
      tagsJson: [],
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      archivedAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    const result = await deleteAsset("project-1", "asset-1");

    expect(result).toBe(true);
    expect(assetUpdate.mock.calls).toHaveLength(1);
    expect(assetLinkDeleteMany.mock.calls).toHaveLength(0);
    expect(assetDelete.mock.calls).toHaveLength(0);
  });

  test("deletes a link without deleting the asset file", async () => {
    assetLinkFindFirst.mockResolvedValue({
      id: "link-1",
      projectId: "project-1",
      assetId: "asset-1",
      targetKind: "scene",
      targetId: "scene-1",
      note: "",
    });

    const result = await deleteAssetLink("project-1", "asset-1", "link-1");

    expect(result).toBe(true);
    expect(assetLinkDelete.mock.calls).toHaveLength(1);
    expect(assetLinkDelete.mock.calls[0]?.[0]).toEqual({ where: { id: "link-1" } });
  });
});
