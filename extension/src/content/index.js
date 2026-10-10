const MAX_IMAGES = 20;
const ETSY_HOST_RE = /(^|\.)etsy\.com$/i;
const IGNORED_IMAGE_RE = /(avatar|icon|logo|sprite|badge|favicon|profile|shop[_-]?owner)/i;
const analyzedResults = new Map();
const inFlightImages = new Set();

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

function getListingId (doc) {
    const listingId =
    document.querySelector("[data-listing-id]")?.getAttribute("data-listing-id") ||
    document.querySelector("[data-product-id]")?.getAttribute("data-product-id") ||
    document.querySelector("meta[property='og:url']")?.content ||
    location.pathname;

    return listingId;
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
      listingId: getListingId(doc),
      pageUrl: location.href,
    },
  };
}

function isIndividualListingPage() {
  const path = window.location.pathname || "";
  return /\/listing\/\d+/i.test(path);
}

function getListingDescription() {
  const metaDesc =
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[property="og:description"]')?.content;

  if (metaDesc) return metaDesc.trim();

  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')];
  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent);
      if (json?.description) return String(json.description).trim();
      if (json?.itemListElement) {
        for (const item of json.itemListElement) {
          if (item?.description) return String(item.description).trim();
        }
      }
    } catch {}
  }

  const visible = [...document.querySelectorAll('p, div, section')]
    .map(el => el.textContent?.trim())
    .find(text => text && text.length > 80);

  return visible || null;
}

function getItemDetails() {
  const selectors = [
    '[data-item-details]',
    '.item-details',
    '.listing-details',
    '.description-details',
    '[data-description]',
    '[data-section-id="details"]',
    '[data-section-id="description"]',
    '.details-section',
    '.details',
    '.about-this-item',
    '[id*="description"]',
    '[id*="details"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;

    const text = (el.textContent || "").trim();
    if (text && text.length > 20) return text;
  }

  const heading = [...document.querySelectorAll("h2, h3, h4, h5")]
    .find((el) => /item details|details|about this item|description/i.test(el.textContent || ""));

  if (heading) {
    const container = heading.parentElement;
    const text = (container?.textContent || "").trim();
    if (text && text.length > 20) return text;
  }

  return null;
}

function setImageBadge(img, result) {
  const host = img.parentElement;
  if (!host) return;
  host.querySelector(".ratethatslop-image-badge")?.remove();
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const badge = document.createElement("span");
  badge.className = "ratethatslop-image-badge";
  badge.textContent = result?.label === "likely-ai" ? "Likely AI" : "Likely Real";
  badge.style.cssText = [
    "position:absolute", "top:8px", "left:8px", "z-index:2", "padding:4px 7px",
    "border-radius:999px", "font:600 11px system-ui,sans-serif", "color:#fff",
    `background:${result?.label === "likely-ai" ? "#b42318" : "#287d3c"}`,
  ].join(";");
  host.appendChild(badge);
}

function setImageBadges(imageUrl, result) {
  for (const image of document.querySelectorAll("img")) {
    if (getImageUrl(image) === imageUrl) setImageBadge(image, result);
  }
}

async function analyzePageImages(data) {
  for (const image of data.listing.images) {
    if (analyzedResults.has(image.url)) {
      setImageBadges(image.url, analyzedResults.get(image.url));
      continue;
    }
    if (inFlightImages.has(image.url)) continue;
    inFlightImages.add(image.url);
    try {
      const response = await chrome.runtime.sendMessage({
        kind: "aid:analyze",
        imageUrl: image.url,
        meta: data.listing,
      });
      if (response?.ok) {
        analyzedResults.set(image.url, response.result);
        setImageBadges(image.url, response.result);
      }
    } catch (error) {
      console.warn("RateThatSlop could not analyze Etsy image:", error);
    } finally {
      inFlightImages.delete(image.url);
    }
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.kind === "aid:collect-page") {
      sendResponse(collectPageData());
      return false;
    }
    if (message?.kind === "aid:show-result" &&
        typeof message.imageUrl === "string" &&
        message.result) {
      setImageBadges(message.imageUrl, message.result);
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if(isIndividualListingPage()) {
   const description = getItemDetails(); 
   console.log(description);
  }
  const scan = () => {
    const data = collectPageData();
    if (data.ok && data.listing.images.length) analyzePageImages(data);
  };
  let scanTimer = 0;
  const scheduleScan = () => {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 250);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
  } else {
    scheduleScan();
  }

  if (typeof window.setTimeout === "function") {
    for (const delay of [1500, 4000, 8000]) {
      window.setTimeout(scan, delay);
    }

    if (typeof MutationObserver !== "undefined") {
      const observer = new MutationObserver((mutations) => {
        const relevant = mutations.some((mutation) => {
          if (mutation.type === "childList") {
            return [...mutation.addedNodes].some((node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node.matches?.("img") || node.querySelector?.("img")));
          }
          return mutation.type === "attributes" &&
            (mutation.target.matches?.("img") &&
              ["src", "srcset", "data-src", "data-srcset"].includes(mutation.attributeName));
        });
        if (relevant) scheduleScan();
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["src", "srcset", "data-src", "data-srcset"],
      });
    }
  }
}
