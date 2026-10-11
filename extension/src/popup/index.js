const form = document.querySelector("#analyze-form");
const urlInput = document.querySelector("#image-url");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const resultLabel = document.querySelector("#result-label");
const resultSummary = document.querySelector("#result-summary");
const resultScoreValue = document.querySelector("#result-score-value");
const resultThreshold = document.querySelector("#result-threshold");
const resultModel = document.querySelector("#result-model");
const resultTime = document.querySelector("#result-time");
const analyzeButton = form.querySelector("button");
const scanButton = document.querySelector("#scan-page");
const pageResults = document.querySelector("#page-results");
const pageSummary = document.querySelector("#page-summary");
const imageResults = document.querySelector("#image-results");
const scrapedData = document.querySelector("#scraped-data");
const scrapedDataSummary = document.querySelector("#scraped-data-summary");
const scrapedDataOutput = document.querySelector("#scraped-data-output");
const showScrapedDataButton = document.querySelector("#show-scraped-data");
const descriptionEvaluationToggle = document.querySelector("#description-evaluation-enabled");
const DESCRIPTION_EVALUATION_ENABLED_KEY = "descriptionEvaluationEnabled";
const accountForm = document.querySelector("#account-form");
const accountState = document.querySelector("#account-state");
const accountSignOut = document.querySelector("#account-sign-out");
const accountSubmit = document.querySelector("#account-submit");
const serverUrlInput = document.querySelector("#server-url");
const accountEmailInput = document.querySelector("#account-email");
const accountPasswordInput = document.querySelector("#account-password");
const BACKGROUND_MESSAGE_TIMEOUT_MS = 15000;

function sendBackgroundMessage(message) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = window.setTimeout(() => resolve({
      ok: false,
      error: "The extension background service did not respond within 15 seconds. Check chrome://extensions for service-worker errors, then reload the extension.",
    }), BACKGROUND_MESSAGE_TIMEOUT_MS);
  });
  return Promise.race([chrome.runtime.sendMessage(message), timeout])
    .finally(() => window.clearTimeout(timeoutId));
}

function resetToOpenState() {
  result.hidden = true;
  pageResults.hidden = true;
  status.textContent = "";
  imageResults.replaceChildren();
}

function showResult(value) {
  const isAi = value.label === "likely-ai";
  const percent = (value.score * 100).toFixed(0);
  pageResults.hidden = true;
  result.hidden = false;
  result.classList.toggle("is-ai", isAi);
  resultScoreValue.textContent = `${percent}%`;
  resultLabel.textContent = isAi ? "Likely AI-generated" : "Likely human-made";
  resultSummary.textContent = isAi
    ? "We checked this image and found patterns that often show up in AI-generated art."
    : "We checked the visible listing images and found mostly natural details.";
  resultThreshold.textContent = `${(value.threshold * 100).toFixed(1)}%`;
  resultModel.textContent = value.modelVersion;
  resultTime.textContent = `${value.processingTimeMs} ms`;
}

resetToOpenState();

chrome.storage.local.get("serverBaseUrl")
  .then((settings) => {
    serverUrlInput.value = settings.serverBaseUrl || "http://localhost:3000";
  });

chrome.runtime.sendMessage({ kind: "aid:get-auth-state" }).then((response) => {
  if (response?.ok && response.user) {
    accountState.textContent = `Signed in as ${response.user.email || "account"}`;
    accountSignOut.hidden = false;
  }
}).catch(() => {});

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  accountSubmit.disabled = true;
  accountState.textContent = "Signing in...";
  try {
    const serverOrigin = new URL(serverUrlInput.value.trim()).origin;
    if (serverOrigin.startsWith("https://")) {
        const permissionOrigin = `${serverOrigin}/*`;
        const granted = await chrome.permissions.request({ origins: [permissionOrigin] });
      if (!granted) throw new Error("Permission to connect to the API server was not granted.");
    }
      accountState.textContent = "Saving API server setting...";
      const config = await sendBackgroundMessage({
      kind: "aid:configure-server",
      serverBaseUrl: serverUrlInput.value,
    });
    if (!config?.ok) throw new Error(config?.error || "Could not save server settings.");
      accountState.textContent = "Checking API server and Supabase setup...";
      const setup = await sendBackgroundMessage({ kind: "aid:check-sign-in-setup" });
      if (!setup?.ok) throw new Error(setup?.error || "Sign-in setup check failed.");
      accountState.textContent = "Signing in to Supabase...";
      const response = await sendBackgroundMessage({
      kind: "aid:sign-in",
      email: accountEmailInput.value,
      password: accountPasswordInput.value,
    });
    if (!response?.ok) throw new Error(response?.error || "Sign-in failed.");
    accountPasswordInput.value = "";
    accountState.textContent = `Signed in as ${response.user?.email || accountEmailInput.value}`;
    accountSignOut.hidden = false;
    status.textContent = "Signed in. Server features are available.";
  } catch (error) {
    accountState.textContent = error.message;
    accountPasswordInput.value = "";
    console.error("RateThatSlop sign-in setup failed:", error);
  } finally {
    accountSubmit.disabled = false;
  }
});

accountSignOut.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ kind: "aid:sign-out" });
  accountState.textContent = response?.ok ? "Signed out" : response?.error || "Sign-out failed.";
  accountSignOut.hidden = true;
});

chrome.storage.local.get(DESCRIPTION_EVALUATION_ENABLED_KEY).then((settings) => {
  descriptionEvaluationToggle.checked = settings[DESCRIPTION_EVALUATION_ENABLED_KEY] !== false;
});

