import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

function createCompletionResponse() {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: "completion",
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

const fetchMock = mock(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  createCompletionResponse(),
);

const originalFetch = globalThis.fetch;

mock.module("@lib/config", () => ({
  config: {
    storyCompletionModels: [],
    storyCompletionDefaultModel: "gpt-5.4-nano",
    storyCompletionEnabled: true,
    storyCompletionEndpoint: "http://localhost:1234",
    storyCompletionApiKey: "test-key",
  },
}));

const { completeStoryField } = await import("./story-completion");

function getPromptFromCall(callIndex = 0): string {
  const call = fetchMock.mock.calls[callIndex];
  if (!call) throw new Error(`Missing fetch call at index ${callIndex}`);

  const requestInit = call[1];
  const payload = JSON.parse(String(requestInit?.body ?? "{}")) as {
    messages?: Array<{ content?: string }>;
  };

  const prompt = payload.messages?.[1]?.content;
  if (typeof prompt !== "string") {
    throw new Error("Missing user prompt in request payload");
  }

  return prompt;
}

describe("story-completion", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createCompletionResponse(),
    );

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("adds canonical script guidance for scene content completions", async () => {
    await completeStoryField({
      targetKind: "scene",
      field: "content",
      currentValue: "DIALOGUE: @chara:asha On y va.",
      context: {
        scene: {
          title: "Arrivee",
          summary: "",
          content: "",
        },
        characters: [
          {
            name: "Asha",
            slug: "asha",
          },
          {
            name: "Kairo",
            slug: "kairo",
          },
        ],
      },
    });

    const prompt = getPromptFromCall(0);

    expect(prompt).toContain("Pour le champ scene.content");
    expect(prompt).toContain("@chara:");
    expect(prompt).toContain("Asha -> @chara:asha");
    expect(prompt).toContain("Kairo -> @chara:kairo");
    expect(prompt).toContain("DIALOGUE:");
    expect(prompt).toContain("THOUGHT:");
    expect(prompt).toContain("NARRATION:");
    expect(prompt).toContain("DIALOGUE: @chara:asha On y va.");
    expect(prompt).toContain("Valeur actuelle:");
  });

  test("keeps scene.summary in prose and free of script prefixes", async () => {
    await completeStoryField({
      targetKind: "scene",
      field: "summary",
      currentValue: "Asha regarde le quai.",
      context: {
        scene: {
          title: "Arrivee",
          summary: "",
          content: "",
        },
        characters: [
          {
            name: "Asha",
            slug: "asha",
          },
        ],
      },
    });

    const prompt = getPromptFromCall(0);

    expect(prompt).toContain("Pour le champ scene.summary");
    expect(prompt).toContain("resume en prose fluide et concise");
    expect(prompt).not.toContain("Pour le champ scene.content");
    expect(prompt).not.toContain("Exemples:");
    expect(prompt).not.toContain("Inventaire des personnages disponibles dans le contexte:");
    expect(prompt).not.toContain("@chara:");
  });

  test("keeps non-scene completions free of the @chara guidance", async () => {
    await completeStoryField({
      targetKind: "chapter",
      field: "title",
      currentValue: "Chapitre 1",
      context: {
        chapter: {
          title: "Chapitre 1",
        },
      },
    });

    const prompt = getPromptFromCall(0);

    expect(prompt).not.toContain("Pour le champ scene.content");
    expect(prompt).not.toContain("@chara:");
  });
});
