// Model orchestration service: owns the cache and forwards image requests to
// the offscreen document, where ONNX Runtime can decode and process images.

const OFFSCREEN_URL = "src/background/offscreen.html";
const MODEL_VERSION_FALLBACK = "unknown";
const CACHE_MAX = 3000;
const MAX_IMAGES = 100;
const CACHE_STORAGE_PREFIX = "inference:";
const POST_STORAGE_PREFIX = "post:";
const SCRAPING_ENABLED_KEY = "scrapingEnabled";
const cache = new Map();
const inflight = new Map();
let offscreenReady = null;
let modelManifestPromise = null;

async function modelManifest() {
  if (!modelManifestPromise) {
    modelManifestPromise = fetch(chrome.runtime.getURL("model_manifest.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`model manifest fetch failed: ${response.status}`);
        return response.json();
      });
  }
  return modelManifestPromise;
}

function validateManifest(manifest) {
  const threshold = Number(manifest.threshold);
  if (!manifest.version || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error("model manifest has invalid version or threshold");
  }
  return { ...manifest, threshold };
}

function cacheKeyFor(imageHash) {
  return `sha256:${imageHash}`;
}

async function hashImageInputs(imageUrl, imageData) {
  await ensureOffscreen();
  const response = await chrome.runtime.sendMessage({
    kind: "aid:hash-image",
    imageUrl,
    imageData,
  });
  if (!response?.ok || typeof response.imageId !== "string" || !response.imageId) {
    throw new Error(response?.error || "image hashing failed");
  }
  return response.imageId;
}

async function ensureOffscreen() {
  if (!offscreenReady) {
    offscreenReady = (async () => {
      if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
          url: OFFSCREEN_URL,
          reasons: ["WORKERS"],
          justification: "Runs local ONNX image inference without uploading images.",
        });
      }
    })().catch((error) => {
      offscreenReady = null;
      throw error;
    });
  }
  return offscreenReady;
}

async function cacheGet(key) {
  if (cache.has(key)) return cache.get(key);
  const stored = await chrome.storage.local.get(`${CACHE_STORAGE_PREFIX}${key}`);
  const value = stored[`${CACHE_STORAGE_PREFIX}${key}`];
  if (value) cache.set(key, value);
  return value;
}

async function cachePut(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
    await chrome.storage.local.remove(`${CACHE_STORAGE_PREFIX}${oldestKey}`);
  }
  cache.set(key, value);
  await chrome.storage.local.set({ [`${CACHE_STORAGE_PREFIX}${key}`]: value });
}

async function cachedResultsFor(imageUrls) {
  await ensureOffscreen();
  const hashResponse = await chrome.runtime.sendMessage({
    kind: "aid:hash-images",
    imageUrls,
  });
  if (!hashResponse?.ok) {
    throw new Error(hashResponse?.error || "image hashing failed");
  }
  const hashes = hashResponse.hashes || {};
  const keys = imageUrls.map((imageUrl) =>
    typeof hashes[imageUrl] === "string" ? cacheKeyFor(hashes[imageUrl]) : "",
  );
  const missingKeys = keys.filter((key) => !cache.has(key));
  if (missingKeys.length) {
    const stored = await chrome.storage.local.get(
      missingKeys.map((key) => `${CACHE_STORAGE_PREFIX}${key}`),
    );
    for (const key of missingKeys) {
      const value = stored[`${CACHE_STORAGE_PREFIX}${key}`];
      if (value) cache.set(key, value);
    }
  }
  const results = Object.fromEntries(
    imageUrls
      .map((imageUrl, index) => [imageUrl, {
        hash: hashes[imageUrl],
        result: cache.get(keys[index]),
      }])
      .filter(([, value]) => value.hash && value.result),
  );
  return { hashes, results };
}