descriptionEvaluationToggle.addEventListener("change", async () => {
  const enabled = descriptionEvaluationToggle.checked;
  await chrome.storage.local.set({ [DESCRIPTION_EVALUATION_ENABLED_KEY]: enabled });
  if (!enabled) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (/^https?:\/\/([^.]+\.)?etsy\.com\/listing\/\d+(?:\/|$)/i.test(tab?.url || "")) {
    await chrome.tabs.sendMessage(tab.id, { kind: "aid:rescrape-post" }).catch(() => {});
  }
});

function createImageResult(image, response) {
  const card = document.createElement("article");
  card.className = "image-result";
  const thumbnail = document.createElement("img");
  thumbnail.src = image.url;
  thumbnail.alt = image.alt || "Etsy listing image";
  const text = document.createElement("span");
  text.textContent = response.ok
    ? `${response.result.label === "likely-ai" ? "Likely AI" : "Low AI signal"} · ${(response.result.score * 100).toFixed(1)}%`
    : `Unavailable: ${response.error}`;
  card.append(thumbnail, text);
  return card;
}

async function loadImageDataUrl(imageUrl) {
  if (!imageUrl) return "";
  const image = new Image();
  image.decoding = "async";
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "no-referrer";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function getCurrentEtsyPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Could not find the active tab.");
  const page = await chrome.tabs.sendMessage(tab.id, { kind: "aid:collect-page" });
  if (!page?.ok) throw new Error(page?.error || "Could not read this page.");
  return page.listing;
}

async function showScrapedPostData() {
  scrapedData.hidden = false;
  scrapedDataSummary.textContent = "Reading the current tab...";
  scrapedDataOutput.textContent = "";
  showScrapedDataButton.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Could not find the active tab.");
    if (!/^https?:\/\/([^.]+\.)?etsy\.com\/listing\/\d+(?:\/|$)/i.test(tab.url || "")) {
      throw new Error("Open an Etsy listing page (/listing/<id>) to preview scraped data.");
    }
    const response = await chrome.tabs.sendMessage(tab.id, { kind: "aid:scrape-post" });
    if (!response?.ok) throw new Error(response?.error || "This page is not an Etsy listing.");
    scrapedDataSummary.textContent =
      "Temporary preview only. Raw description and review text are not persisted.";
    scrapedDataOutput.textContent = JSON.stringify(response, null, 2);
    status.textContent = "Scraped data preview ready.";
  } catch (error) {
    scrapedDataSummary.textContent = error.message;
    status.textContent = "Could not preview scraped data.";
  } finally {
    showScrapedDataButton.disabled = false;
  }
}

async function showResultOnPage(imageUrl, result) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\/([^.]+\.)?etsy\.com\//i.test(tab.url || "")) return;
  await chrome.tabs.sendMessage(tab.id, {
    kind: "aid:show-result",
    imageUrl,
    result,
  });
}

async function scanCurrentPage() {
  result.hidden = true;
  pageResults.hidden = false;
  imageResults.replaceChildren();
  pageSummary.textContent = "Finding listing images...";
  scanButton.disabled = true;
  try {
    const listing = await getCurrentEtsyPage();
    pageSummary.textContent = listing.title
      ? `${listing.title} · ${listing.images.length} image${listing.images.length === 1 ? "" : "s"}`
      : `${listing.images.length} listing image${listing.images.length === 1 ? "" : "s"} found`;
    const storedScore = listing.listingId
      ? await chrome.runtime.sendMessage({
        kind: "aid:get-listing-score",
        listingId: listing.listingId,
      })
      : null;
    if (storedScore?.ok && storedScore.available && storedScore.score?.overall !== null) {
      pageSummary.textContent += ` · Stored listing rating: ${(storedScore.score.overall * 100).toFixed(1)}%`;
    }
    if (!listing.images.length) {
      pageSummary.textContent += ". No suitable images were found.";
      return;
    }
    for (const image of listing.images) {
      const imageData = await loadImageDataUrl(image.url).catch(() => "");
      const response = await chrome.runtime.sendMessage({
        kind: "aid:analyze",
        imageUrl: image.url,
        imageData: imageData || undefined,
        meta: listing,
      });
      if (response?.ok) await showResultOnPage(image.url, response.result);
      imageResults.appendChild(createImageResult(image, response?.ok
        ? response
        : { ok: false, error: response?.error || "Analysis failed" }));
    }
    status.textContent = "Etsy page scan complete.";
  } catch (error) {
    pageSummary.textContent = error.message;
    status.textContent = "Etsy page scan failed.";
  } finally {
    scanButton.disabled = false;
  }
}

scanButton.addEventListener("click", scanCurrentPage);
showScrapedDataButton.addEventListener("click", showScrapedPostData);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  status.textContent = "Analyzing locally...";
  analyzeButton.disabled = true;
  try {
    const imageUrl = urlInput.value.trim();
    const imageData = await loadImageDataUrl(imageUrl).catch(() => "");
    const response = await chrome.runtime.sendMessage({
      kind: "aid:analyze",
      imageUrl,
      imageData: imageData || undefined,
    });
    if (!response?.ok) throw new Error(response?.error || "Inference failed");
    showResult(response.result);
    status.textContent = "Analysis complete.";
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  } finally {
    analyzeButton.disabled = false;
  }
});

export { createImageResult, getCurrentEtsyPage, scanCurrentPage, showScrapedPostData };
