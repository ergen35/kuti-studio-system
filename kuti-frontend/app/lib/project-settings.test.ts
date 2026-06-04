import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  composeProjectSettingsJson,
  getDefaultProjectSettings,
  readProjectSettings,
} from "./project-settings";

describe("project settings helpers", () => {
  test("round-trips structured coherence, generation and preview settings", () => {
    const values = getDefaultProjectSettings();
    values.name = "LeMillion";
    values.status = "active";
    values.locations = "Moon Docks, Lower City";
    values.coherenceRules.orphanCharacter = false;
    values.coherenceRules.brokenReference = true;
    values.coherenceSignals.timelineAnchors = [
      "intro | Intro | 1 | opening",
      "finale | Finale | 2 | closing",
    ].join("\n");
    values.coherenceSignals.requiredToneTags = "noir, moody";
    values.coherenceSignals.forbiddenToneTags = "comedic";
    values.coherenceSignals.continuityFacts =
      "ship-status | operational | project";
    values.coherenceSignals.impossibleFacts = "gravity | zero | project";
    values.coherenceAutomation.autoScanOnSave = false;
    values.generation.defaultModelKey = "gpt_images_2";
    values.generation.defaultMode = "grid";
    values.preview.readingDirection = "ltr";
    values.preview.panelDensity = "compact";
    values.versioning.retainedVersionsPerBranch = 5;
    values.exports.defaultKind = "publication";
    values.exports.defaultFormats = ["paged_images", "pdf"];
    values.language.preferredLocale = "en";
    values.assets.archiveOnDelete = false;
    values.assets.showUsageHints = false;

    const json = composeProjectSettingsJson(
      { keep: "value" },
      values,
    ) as Record<string, unknown> & {
      coherenceSignalsJson: {
        timelineAnchorsJson: Array<{
          slug: string;
          label: string;
          orderIndex: number;
          note: string;
        }>;
        toneProfileJson: {
          requiredTagsJson: string[];
          forbiddenTagsJson: string[];
        };
        continuityFactsJson: Array<{
          key: string;
          value: string;
          scope: string;
        }>;
        impossibleFactsJson: Array<{
          key: string;
          value: string;
          scope: string;
        }>;
      };
      generationSettingsJson: {
        defaultModelKey: string;
        defaultMode: string;
      };
      previewSettingsJson: {
        readingDirection: string;
        panelDensity: string;
      };
      coherenceRulesJson: typeof values.coherenceRules;
      locationsJson: string[];
    };
    const restored = readProjectSettings(json);

    assert.deepEqual(json.keep, "value");
    assert.deepEqual(json.locationsJson, ["Moon Docks", "Lower City"]);
    assert.deepEqual(json.coherenceSignalsJson.timelineAnchorsJson, [
      {
        slug: "intro",
        label: "Intro",
        orderIndex: 1,
        note: "opening",
      },
      {
        slug: "finale",
        label: "Finale",
        orderIndex: 2,
        note: "closing",
      },
    ]);
    assert.deepEqual(json.coherenceSignalsJson.toneProfileJson, {
      requiredTagsJson: ["noir", "moody"],
      forbiddenTagsJson: ["comedic"],
    });
    assert.deepEqual(json.coherenceSignalsJson.continuityFactsJson, [
      {
        key: "ship-status",
        value: "operational",
        scope: "project",
      },
    ]);
    assert.deepEqual(json.coherenceSignalsJson.impossibleFactsJson, [
      {
        key: "gravity",
        value: "zero",
        scope: "project",
      },
    ]);
    assert.deepEqual(json.generationSettingsJson, {
      defaultModelKey: "gpt_images_2",
      defaultMode: "grid",
    });
    assert.deepEqual(json.previewSettingsJson, {
      readingDirection: "ltr",
      panelDensity: "compact",
    });
    assert.deepEqual(json.coherenceRulesJson, values.coherenceRules);
    assert.deepEqual(restored.locations, "Moon Docks, Lower City");
    assert.deepEqual(restored.generation.defaultMode, "grid");
    assert.deepEqual(restored.preview.panelDensity, "compact");
    assert.deepEqual(restored.versioning.retainedVersionsPerBranch, 5);
    assert.deepEqual(restored.exports.defaultFormats, ["paged_images", "pdf"]);
    assert.deepEqual(restored.language.preferredLocale, "en");
    assert.deepEqual(restored.assets.archiveOnDelete, false);
  });

  test("ignores nullish legacy signal entries when reading project settings", () => {
    const restored = readProjectSettings({
      coherenceSignalsJson: {
        timelineAnchorsJson: ["intro | Intro | 1 | opening", "undefined"],
        toneProfileJson: {
          requiredTagsJson: ["noir", "undefined"],
          forbiddenTagsJson: ["comedic"],
        },
        continuityFactsJson: [
          "ship-status | operational | project",
          "undefined",
        ],
        impossibleFactsJson: ["gravity | zero | project", "null"],
      },
    });

    assert.equal(
      restored.coherenceSignals.timelineAnchors,
      "intro | Intro | 1 | opening",
    );
    assert.equal(restored.coherenceSignals.requiredToneTags, "noir");
    assert.equal(
      restored.coherenceSignals.continuityFacts,
      "ship-status | operational | project",
    );
    assert.equal(
      restored.coherenceSignals.impossibleFacts,
      "gravity | zero | project",
    );
  });
});
