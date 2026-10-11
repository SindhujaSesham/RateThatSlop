import assert from "node:assert/strict";
import test from "node:test";
import { normalizeServerScore } from "../src/background/listing-cache.js";

test("missing server description scores stay null instead of becoming zero", () => {
  const normalized = normalizeServerScore({
    score: {
      aggregate_score: 0.4,
      description_score: null,
      description_rationale: null,
      calculated_at: new Date().toISOString(),
      images: [],
    },
  });

  assert.equal(normalized.descriptionScore, null);
  assert.equal(normalized.descriptionRationale, "");
});

test("server description scores are preserved when valid", () => {
  const normalized = normalizeServerScore({
    score: {
      aggregate_score: 0.4,
      description_score: 0.72,
      description_rationale: "Detailed rationale",
      calculated_at: new Date().toISOString(),
      images: [],
    },
  });

  assert.equal(normalized.descriptionScore, 0.72);
  assert.equal(normalized.descriptionRationale, "Detailed rationale");
});