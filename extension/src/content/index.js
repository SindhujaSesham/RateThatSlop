// Change note: Add Etsy DOM parsing for listing images, seller metadata, and
// reviews; send image evaluation requests and inject visual indicators here.
// extension/src/content/index.js

const ETSY_HOST_RE = /(^|\.)etsy\.com$/;

function isEtsyPage() {
  return window.location.hostname.includes("etsy.com");
}

function getListingImageUrls() {
  const candidates = [
    ...document.querySelectorAll('img'),
  ];

  return candidates
    .map(img => img.currentSrc || img.src)
    .filter(Boolean)
    .filter(url => url.startsWith("http"))
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

function getListingTitle() {
  const selectors = [
    'h1',
    '[data-listing-title]',
    '[data-title]',
    'meta[property="og:title"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;

    if (el.tagName === "META") {
      return el.getAttribute("content") || "";
    }

    const text = el.textContent?.trim();
    if (text) return text;
  }

  return "";
}

function getSellerName() {
  const selectors = [
    '[data-shop-name]',
    '[data-seller-name]',
    '.shop-name',
    '.shop-name-text'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }

  return "";
}

function getPrice() {
  const priceEl = document.querySelector('[data-price]') ||
                 document.querySelector('.currency-value') ||
                 document.querySelector('.price');

  return priceEl?.textContent?.trim() || "";
}

function scanPage() {
  if (!isEtsyPage()) return;

  const images = getListingImageUrls();
  const title = getListingTitle();
  const seller = getSellerName();
  const price = getPrice();

  console.log("Etsy page scan:", { title, seller, price, images });

  if (!images.length) return;

  const imageUrl = images[0];

  chrome.runtime.sendMessage({
    kind: "aid:analyze",
    url: imageUrl,
    meta: {
      title,
      seller,
      price,
      pageUrl: window.location.href
    }
  }, (response) => {
    if (!response) return;
    console.log("Model response:", response);
    showBadge(response);
  });
}

function showBadge(result) {
  const existing = document.querySelector("#etsy-ai-scan-badge");
  if (existing) existing.remove();

  const badge = document.createElement("div");
  badge.id = "etsy-ai-scan-badge";
  badge.textContent = result?.score >= 0.65 ? "Likely AI-generated" : "Low AI signal";
  badge.style.position = "fixed";
  badge.style.bottom = "16px";
  badge.style.right = "16px";
  badge.style.zIndex = "999999";
  badge.style.padding = "8px 12px";
  badge.style.borderRadius = "8px";
  badge.style.fontSize = "12px";
  badge.style.fontWeight = "600";
  badge.style.color = "#fff";
  badge.style.background = result?.score >= 0.65 ? "#d93025" : "#2e7d32";

  document.body.appendChild(badge);
}

// Run as soon as the page is ready.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scanPage);
} else {
  scanPage();
}