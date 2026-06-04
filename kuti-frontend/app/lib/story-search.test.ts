import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildStorySearchResults } from "./story-search";

describe("buildStorySearchResults", () => {
  const source = {
    projectId: "project-1",
    tomes: [
      {
        id: "tome-1",
        title: "Le Royaume Perdu",
        synopsis: "Saga épique",
        slug: "royaume-perdu",
      },
    ],
    chapters: [
      {
        id: "chapter-1",
        tomeId: "tome-1",
        title: "L'Arrivée",
        synopsis: "Le héros arrive",
        slug: "arrivee",
      },
    ],
    scenes: [
      {
        id: "scene-1",
        tomeId: "tome-1",
        chapterId: "chapter-1",
        title: "Face au dragon",
        sceneType: "action",
        location: "Ruines anciennes",
        summary: "Le combat commence",
        content: "Le dragon rouge surgit au-dessus du pont.",
        notes: "Faire ressortir l'ombre du dragon.",
        tagsJson: ["combat", "dragon"],
        slug: "face-au-dragon",
      },
    ],
  };

  test("matches across content, notes and tags with accent-insensitive search", () => {
    const results = buildStorySearchResults(source, "dragon rouge");

    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, "scene");
    assert.ok(results[0]?.matchedFields.includes("content"));
    assert.ok(results[0]?.excerpt.toLowerCase().includes("dragon rouge"));
  });

  test("matches chapters and tomes from synopsis and title", () => {
    const results = buildStorySearchResults(source, "saga épique");

    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, "tome");
    assert.ok(results[0]?.matchedFields.includes("synopsis"));
  });

  test("builds a navigable scene result with the correct chapter and tome path", () => {
    const results = buildStorySearchResults(source, "dragon rouge");

    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, "scene");
    assert.equal(
      results[0]?.href,
      "/projects/project-1/story/tome-1/scenes/scene-1",
    );
    assert.equal(results[0]?.pathLabel, "Le Royaume Perdu · L'Arrivée");
    assert.ok(results[0]?.matchedFields.includes("content"));
  });
});
