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

const rmSpy = createAsyncSpy<[string, { recursive: boolean; force: boolean }], void>();
const projectFindUnique = createAsyncSpy<[any], any>();
const projectDelete = createAsyncSpy<[any], any>();

process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/kutistudio";

mock.module("./client", () => ({
  inngest: {
    createFunction: (_options: unknown, fn: unknown) => ({ fn }),
  },
}));

mock.module("@lib/db", () => ({
  prisma: {
    project: {
      findUnique: projectFindUnique,
      delete: projectDelete,
    },
  },
  db: {
    project: {
      findUnique: projectFindUnique,
      delete: projectDelete,
    },
  },
}));

mock.module("node:fs/promises", () => ({
  rm: rmSpy,
}));

const { deleteProjectFunction } = await import("./delete-project");

describe("deleteProjectFunction", () => {
  beforeEach(() => {
    rmSpy.mockReset();
    projectFindUnique.mockReset();
    projectDelete.mockReset();

    projectFindUnique.mockResolvedValue({
      id: "project-1",
      name: "Project One",
      rootPath: "./kuti-data/projects/project-one",
    });
    projectDelete.mockResolvedValue({ id: "project-1" });
  });

  test("removes the filesystem project root and public project directory", async () => {
    const result = await (deleteProjectFunction as any).fn({
      event: {
        data: {
          projectId: "project-1",
          jobId: "job-1",
        },
      },
      step: {
        run: async (_name: string, callback: () => Promise<unknown> | unknown) => callback(),
      },
    } as any);

    expect(result).toEqual({
      jobId: "job-1",
      projectId: "project-1",
      projectName: "Project One",
      status: "completed",
    });

    expect(rmSpy.mock.calls).toEqual([
      ["./kuti-data/projects/project-one", { recursive: true, force: true }],
      ["public/projects/project-1", { recursive: true, force: true }],
    ]);

    expect(projectDelete.mock.calls).toEqual([[{ where: { id: "project-1" } }]]);
  });
});
