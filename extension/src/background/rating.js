const DEFAULT_WEIGHTS = Object.freeze({
  images: 0.60,
  description: 0.15,
  trustedCreator: 0.10,
  etsyReviews: 0.10,
  userReports: 0.05,
});

export const RATING_CONFIG = Object.freeze({
  weights: DEFAULT_WEIGHTS,
  imageAggregation: Object.freeze({
    meanWeight: 0.60,
    highRiskWeight: 0.40,
    highRiskPercentile: 0.90,
  }),
  bands: Object.freeze({
    low: 0.30,
    elevated: 0.60,
    high: 0.80,
  }),
});

const SIGNAL_NAMES = Object.freeze(Object.keys(DEFAULT_WEIGHTS));
const AVAILABLE = "available";

function finiteUnit(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${name} must be a finite number between 0 and 1`);
  }
  return number;
}

export function validateRatingConfig(config = RATING_CONFIG) {
  const weights = config?.weights;
  if (!weights || SIGNAL_NAMES.some((name) => !Object.hasOwn(weights, name))) {
    throw new Error("rating weights must define every configured signal");
  }

  const values = SIGNAL_NAMES.map((name) => finiteUnit(weights[name], `weight ${name}`));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > 0.001) {
    throw new Error("rating weights must sum to 1");
  }

  const aggregation = config.imageAggregation;
  if (!aggregation || aggregation.meanWeight < 0 || aggregation.highRiskWeight < 0 ||
      Math.abs(aggregation.meanWeight + aggregation.highRiskWeight - 1) > 0.001) {
    throw new Error("image aggregation weights must be non-negative and sum to 1");
  }
  finiteUnit(aggregation.highRiskPercentile, "highRiskPercentile");

  const bands = config.bands;
  if (!bands || !(bands.low < bands.elevated && bands.elevated < bands.high)) {
    throw new Error("rating bands must be increasing");
  }
  for (const [name, value] of Object.entries(bands)) finiteUnit(value, `band ${name}`);
  return config;
}

function percentile(values, percentileValue) {
  const position = (values.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

export function aggregateImageScores(images = [], config = RATING_CONFIG) {
  validateRatingConfig(config);
  if (!Array.isArray(images)) throw new Error("images must be an array");

  const scores = images
    .filter((image) => image?.status === AVAILABLE || image?.status === undefined)
    .map((image) => finiteUnit(image.score, "image score"))
    .sort((left, right) => left - right);

  if (!scores.length) {
    return {
      score: null,
      meanScore: null,
      highRiskScore: null,
      imageCount: images.length,
      analyzedCount: 0,
      status: "unavailable",
    };
  }

  const meanScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const highRiskScore = percentile(scores, config.imageAggregation.highRiskPercentile);
  const { meanWeight, highRiskWeight } = config.imageAggregation;
  return {
    score: meanScore * meanWeight + highRiskScore * highRiskWeight,
    meanScore,
    highRiskScore,
    imageCount: images.length,
    analyzedCount: scores.length,
    status: AVAILABLE,
  };
}

function normalizeSignal(signal, name) {
  if (!signal || signal.status !== AVAILABLE) return null;
  return {
    score: finiteUnit(signal.score, `${name} score`),
    confidence: signal.confidence === undefined
      ? 1
      : finiteUnit(signal.confidence, `${name} confidence`),
    reasons: Array.isArray(signal.reasons) ? signal.reasons : [],
  };
}

export function combineSignals(signals, config = RATING_CONFIG) {
  validateRatingConfig(config);
  const normalized = {};
  let weightedScore = 0;
  let availableWeight = 0;

  for (const name of SIGNAL_NAMES) {
    const signal = normalizeSignal(signals?.[name], name);
    normalized[name] = signal;
    if (!signal) continue;
    weightedScore += signal.score * config.weights[name];
    availableWeight += config.weights[name];
  }

  if (!availableWeight) {
    return {
      score: null,
      confidence: 0,
      usedSignals: [],
      unavailableSignals: [...SIGNAL_NAMES],
      signals: normalized,
      status: "unavailable",
    };
  }

  const usedSignals = SIGNAL_NAMES.filter((name) => normalized[name]);
  const confidence = usedSignals.reduce(
    (sum, name) => sum + normalized[name].confidence * config.weights[name],
    0,
  ) / availableWeight;
  return {
    score: weightedScore / availableWeight,
    confidence,
    usedSignals,
    unavailableSignals: SIGNAL_NAMES.filter((name) => !normalized[name]),
    signals: normalized,
    status: AVAILABLE,
  };
}

function bandFor(score, bands) {
  if (score < bands.low) return "low";
  if (score < bands.elevated) return "elevated";
  if (score < bands.high) return "high";
  return "critical";
}

export function rateListing({ images = [], signals = {} } = {}, config = RATING_CONFIG) {
  validateRatingConfig(config);
  const imageEvidence = aggregateImageScores(images, config);
  const combined = combineSignals({
    ...signals,
    images: imageEvidence.status === AVAILABLE
      ? { ...imageEvidence, confidence: imageEvidence.analyzedCount / Math.max(imageEvidence.imageCount, 1) }
      : undefined,
  }, config);

  const reasons = [];
  for (const name of combined.usedSignals) {
    for (const reason of combined.signals[name].reasons) {
      reasons.push({ signal: name, explanation: String(reason) });
    }
  }
  if (imageEvidence.status === AVAILABLE && imageEvidence.highRiskScore >= config.bands.elevated) {
    reasons.push({
      signal: "images",
      explanation: "One or more listing images had an elevated AI-likelihood score.",
    });
  }

  return {
    score: combined.score,
    label: combined.score === null ? "unavailable" : `${bandFor(combined.score, config.bands)}-risk`,
    confidence: combined.confidence,
    confidenceBand: combined.confidence >= 0.75 ? "high"
      : combined.confidence >= 0.4 ? "uncertain" : "low",
    imageEvidence,
    signals: combined.signals,
    usedSignals: combined.usedSignals,
    unavailableSignals: combined.unavailableSignals,
    reasons,
    status: combined.status,
  };
}

validateRatingConfig();
