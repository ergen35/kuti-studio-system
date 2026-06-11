import { describe, expect, test } from "bun:test";
import {
  buildCharacterImagePrompt,
  buildScenePanelPrompt,
  buildSceneStoryboardPrompt,
  buildStyleDescription,
  selectActiveCharacterSheet,
} from "./manga-prompts";

describe("manga-prompts", () => {
  test("describes scene styles with a shared canonical wording", () => {
    expect(buildStyleDescription("shonen", "bw")).toBe(
      "Shonen manga style: dynamic action lines, energetic compositions, bold expressions. Black and white ink style with screentones.",
    );
    expect(buildStyleDescription("generic", "color")).toBe(
      "Generic manga scene layout: clean lines, balanced composition, versatile pacing. Full color illustration.",
    );
  });

  test("selects the active character sheet before falling back to the first sheet", () => {
    const activeSheet = selectActiveCharacterSheet([
      { kind: "character_sheet", isActive: false, fileName: "draft.png" },
      { kind: "character_sheet", isActive: true, fileName: "active.png" },
    ]);
    expect(activeSheet).toMatchObject({ fileName: "active.png" });

    const fallbackSheet = selectActiveCharacterSheet([
      { kind: "character_sheet", isActive: false, fileName: "fallback.png" },
      { kind: "free_image", isActive: true, fileName: "free.png" },
    ]);
    expect(fallbackSheet).toMatchObject({ fileName: "fallback.png" });
  });

  test("anchors free image prompts on the active sheet and the reference image", () => {
    const prompt = buildCharacterImagePrompt({
      character: {
        name: "Asha",
        alias: "Ash",
        narrativeRole: "hero",
        description: "A determined young fighter.",
        physicalDescription: "Short hair, scar on the left cheek, athletic build.",
        personality: "Calm under pressure.",
        narrativeArc: "Learns to trust the crew.",
        keyTraitsJson: ["focused", "resilient"],
        colorPaletteJson: ["indigo", "silver"],
        costumeElementsJson: ["hooded jacket", "fingerless gloves"],
        tagsJson: ["lead", "fighter"],
      },
      kind: "free_image",
      strategy: "portrait",
      style: "anime",
      activeCharacterSheet: {
        kind: "character_sheet",
        isActive: true,
        fileName: "asha-sheet.png",
        prompt: "Canonical sheet for Asha with the indigo jacket and scar alignment.",
      },
      referenceImage: {
        kind: "free_image",
        isActive: true,
        fileName: "pose-ref.png",
        prompt: "Pose reference with the same jacket silhouette.",
      },
      variationIndex: 0,
      totalCount: 2,
    });

    expect(prompt).toContain("Mission: create a new free image variation for the same canonical character.");
    expect(prompt).toContain("Use the active character sheet as the canonical visual source of truth.");
    expect(prompt).toContain("Secondary reference image anchor: Pose reference with the same jacket silhouette. Use it only to reinforce likeness, never to override the active sheet.");
    expect(prompt).toContain("Rendering style: anime, high-quality manga/anime concept art, clean linework, stable anatomy, consistent facial proportions.");
    expect(prompt).toContain("No watermark, no subtitle text, no editorial overlay, no UI chrome and no unrelated characters.");
  });

  test("builds storyboard and panel prompts around the canonical sheets and dialogue balloons", () => {
    const storyboardPrompt = buildSceneStoryboardPrompt({
      style: {
        systemPrompt: "Be precise.",
        stylePreset: "shonen",
        colorMode: "bw",
        allowMultiPage: true,
      },
      context: {
        title: "Arrival",
        location: "Harbor dock",
        content: "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.\nNARRATION: Le quai grince sous leurs pas.",
        tomeTitle: "Tome 1",
        chapterTitle: "Chapter 2",
      },
      characters: [
        {
          name: "Asha",
          activeSheet: {
            kind: "character_sheet",
            isActive: true,
            fileName: "asha-sheet.png",
            prompt: "Canonical sheet for Asha.",
          },
          selectedImage: {
            kind: "free_image",
            isActive: true,
            fileName: "asha-ref.png",
            prompt: "Pose reference for Asha.",
          },
        },
      ],
      references: [
        {
          referenceKind: "character",
          targetSlug: "asha",
          rawToken: "@chara:asha",
          resolvedLabel: "Asha",
          description: "character",
          isBroken: false,
        },
      ],
      additionalContext: "Keep the opening quiet.",
    });

    expect(storyboardPrompt).toContain("Use the canonical character sheets and resolved references as the visual ground truth for every page.");
    expect(storyboardPrompt).toContain("Character continuity anchors");
    expect(storyboardPrompt).toContain("Canonical sheet anchor: Canonical sheet for Asha.");
    expect(storyboardPrompt).toContain("Reference image anchor: Pose reference for Asha.");
    expect(storyboardPrompt).toContain("Treat the scene content as canonical script text, not as prose summary.");
    expect(storyboardPrompt).toContain("DIALOGUE: speech bubble with a pointer.");
    expect(storyboardPrompt).toContain("THOUGHT: cloud-shaped bubble for internal monologue.");
    expect(storyboardPrompt).toContain("NARRATION: small narration box in a corner of the panel.");
    expect(storyboardPrompt).toContain("Never merge, paraphrase, summarize or convert one typed line into another type.");
    expect(storyboardPrompt).toContain("Preserve any @chara:<slug> token exactly as written inside a typed line.");
    expect(storyboardPrompt).toContain("Keep the bubble type faithful to the scene content: dialogue, thought and narration must stay distinct.");
    expect(storyboardPrompt).toContain("Preserve the original order of typed lines from the scene content and do not rewrite them into summary beats.");
    expect(storyboardPrompt).toContain("Do not invent new character designs or let the selected reference image override the canonical sheet.");
    expect(storyboardPrompt).toContain("Scene content");
    expect(storyboardPrompt).toContain("DIALOGUE: @chara:asha On y va.");
    expect(storyboardPrompt).toContain("THOUGHT: @chara:kairo Je dois rester calme.");
    expect(storyboardPrompt).toContain("NARRATION: Le quai grince sous leurs pas.");
    expect(storyboardPrompt).not.toContain("Summary:");

    const panelPrompt = buildScenePanelPrompt({
      style: {
        systemPrompt: "Be precise.",
        stylePreset: "shonen",
        colorMode: "bw",
        allowMultiPage: true,
      },
      context: {
        title: "Arrival",
        location: "Harbor dock",
        content: "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.\nNARRATION: Le quai grince sous leurs pas.",
        tomeTitle: "Tome 1",
        chapterTitle: "Chapter 2",
      },
      characters: [{ name: "Asha" }],
      references: [{ referenceKind: "character", targetSlug: "asha", resolvedLabel: "Asha" }],
      panelIndex: 1,
      panelCount: 4,
      beat: "DIALOGUE: @chara:asha On y va.",
      additionalContext: "Keep the panel airy.",
    });

    expect(panelPrompt).toContain("Render panel 2/4 from the storyboard.");
    expect(panelPrompt).toContain("Keep the panel faithful to the canonical character sheets and the resolved story references.");
    expect(panelPrompt).toContain("Render DIALOGUE lines as speech balloons with pointers.");
    expect(panelPrompt).toContain("Render THOUGHT lines as cloud-shaped balloons.");
    expect(panelPrompt).toContain("Render NARRATION lines as small narration boxes in a corner.");
    expect(panelPrompt).toContain("If the beat is typed, keep its exact line order and visual container faithful to the scene content.");
    expect(panelPrompt).toContain("Do not add watermark text, UI chrome, unrelated captions, title cards or extra characters.");
    expect(panelPrompt).toContain("Final rendering: manga panel illustration, expressive, cinematic, high quality, no watermark, no UI chrome, no caption text, no title card and no extra annotations.");
    expect(panelPrompt).toContain("Scene content");
    expect(panelPrompt).toContain("DIALOGUE: @chara:asha On y va.");
    expect(panelPrompt).toContain("THOUGHT: @chara:kairo Je dois rester calme.");
    expect(panelPrompt).toContain("NARRATION: Le quai grince sous leurs pas.");
    expect(panelPrompt).not.toContain("Summary:");
  });
});
