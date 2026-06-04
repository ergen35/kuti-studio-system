import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getOrderSwap } from "./story-order";

describe("getOrderSwap", () => {
  const items = [
    { id: "a", orderIndex: 2 },
    { id: "b", orderIndex: 0 },
    { id: "c", orderIndex: 1 },
  ];

  test("returns the adjacent item even when input is unsorted", () => {
    const swap = getOrderSwap(items, "c", -1);

    assert.ok(swap);
    assert.equal(swap.current.id, "c");
    assert.equal(swap.target.id, "b");
  });

  test("returns null at the boundaries", () => {
    assert.equal(getOrderSwap(items, "b", -1), null);
    assert.equal(getOrderSwap(items, "a", 1), null);
  });
});
