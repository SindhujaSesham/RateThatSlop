const MAX_IMAGES = 20;
const ETSY_HOST_RE = /(^|\.)etsy\.com$/i;
const IGNORED_IMAGE_RE = /(avatar|icon|logo|sprite|badge|favicon|profile|shop[_-]?owner)/i;

function isEtsyPage(location = window.location) {
  return ETSY_HOST_RE.test(location.hostname);
}

function getImageUrl(img) {
  return img.currentSrc || img.src || img.getAttribute("data-src") || "";
}

function isListingImage(img) {
  const url = getImageUrl(img);
  if (!/^https?:\/\//i.test(url) || IGNORED_IMAGE_RE.test(url)) return false;

  const width = Number(img.naturalWidth || img.width || img.getAttribute("width") || 0);
  const height = Number(img.naturalHeight || img.height || img.getAttribute("height") || 0);
  return (!width && !height) || (width >= 160 && height >= 160);
}

function getListingImages(doc = document) {
  const seen = new Set();
  const images = [];
  for (const img of doc.querySelectorAll("img")) {
    if (!isListingImage(img)) continue;
    const url = getImageUrl(img);
    if (seen.has(url)) continue;
    seen.add(url);
    images.push({ url, alt: img.alt?.trim() || "" });
    if (images.length >= MAX_IMAGES) break;
  }
  return images;
}

function getText(doc, selectors) {
  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (!element) continue;
    const value = element.tagName === "META"
      ? element.getAttribute("content")
      : element.textContent;
    if (value?.trim()) return value.trim();
  }
  return "";
}

function collectPageData(doc = document, location = window.location) {
  if (!isEtsyPage(location)) return { ok: false, error: "This is not an Etsy page." };
  return {
    ok: true,
    listing: {
      images: getListingImages(doc),
      title: getText(doc, ["h1", "[data-listing-title]", "[data-title]", 'meta[property="og:title"]']),
      seller: getText(doc, ["[data-shop-name]", "[data-seller-name]", ".shop-name", ".shop-name-text"]),
      price: getText(doc, ['[data-price]', ".currency-value", ".price"]),
      pageUrl: location.href,
    },
  };
}

function setImageBadge(img, result) {
  const host = img.parentElement;
  if (!host || host.querySelector(".ratethatslop-image-badge")) return;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const badge = document.createElement("span");
  badge.className = "ratethatslop-image-badge";
  badge.textContent = result?.label === "likely-ai" ? "AI signal" : "Low AI signal";
  badge.style.cssText = [
    "position:absolute", "top:8px", "left:8px", "z-index:2", "padding:4px 7px",
    "border-radius:999px", "font:600 11px system-ui,sans-serif", "color:#fff",
    `background:${result?.label === "likely-ai" ? "#b42318" : "#287d3c"}`,
  ].join(";");
  host.appendChild(badge);
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

async function analyzePageImages(data) {
  for (const image of data.listing.images) {
    try {
      const imageData = await loadImageDataUrl(image.url).catch(() => "");
      const response = await chrome.runtime.sendMessage({
        kind: "aid:analyze",
        imageUrl: image.url,
        imageData: imageData || undefined,
        meta: data.listing,
      });
      if (response?.ok) {
        const element = [...document.querySelectorAll("img")]
          .find((candidate) => getImageUrl(candidate) === image.url);
        if (element) setImageBadge(element, response.result);
      }
    } catch (error) {
      console.warn("RateThatSlop could not analyze Etsy image:", error);
    }
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.kind !== "aid:collect-page") return false;
    sendResponse(collectPageData());
    return false;
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const scan = () => {
    const data = collectPageData();
    if (data.ok && data.listing.images.length) analyzePageImages(data);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  } else {
    scan();
  }
}
