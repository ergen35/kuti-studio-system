import { describe, expect, test } from "bun:test";
import { readCoherenceSignals } from "./coherence-settings";

describe("coherence settings", () => {
  test("reads structured coherence signals", () => {
    const signals = readCoherenceSignals({
      coherenceSignalsJson: {
        timelineAnchorsJson: [
          {
            slug: "intro",
            label: "Intro",
            orderIndex: 1,
            note: "opening",
          },
        ],
        toneProfileJson: {
          requiredTagsJson: ["noir"],
          forbiddenTagsJson: ["comedic"],
        },
        continuityFactsJson: [
          {
            key: "ship-status",
            value: "operational",
            scope: "project",
          },
        ],
        impossibleFactsJson: [
          {
            key: "gravity",
            value: "zero",
            scope: "project",
          },
        ],
      },
    });

    expect(signals.timelineAnchors).toEqual([
      {
        slug: "intro",
        label: "Intro",
        orderIndex: 1,
        note: "opening",
      },
    ]);
    expect(signals.toneProfile).toEqual({
      requiredTags: ["noir"],
      forbiddenTags: ["comedic"],
    });
    expect(signals.continuityFacts).toEqual([
      {
        key: "ship-status",
        value: "operational",
        scope: "project",
      },
    ]);
    expect(signals.impossibleFacts).toEqual([
      {
        key: "gravity",
        value: "zero",
        scope: "project",
      },
    ]);
  });

  test("reads legacy string arrays and ignores nullish sentinel values", () => {
    const signals = readCoherenceSignals({
      coherenceSignalsJson: {
        timelineAnchorsJson: [
          "intro | Intro | 1 | opening",
          "undefined",
        ],
        toneProfileJson: {
          requiredTagsJson: ["noir", "undefined"],
          forbiddenTagsJson: ["comedic", "null"],
        },
        continuityFactsJson: [
          "ship-status | operational | project",
          "undefined",
        ],
        impossibleFactsJson: [
          "gravity | zero | project",
          "null",
        ],
      },
    });

    expect(signals.timelineAnchors).toEqual([
      {
        slug: "intro",
        label: "Intro",
        orderIndex: 1,
        note: "opening",
      },
    ]);
    expect(signals.toneProfile).toEqual({
      requiredTags: ["noir"],
      forbiddenTags: ["comedic"],
    });
    expect(signals.continuityFacts).toEqual([
      {
        key: "ship-status",
        value: "operational",
        scope: "project",
      },
    ]);
    expect(signals.impossibleFacts).toEqual([
      {
        key: "gravity",
        value: "zero",
        scope: "project",
      },
    ]);
  });
});
