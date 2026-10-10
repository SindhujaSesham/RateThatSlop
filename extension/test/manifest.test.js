import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8"),
);

test("allows the offscreen inference document to fetch Etsy CDN images", () => {
  assert.ok(manifest.host_permissions.includes("*://*.etsystatic.com/*"));
});
