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

const sendSpy = createAsyncSpy<[any], void>();
const clientModulePath = new URL("./client.ts", import.meta.url).pathname;

mock.module(clientModulePath, () => ({
  inngest: {
    send: sendSpy,
  },
}));

const {
  buildChildState,
  buildChildrenFromResults,
  progressForIndex,
} = await import("./generate-job-core");

const { sendGenerationRunEvent } = await import("./generate-job-events");

describe("generate-job core", () => {
  beforeEach(() => {
    sendSpy.mockReset();
  });

  test("sends the generation run event with a stable idempotency key", async () => {
    await sendGenerationRunEvent({ jobId: "job-123" });

    expect(sendSpy.mock.calls.length).toBe(1);
    expect(sendSpy.mock.calls[0]?.[0]).toEqual({
      id: "generation-run-job-123",
      name: "kuti/generation.run",
      data: { jobId: "job-123" },
    });
  });

  test("builds child states for pending, running, ready and failed transitions", () => {
    const seeded = [
      {
        unit: {
          kind: "scene" as const,
          sourceId: "scene-1",
          title: "Opening",
          sourceLabel: "Opening",
          summary: "Setup",
          content: "",
          notes: "",
          orderIndex: 0,
          context: {},
        },
        stepId: "step-1",
        panelId: "panel-1",
      },
      {
        unit: {
          kind: "scene" as const,
          sourceId: "scene-2",
          title: "Conflict",
          sourceLabel: "Conflict",
          summary: "Tension",
          content: "",
          notes: "",
          orderIndex: 1,
          context: {},
        },
        stepId: "step-2",
        panelId: "panel-2",
      },
      {
        unit: {
          kind: "scene" as const,
          sourceId: "scene-3",
          title: "Resolution",
          sourceLabel: "Resolution",
          summary: "Closure",
          content: "",
          notes: "",
          orderIndex: 2,
          context: {},
        },
        stepId: "step-3",
        panelId: "panel-3",
      },
    ];

    const snapshot = buildChildState(seeded[0], "pending", 0, null);
    expect(snapshot.status).toBe("pending");
    expect(snapshot.progress).toBe(0);

    const readyResult = {
      stepId: "step-1",
      panelId: "panel-1",
      title: "Opening",
      caption: "Setup",
      prompt: "prompt-1",
      imagePath: "/tmp/1.png",
      imageName: "1.png",
      status: "ready" as const,
      errorMessage: null,
    };

    const failedResult = {
      stepId: "step-2",
      panelId: "panel-2",
      title: "Conflict",
      caption: "Tension",
      prompt: "prompt-2",
      imagePath: null,
      imageName: null,
      status: "failed" as const,
      errorMessage: "boom",
    };

    const children = buildChildrenFromResults(seeded, [readyResult, failedResult], seeded.length);

    expect(children).toHaveLength(3);
    expect(children[0]?.status).toBe("ready");
    expect(children[0]?.progress).toBe(100);
    expect(children[1]?.status).toBe("failed");
    expect(children[1]?.progress).toBe(0);
    expect(children[1]?.errorMessage).toBe("boom");
    expect(children[2]?.status).toBe("pending");
    expect(children[2]?.progress).toBe(100);
  });

  test("computes panel progress inside the configured window", () => {
    expect(progressForIndex(0, 4, 5, 80)).toBe(25);
    expect(progressForIndex(3, 4, 5, 80)).toBe(85);
    expect(progressForIndex(0, 0, 5, 80)).toBe(100);
  });
});
