export const DEFAULT_SETTINGS = Object.freeze({
  scrapingEnabled: true,
  serverUploadEnabled: true,
  serverInfoEnabled: true,
  descriptionAiEnabled: true,
  userReviewsEnabled: true,
  etsyReviewsEnabled: true,
});

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTING_KEYS);
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, stored[key] === false ? false : true]),
  );
}

export async function setSettings(values) {
  const next = {};
  for (const key of SETTING_KEYS) {
    if (Object.hasOwn(values || {}, key)) next[key] = values[key] !== false;
  }
  await chrome.storage.local.set(next);
  return getSettings();
}

export function isSettingEnabled(settings, key) {
  return settings?.[key] !== false;
}
