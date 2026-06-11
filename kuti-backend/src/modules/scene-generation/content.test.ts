import { describe, expect, test } from "bun:test";
import { parseSceneContentBeats } from "./content";

describe("scene-generation content", () => {
  test("preserves typed scene script line order and kinds", () => {
    const beats = parseSceneContentBeats(
      "DIALOGUE: @chara:asha On y va.\nTHOUGHT: @chara:kairo Je dois rester calme.\nNARRATION: Le quai grince sous leurs pas.",
      "Arrival",
    );

    expect(beats).toHaveLength(3);
    expect(beats.map((beat) => beat.kind)).toEqual(["dialogue", "thought", "narration"]);
    expect(beats.map((beat) => beat.promptLine)).toEqual([
      "DIALOGUE: @chara:asha On y va.",
      "THOUGHT: @chara:kairo Je dois rester calme.",
      "NARRATION: Le quai grince sous leurs pas.",
    ]);
    expect(beats.every((beat) => beat.explicitPrefix)).toBe(true);
  });

  test("keeps legacy untyped lines with heuristics", () => {
    const beats = parseSceneContentBeats("@chara:asha\nLe quai grince sous leurs pas.", "Arrival");

    expect(beats).toHaveLength(2);
    expect(beats[0]).toMatchObject({
      kind: "dialogue",
      promptLine: "DIALOGUE: @chara:asha",
      explicitPrefix: false,
    });
    expect(beats[1]).toMatchObject({
      kind: "narration",
      promptLine: "NARRATION: Le quai grince sous leurs pas.",
      explicitPrefix: false,
    });
  });
});
