const LOG_KEY = "diagnosticLogs";
const MAX_LOGS = 100;

function safeDetails(details) {
  if (!details || typeof details !== "object") return undefined;
  const result = {};
  for (const [key, value] of Object.entries(details)) {
    if (["imageData", "dataUrl", "password", "accessToken"].includes(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 500);
    else if (typeof value === "number" || typeof value === "boolean") result[key] = value;
  }
  return result;
}

export async function writeDiagnostic(event, details) {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  const entry = {
    at: new Date().toISOString(),
    event: String(event).slice(0, 120),
    details: safeDetails(details),
  };
  const stored = await chrome.storage.local.get(LOG_KEY);
  const logs = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
  logs.push(entry);
  await chrome.storage.local.set({ [LOG_KEY]: logs.slice(-MAX_LOGS) });
}

export async function readDiagnostics() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return [];
  const stored = await chrome.storage.local.get(LOG_KEY);
  return Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
}

export async function clearDiagnostics() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  await chrome.storage.local.remove(LOG_KEY);
}

export async function clearLocalCache() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return 0;
  const stored = await chrome.storage.local.get(null);
  const keys = Object.keys(stored).filter((key) =>
    key.startsWith("inference:") ||
    key.startsWith("post:") ||
    key.startsWith("description-assessment:") ||
    key === "serverListingCache",
  );
  if (keys.length) await chrome.storage.local.remove(keys);
  await clearDiagnostics();
  return keys.length;
}
