// Model orchestration service: owns the cache and forwards image requests to
// the offscreen document, where ONNX Runtime can decode and process images.

const OFFSCREEN_URL = "src/background/offscreen.html";
const MODEL_VERSION_FALLBACK = "unknown";
const CACHE_MAX = 3000;
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

async function imageIdFor(imageUrl, imageData) {
  const source = imageData || imageUrl;
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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

function cachePut(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

async function analyze(message) {
  const imageUrl = typeof message.imageUrl === "string" ? message.imageUrl : "";
  const imageData = typeof message.imageData === "string" ? message.imageData : "";
  if (!imageUrl && !imageData) throw new Error("imageUrl or imageData is required");

  const key = imageUrl || imageData;
  if (cache.has(key)) return cache.get(key);
  if (inflight.has(key)) return inflight.get(key);

  const request = (async () => {
    await ensureOffscreen();
    const manifest = await modelManifest();
    const imageId = await imageIdFor(imageUrl, imageData);
    const response = await chrome.runtime.sendMessage({
      kind: "aid:infer",
      imageUrl,
      imageData,
    });
    if (!response?.ok) {
      throw new Error(response?.error || "inference failed");
    }

    const threshold = Number(manifest.threshold ?? 0.65);
    const score = Number(response.score);
    const result = {
      score,
      label: score >= threshold ? "likely-ai" : "likely-real",
      threshold,
      modelVersion: manifest.version || MODEL_VERSION_FALLBACK,
      imageId,
      processingTimeMs: Number(response.processingTimeMs),
    };
    cachePut(key, result);
    return result;
  })().finally(() => inflight.delete(key));

  inflight.set(key, request);
  return request;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
