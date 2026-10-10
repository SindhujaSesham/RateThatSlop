import assert from "node:assert/strict";
import test from "node:test";
import {
  RATING_CONFIG,
  aggregateImageScores,
  combineSignals,
  rateListing,
  validateRatingConfig,
} from "../src/background/rating.js";

test("default weights are configurable and sum to one", () => {
  assert.equal(Object.values(RATING_CONFIG.weights).reduce((sum, value) => sum + value, 0), 1);
  assert.doesNotThrow(() => validateRatingConfig());
});

test("aggregates every available image while retaining individual evidence", () => {
  const result = aggregateImageScores([
    { score: 0.2, status: "available" },
    { score: 0.8, status: "available" },
    { score: 0.6, status: "error" },
  ]);

  assert.equal(result.imageCount, 3);
  assert.equal(result.analyzedCount, 2);
  assert.equal(result.meanScore, 0.5);
  assert.ok(Math.abs(result.highRiskScore - 0.74) < 1e-12);
  assert.ok(Math.abs(result.score - 0.596) < 1e-12);
});

test("does not treat unavailable signals as zero", () => {
  const result = combineSignals({
    images: { score: 0.8, status: "available" },
    description: { score: 0.4, status: "unavailable" },
  });

  assert.equal(result.score, 0.8);
  assert.deepEqual(result.usedSignals, ["images"]);
  assert.ok(result.unavailableSignals.includes("description"));
});

test("returns an unavailable rating when no signal is usable", () => {
  const result = rateListing({ images: [] });
  assert.equal(result.score, null);
  assert.equal(result.label, "unavailable");
  assert.equal(result.status, "unavailable");
});

test("combines image and contextual signals using configured weights", () => {
  const result = rateListing({
    images: [{ score: 0.8, status: "available" }],
    signals: {
      description: {
        score: 0.4,
        confidence: 0.5,
        status: "available",
        reasons: ["Description contains repetitive phrasing"],
      },
    },
  });

  const expected = (0.8 * 0.6 + 0.4 * 0.15) / (0.6 + 0.15);
  assert.equal(result.score, expected);
  assert.equal(result.label, "high-risk");
  assert.equal(result.reasons[0].signal, "description");
  assert.equal(result.reasons[1].signal, "images");
  assert.equal(result.unavailableSignals.includes("etsyReviews"), true);
});

test("rejects invalid weight configurations", () => {
  assert.throws(
    () => validateRatingConfig({
      ...RATING_CONFIG,
      weights: { ...RATING_CONFIG.weights, images: 0.2 },
    }),
    /sum to 1/,
  );
});
