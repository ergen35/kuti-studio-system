import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveTaskSourceEntity } from "./resolve";
import { jobToTaskItem, warningToTaskItem } from "./types";

describe("task helpers", () => {
  test("maps generation jobs to technical tasks with a usable description", () => {
    const task = jobToTaskItem({
      id: "job-1",
      title: "Scene generation",
      status: "running",
      sourceKind: "scene",
      sourceLabel: "La concussion",
      sourceId: "scene-1",
      progress: 42,
      createdAt: "2026-06-02T12:00:00.000Z",
      summary: "Generate a noir scene",
      prompt: "Render the scene",
      metadataJson: {},
    } as any);

    assert.equal(task.taskType, "technical");
    assert.equal(task.priority, "high");
    assert.equal(task.description, "Generate a noir scene");
    assert.equal(task.sourceEntity?.kind, "scene");
    assert.equal(task.sourceEntity?.id, "scene-1");
  });

  test("maps open warnings to editorial tasks", () => {
    const task = warningToTaskItem({
      id: "warning-1",
      projectId: "project-1",
      fingerprint: "tone_break-scene-1",
      kind: "tone_break",
      severity: "warning",
      status: "open",
      title: "Tone break: La concussion",
      message: "Scene tone conflicts with the project settings.",
      entityKind: "scene",
      entityId: "scene-1",
      metadataJson: {
        sceneTitle: "La concussion",
      },
      createdAt: "2026-06-02T12:00:00.000Z",
      updatedAt: "2026-06-02T12:00:00.000Z",
      resolvedAt: null,
    } as any);

    assert.equal(task.taskType, "editorial");
    assert.equal(task.status, "pending");
    assert.equal(task.priority, "high");
    assert.equal(task.sourceLabel, "La concussion");
    assert.equal(
      task.description,
      "Scene tone conflicts with the project settings.",
    );
  });

  test("resolves task source hrefs from story data and characters", () => {
    const task = resolveTaskSourceEntity(
      warningToTaskItem({
        id: "warning-2",
        projectId: "project-1",
        fingerprint: "broken-ref-scene-1",
        kind: "broken_reference",
        severity: "critical",
        status: "open",
        title: "Broken scene reference",
        message: "Missing reference",
        entityKind: "character",
        entityId: "character-1",
        metadataJson: {
          characterName: "Prince Tameyo",
        },
        createdAt: "2026-06-02T12:00:00.000Z",
        updatedAt: "2026-06-02T12:00:00.000Z",
        resolvedAt: null,
      } as any),
      {
        projectId: "project-1",
        story: {
          tomes: [],
          chapters: [],
          scenes: [],
          references: [],
          orphanReferences: [],
        } as any,
        characters: [
          {
            id: "character-1",
            name: "Prince Tameyo",
            slug: "prince-tameyo",
          },
        ] as any,
      },
    );

    assert.equal(
      task.sourceEntity?.href,
      "/projects/project-1/characters/character-1",
    );
    assert.equal(task.sourceEntity?.label, "Prince Tameyo");
  });
});
