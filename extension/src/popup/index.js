const form = document.querySelector("#analyze-form");
const urlInput = document.querySelector("#image-url");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const resultLabel = document.querySelector("#result-label");
const resultScore = document.querySelector("#result-score");
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

function showResult(value) {
  result.hidden = false;
  resultLabel.textContent = value.label === "likely-ai" ? "Likely AI-generated" : "Likely real";
  resultScore.textContent = `AI likelihood: ${(value.score * 100).toFixed(1)}%`;
  resultThreshold.textContent = `${(value.threshold * 100).toFixed(1)}%`;
  resultModel.textContent = value.modelVersion;
  resultTime.textContent = `${value.processingTimeMs} ms`;
}

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

async function scanCurrentPage() {
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
      const response = await chrome.runtime.sendMessage({
        kind: "aid:analyze",
        imageUrl: image.url,
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
    const response = await chrome.runtime.sendMessage({
      kind: "aid:analyze",
      imageUrl: urlInput.value.trim(),
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
