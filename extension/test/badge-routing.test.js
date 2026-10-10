import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const content = await readFile(
  new URL("../src/content/index.js", import.meta.url),
  "utf8",
);
const popup = await readFile(
  new URL("../src/popup/index.js", import.meta.url),
  "utf8",
);

test("content script handles popup result routing and updates repeated images", () => {
  assert.match(content, /message\?\.kind === "aid:show-result"/);
  assert.match(content, /for \(const image of document\.querySelectorAll\("img"\)\)/);
  assert.match(content, /host\.querySelector\("\.ratethatslop-image-badge"\)\?\.remove\(\)/);
});

test("popup forwards successful page scan results to the Etsy tab", () => {
  assert.match(popup, /kind: "aid:show-result"/);
  assert.match(popup, /if \(response\?\.ok\) await showResultOnPage/);
});