async function analyze(message) {
  const imageUrl = typeof message.imageUrl === "string" ? message.imageUrl : "";
  const imageData = typeof message.imageData === "string" ? message.imageData : "";
  if (!imageUrl && !imageData) throw new Error("imageUrl or imageData is required");

  const imageHash = typeof message.imageHash === "string"
    ? message.imageHash
    : await hashImageInputs(imageUrl, imageData);
  const key = cacheKeyFor(imageHash);
  const cached = await cacheGet(key);
  if (cached) return cached;
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    await ensureOffscreen();
    const manifest = validateManifest(await modelManifest());
    const response = await chrome.runtime.sendMessage({
      kind: "aid:infer",
      imageUrl,
      imageData,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "inference failed");
    }
    if (typeof response.imageId !== "string" || !response.imageId) {
      throw new Error("inference did not return an image hash");
    }
    const resultKey = cacheKeyFor(response.imageId);

    const threshold = Number(manifest.threshold ?? 0.65);
    const score = Number(response.score);
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new Error("inference returned an invalid probability");
    }
    const result = {
      score,
      label: score >= threshold ? "likely-ai" : "likely-real",
      threshold,
      modelVersion: manifest.version || MODEL_VERSION_FALLBACK,
      imageId: response.imageId,
      processingTimeMs: Number.isFinite(Number(response.processingTimeMs))
        ? Number(response.processingTimeMs)
        : 0,
    };
    await cachePut(resultKey, result);
    return result;
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

function compactAiRating(value) {
  if (!value || typeof value !== "object") return undefined;
  const score = Number(value.score ?? value.rating);
  if (!Number.isFinite(score) || score < 0 || score > 1) return undefined;
  const rating = { score };
  if (typeof value.label === "string") rating.label = value.label.slice(0, 80);
  if (typeof value.modelVersion === "string") {
    rating.modelVersion = value.modelVersion.slice(0, 80);
  }
  return rating;
}

async function scrapePost(message) {
  const post = message?.post;
  const identity = post?.identity;
  const listingId = typeof identity?.listingId === "string" ? identity.listingId : "";
  if (!listingId) throw new Error("listing identity is required");

  const settings = await chrome.storage.local.get(SCRAPING_ENABLED_KEY);
  if (settings[SCRAPING_ENABLED_KEY] === false) return { ok: true, skipped: "disabled" };

  const storageKey = `${POST_STORAGE_PREFIX}${listingId}`;
  const existing = await chrome.storage.local.get(storageKey);
  if (existing[storageKey]) return { ok: true, skipped: "already-scraped" };

  const listingImages = Array.isArray(post.reviewsAndImages?.images)
    ? post.reviewsAndImages.images : [];
  const reviewImages = Array.isArray(post.reviewsAndImages?.reviewImages)
    ? post.reviewsAndImages.reviewImages : [];
  const images = [...listingImages, ...reviewImages]
      .map((image) => image?.url)
      .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url))
  let imageIds = [];
  if (images.length) {
    await ensureOffscreen();
    const hashResponse = await chrome.runtime.sendMessage({
      kind: "aid:hash-images",
      imageUrls: [...new Set(images)].slice(0, MAX_IMAGES),
    });
    if (!hashResponse?.ok) throw new Error(hashResponse?.error || "image hashing failed");
    imageIds = Object.values(hashResponse.hashes || {})
      .filter((imageId) => typeof imageId === "string" && imageId);
  }

  const record = {
    listingId,
    creator: typeof identity.creator === "string" ? identity.creator.slice(0, 500) : "",
    price: typeof identity.price === "string" ? identity.price.slice(0, 120) : "",
    url: typeof identity.url === "string" ? identity.url.slice(0, 2000) : "",
    name: typeof identity.name === "string" ? identity.name.slice(0, 500) : "",
    imageIds: [...new Set(imageIds)],
    aiRating: compactAiRating(message.aiRating),
    scrapedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [storageKey]: record });
  return { ok: true, record };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind === "aid:scrape-post") {
    scrapePost(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.kind === "aid:cache-lookup") {
    const imageUrls = Array.isArray(message.imageUrls)
      ? message.imageUrls.filter((imageUrl) => typeof imageUrl === "string")
      : [];
    cachedResultsFor(imageUrls)
      .then(({ hashes, results }) => sendResponse({ ok: true, hashes, results }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.kind !== "aid:analyze") return false;
  analyze(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "aid-check-image",
    title: "Analyze image locally",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "aid-check-image" && info.srcUrl && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      kind: "aid:check-image",
      srcUrl: info.srcUrl,
    }).catch(() => {});
  }
});
