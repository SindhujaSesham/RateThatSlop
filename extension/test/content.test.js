import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/index.js", import.meta.url), "utf8");
const context = {
  window: { location: { hostname: "www.etsy.com", href: "https://www.etsy.com/listing/123" } },
  document: {
    readyState: "loading",
    addEventListener() {},
    querySelectorAll() { return []; },
  },
  chrome: { runtime: { onMessage: { addListener() {} } } },
  console,
};
vm.runInNewContext(`${source}
globalThis.__testApi = {
  collectPageData, getListingImages, isEtsyPage, isListingPage, scrapePostPage,
  scrapePostIdentity, scrapeProductInformation, scrapeReviewsAndImages,
};`, context);
const {
  collectPageData, getListingImages, isEtsyPage, isListingPage, scrapePostPage,
  scrapePostIdentity, scrapeProductInformation, scrapeReviewsAndImages,
} = context.__testApi;

function makeImage({ url, width = 500, height = 500, alt = "" }) {
  return {
    src: url,
    currentSrc: url,
    width,
    height,
    alt,
    getAttribute(name) {
      return name === "width" ? String(width) : name === "height" ? String(height) : null;
    },
  };
}

test("recognizes Etsy listing pages but rejects lookalike hosts", () => {
  assert.equal(isEtsyPage({ hostname: "www.etsy.com" }), true);
  assert.equal(isEtsyPage({ hostname: "etsy.com.evil.example" }), false);
  assert.equal(isListingPage({ hostname: "www.etsy.com", pathname: "/listing/123" }), true);
  assert.equal(isListingPage({ hostname: "www.etsy.com", pathname: "/listing/123/reviews" }), true);
  assert.equal(isListingPage({ hostname: "www.etsy.com", pathname: "/search?q=pattern" }), false);
  assert.equal(isListingPage({ hostname: "www.etsy.com", pathname: "/seller/listing/123" }), false);
});

test("deduplicates listing images and excludes small utility images", () => {
  const images = [
    makeImage({ url: "https://i.etsystatic.com/item.jpg" }),
    makeImage({ url: "https://i.etsystatic.com/item.jpg" }),
    makeImage({ url: "https://i.etsystatic.com/avatar.jpg" }),
    makeImage({ url: "https://i.etsystatic.com/icon.png", width: 32, height: 32 }),
  ];
  const data = getListingImages({ querySelectorAll: () => images });
  const plainData = JSON.parse(JSON.stringify(data));
  assert.deepEqual(plainData, [{ url: "https://i.etsystatic.com/item.jpg", alt: "" }]);
});

test("collects listing metadata and image alternatives", () => {
  const title = { tagName: "H1", textContent: "Sewing pattern" };
  const seller = { textContent: "Pattern shop" };
  const images = [makeImage({ url: "https://i.etsystatic.com/item.jpg", alt: "Front view" })];
  const selectors = new Map([
    ["h1", title],
    ["[data-shop-name]", seller],
  ]);
  const listing = collectPageData({
    querySelectorAll: () => images,
    querySelector: (selector) => selectors.get(selector) || null,
  }, { hostname: "etsy.com", href: "https://etsy.com/listing/123" });
  assert.equal(listing.ok, true);
  assert.equal(listing.listing.title, "Sewing pattern");
  assert.equal(listing.listing.seller, "Pattern shop");
  assert.equal(listing.listing.images[0].alt, "Front view");
});

test("splits listing identity, product information, and review/image scraping", () => {
  const title = { tagName: "H1", textContent: "Pattern" };
  const seller = { textContent: "Maker" };
  const description = { textContent: "Printable instructions" };
  const review = {
    textContent: "Lovely pattern",
    getAttribute: (name) => name === "data-review-id" ? "r1" : null,
  };
  const image = makeImage({ url: "https://i.etsystatic.com/pattern.jpg" });
  const selectors = new Map([
    ["h1", title],
    ["[data-shop-name]", seller],
    ['[data-testid="listing-page-description"]', description],
  ]);
  const doc = {
    querySelector: (selector) => selectors.get(selector) || null,
    querySelectorAll: (selector) => {
      if (selector === "img") return [image];
      if (selector.includes("review")) return [review];
      if (selector.includes("description")) return [description];
      return [];
    },
  };
  const location = { hostname: "etsy.com", href: "https://etsy.com/listing/123", pathname: "/listing/123" };
  const scraped = scrapePostPage(doc, location);
  assert.equal(scraped.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(scraped.identity)), {
    listingId: "123", creator: "Maker", price: "", url: location.href, name: "Pattern",
  });
  assert.match(scraped.productInformation.description, /Printable instructions/);
  assert.equal(scraped.reviewsAndImages.images[0].url, image.src);
  assert.equal(scraped.reviewsAndImages.reviews[0].text, "Lovely pattern");
});
