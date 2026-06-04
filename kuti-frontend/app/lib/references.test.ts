import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReferenceToken,
  createReferenceLinkMatcher,
  filterReferenceOptions,
  getReferenceSyntax,
  normalizeReferenceKind,
  parseReferenceQuery,
} from "./references";

describe("reference helpers", () => {
  test("keeps the character, chapter, tome, file and environment options available in autocomplete", () => {
    const syntaxes = filterReferenceOptions("").map((option) => option.syntax);

    assert.ok(syntaxes.includes("@chara:"));
    assert.ok(syntaxes.includes("@chapter:"));
    assert.ok(syntaxes.includes("@tome:"));
    assert.ok(syntaxes.includes("@file:"));
    assert.ok(syntaxes.includes("@environment:"));
  });

  test("parses chara queries and builds canonical character links", () => {
    const charQuery = parseReferenceQuery("@chara:lemillion");

    assert.equal(charQuery.kindPart, "chara");
    assert.equal(charQuery.kind, "character");
    assert.equal(charQuery.search, "lemillion");
    assert.equal(charQuery.isEntityQuery, true);

    assert.equal(normalizeReferenceKind("chara"), "character");
    assert.equal(
      buildReferenceToken("character", "lemillion"),
      "@chara:lemillion",
    );

    const matcher = createReferenceLinkMatcher(
      (kind, slug) => `/${kind}/${slug}`,
    );
    assert.equal(matcher("See @chara:lemillion")?.url, "/character/lemillion");
  });

  test("parses file and location aliases as canonical entity kinds", () => {
    const fileQuery = parseReferenceQuery("@file:reference-card");

    assert.equal(fileQuery.kindPart, "file");
    assert.equal(fileQuery.kind, "asset");
    assert.equal(fileQuery.search, "reference-card");
    assert.equal(fileQuery.isEntityQuery, true);
    assert.equal(normalizeReferenceKind("location"), "environment");
  });

  test("builds canonical tokens and auto-link matches for every supported type", () => {
    assert.equal(
      buildReferenceToken("asset", "reference-card"),
      "@file:reference-card",
    );
    assert.equal(
      buildReferenceToken("environment", "main-hall"),
      "@environment:main-hall",
    );
    assert.equal(getReferenceSyntax("chapter"), "@chapter:");

    const matcher = createReferenceLinkMatcher(
      (kind, slug) => `/${kind}/${slug}`,
    );

    assert.equal(matcher("See @chapter:chapter-1")?.url, "/chapter/chapter-1");
    assert.equal(matcher("See @tome:tome-zero")?.url, "/tome/tome-zero");
    assert.equal(
      matcher("See @file:reference-card")?.url,
      "/asset/reference-card",
    );
    assert.equal(
      matcher("See @environment:main-hall")?.url,
      "/environment/main-hall",
    );
  });
});
