import { getAccessToken } from "./auth.js";

const SERVER_URL_KEY = "serverBaseUrl";
const DEFAULT_TIMEOUT_MS = 8000;

function validateObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} response was malformed`);
  }
  return value;
}

export function createApiClient({
  baseUrl,
  getToken = getAccessToken,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  async function configuredBaseUrl() {
    if (baseUrl) return baseUrl.replace(/\/+$/, "");
    const stored = await chrome.storage.local.get(SERVER_URL_KEY);
    if (typeof stored[SERVER_URL_KEY] !== "string" || !stored[SERVER_URL_KEY]) {
      throw new Error("server URL is not configured");
    }
    return stored[SERVER_URL_KEY].replace(/\/+$/, "");
  }

  async function request(path, options = {}) {
    const token = await getToken();
    if (!token) throw new Error("sign-in is required for server features");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${await configuredBaseUrl()}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
          Authorization: "Bearer " + token,
        },
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error("server returned invalid JSON");
      }
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `server request failed (${response.status})`);
      }
      return validateObject(body, "server");
    } catch (error) {
      if (error.name === "AbortError") throw new Error("server request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    getListingScore(platform, listingId) {
      return request(`/api/scores/${encodeURIComponent(platform)}/${encodeURIComponent(listingId)}`);
    },
    submitListingScore(payload) {
      return request("/api/scores", { method: "POST", body: JSON.stringify(payload) });
    },
    evaluateDescription(description, listingDetails = {}) {
      return request("/api/descriptions/evaluate", {
        method: "POST",
        body: JSON.stringify({ description, listingDetails }),
      });
    },
    getUserReviews(platform, listingId) {
      return request(`/api/reports/${encodeURIComponent(platform)}/${encodeURIComponent(listingId)}`);
    },
    submitUserReview(payload) {
      return request("/api/reports", { method: "POST", body: JSON.stringify(payload) });
    },
  };
}

export const apiClient = createApiClient();
