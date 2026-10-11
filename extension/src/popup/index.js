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
  // Manual URL checks remain on the Manual tab; Scores shows listing images only.
}

resetToOpenState();

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

let scanInProgress = false;

async function scanCurrentPage() {
  // Avoid running two expensive listing scans at the same time.
  if (scanInProgress) return;
  scanInProgress = true;
  result.hidden = true;
  pageResults.hidden = false;
  imageResults.replaceChildren();
  pageSummary.textContent = "Finding listing images...";
  if (scanButton) scanButton.disabled = true;

  try {
    // This is the original, working content-script -> background service worker path.
    const listing = await getCurrentEtsyPage();
    const images = Array.isArray(listing.images) ? listing.images.slice(0, 20) : [];
    pageSummary.textContent = listing.title
      ? `${listing.title} · ${images.length} image(s)`
      : `${images.length} listing image(s) found`;

    if (!images.length) {
      throw new Error("No listing images found. Wait for the Etsy listing photos to load, then click Scan current listing again.");
    }

    // Show thumbnails right away rather than waiting for the model to finish.
    const scoreItems = images.map((image) => ({
      url: image.url,
      alt: image.alt || "Etsy listing image",
      result: null,
      status: "Analyzing…",
    }));
    document.dispatchEvent(new CustomEvent("rts:analysis-start", {
      detail: { title: listing.title || "Current Etsy listing", images: scoreItems }
    }));

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        // Do NOT convert to a huge data URL in the popup. The original extension
        // sends the image URL to its offscreen ONNX analysis pipeline.
        const response = await chrome.runtime.sendMessage({
          kind: "aid:analyze",
          imageUrl: image.url,
          meta: listing,
        });
        if (!response?.ok) throw new Error(response?.error || "Analysis failed");
        scoreItems[i] = { ...scoreItems[i], result: response.result, status: "complete" };
        // Same badge mechanism used by the original scanner on Etsy pages.
        try { await showResultOnPage(image.url, response.result); }
        catch (error) { console.warn("Could not add on-page badge:", error); }
      } catch (error) {
        scoreItems[i] = { ...scoreItems[i], status: error.message || "Analysis failed" };
        console.error("Image analysis failed:", image.url, error);
      }

      const response = scoreItems[i].result
        ? { ok: true, result: scoreItems[i].result }
        : { ok: false, error: scoreItems[i].status };
      imageResults.appendChild(createImageResult(image, response));
      document.dispatchEvent(new CustomEvent("rts:analysis-progress", {
        detail: { index: i, item: scoreItems[i], complete: i + 1, total: images.length }
      }));
    }

    const successes = scoreItems.filter((item) => item.result).length;
    status.textContent = `${successes} of ${images.length} images analyzed.`;
    document.dispatchEvent(new CustomEvent("rts:analysis", {
      detail: { type: "listing", title: listing.title || "Current Etsy listing", images: scoreItems }
    }));
  } catch (error) {
    pageSummary.textContent = error.message;
    status.textContent = `Scan unavailable: ${error.message}`;
    document.dispatchEvent(new CustomEvent("rts:scan-unavailable", {
      detail: { message: error.message }
    }));
    console.error("Listing scan failed:", error);
  } finally {
    scanInProgress = false;
    if (scanButton) scanButton.disabled = false;
  }
}

if (scanButton) scanButton.addEventListener("click", scanCurrentPage);
if (showScrapedDataButton) {
  showScrapedDataButton.addEventListener("click", showScrapedPostData);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  result.hidden = true;
  status.textContent = "Analyzing locally...";
  analyzeButton.disabled = true;
  try {
    const imageUrl = urlInput.value.trim();
    const response = await chrome.runtime.sendMessage({
      kind: "aid:analyze",
      imageUrl,
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

// On popup launch, scan an Etsy listing without requiring authentication.
// For other pages, the Scores tab displays guidance instead of running a scan.
async function autoScanEtsyListing() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/^https?:\/\/(?:[^/]+\.)?etsy\.com\/listing\/\d+(?:[/?#]|$)/i.test(tab?.url || "")) {
      document.dispatchEvent(new CustomEvent("rts:scan-unavailable", {
        detail: { message: "Open an Etsy listing to see its image ratings automatically. You can still analyze a pasted image URL in Manual." }
      }));
      return;
    }
    await scanCurrentPage();
  } catch (error) {
    document.dispatchEvent(new CustomEvent("rts:scan-unavailable", { detail: { message: error.message } }));
  }
}

// Run after the other popup modules have attached their listeners.
document.addEventListener("rts:scan-requested", autoScanEtsyListing);
