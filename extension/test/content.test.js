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
globalThis.__testApi = { collectPageData, getListingImages, isEtsyPage };`, context);
const { collectPageData, getListingImages, isEtsyPage } = context.__testApi;

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
