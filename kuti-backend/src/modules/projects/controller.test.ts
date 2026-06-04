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

let projectStore: {
  id: string;
  name: string;
  slug: string;
  status: string;
  rootPath: string;
  settingsJson: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedAt: Date | null;
  archivedAt: Date | null;
} | null = null;

const projectFindUnique = createAsyncSpy<[unknown], any>();
const projectUpdate = createAsyncSpy<[unknown], any>();

mock.module("@lib/config", () => ({
  config: {
    dataDir: "/data",
    assetsDir: "/public",
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
  db: {
    project: {
      findUnique: projectFindUnique,
      update: projectUpdate,
    },
  },
  prisma: {
    project: {
      findUnique: projectFindUnique,
      update: projectUpdate,
    },
  },
}));

const { getProject, updateProject } = await import("./controller");
const { readProjectGenerationSettings } = await import("@lib/project-settings");
const { readCoherenceRules } = await import("@lib/coherence-settings");

describe("projects controller settings persistence", () => {
  beforeEach(() => {
    projectStore = {
      id: "project-1",
      name: "LeMillion",
      slug: "lemillion",
      status: "draft",
      rootPath: "/data/projects/lemillion",
      settingsJson: {
        generationSettingsJson: {
          defaultModelKey: "gpt_images_2",
          defaultMode: "separate",
        },
        coherenceRulesJson: {
          orphanCharacter: true,
        },
      },
      createdAt: new Date("2026-06-01T10:00:00.000Z"),
      updatedAt: new Date("2026-06-01T10:00:00.000Z"),
      lastOpenedAt: null,
      archivedAt: null,
    };

    projectFindUnique.mockReset();
    projectUpdate.mockReset();

    projectFindUnique.mockImplementation(async ({ where }: any) => {
      if (where?.id === projectStore?.id) {
        return projectStore;
      }

      return null;
    });

    projectUpdate.mockImplementation(async ({ where, data }: any) => {
      if (!projectStore || where?.id !== projectStore.id) {
        throw new Error("project_not_found");
      }

      projectStore = {
        ...projectStore,
        name: data.name ?? projectStore.name,
        status: data.status ?? projectStore.status,
        settingsJson: data.settingsJson ?? projectStore.settingsJson,
        updatedAt: new Date("2026-06-01T12:00:00.000Z"),
      };

      return projectStore;
    });
  });

  test("persists generation settings and reloads them after update", async () => {
    const nextSettingsJson = {
      generationSettingsJson: {
        defaultModelKey: "gpt_images_2",
        defaultMode: "grid",
      },
      coherenceRulesJson: {
        orphanCharacter: false,
      },
    };

    const updated = await updateProject("project-1", {
      name: "LeMillion",
      status: "active",
      settingsJson: nextSettingsJson,
    });

    expect(updated?.settingsJson).toEqual(nextSettingsJson);
    expect(readProjectGenerationSettings(updated?.settingsJson).defaultMode).toBe("grid");

    const reloaded = await getProject("project-1");

    expect(reloaded?.settingsJson).toEqual(nextSettingsJson);
    expect(readProjectGenerationSettings(reloaded?.settingsJson).defaultMode).toBe("grid");
    expect(projectUpdate.mock.calls).toHaveLength(1);
  });

  test("persists coherence settings and reloads them after update", async () => {
    const nextSettingsJson = {
      generationSettingsJson: {
        defaultModelKey: "gpt_images_2",
        defaultMode: "separate",
      },
      coherenceRulesJson: {
        orphanCharacter: false,
        brokenReference: true,
        emptyScene: true,
        locationConflict: false,
      },
      coherenceSignalsJson: {
        timelineAnchorsJson: [
          {
            slug: "intro",
            label: "Intro",
            orderIndex: 0,
            note: "",
          },
        ],
        toneProfileJson: {
          requiredTagsJson: ["noir"],
          forbiddenTagsJson: ["comedic"],
        },
      },
    };

    const updated = await updateProject("project-1", {
      name: "LeMillion",
      status: "active",
      settingsJson: nextSettingsJson,
    });

    expect(updated?.settingsJson).toEqual(nextSettingsJson);
    expect(readCoherenceRules(updated?.settingsJson).locationConflict).toBe(false);
    expect(readCoherenceRules(updated?.settingsJson).orphanCharacter).toBe(false);

    const reloaded = await getProject("project-1");

    expect(reloaded?.settingsJson).toEqual(nextSettingsJson);
    expect(readCoherenceRules(reloaded?.settingsJson).locationConflict).toBe(false);
    expect(readCoherenceRules(reloaded?.settingsJson).orphanCharacter).toBe(false);
  });
});
