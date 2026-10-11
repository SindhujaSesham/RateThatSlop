// Change note: Adapt this build script if the Etsy extension adds entry points
// or runtime assets beyond the retained ONNX Runtime Web files.

// Copies the ONNX Runtime Web runtime from node_modules into the extension.
// Everything the extension runs ships inside the extension directory —
// no CDN, no remote code.
import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Get the extension folder location
const here = dirname(fileURLToPath(import.meta.url));

// Source: installed ONNX Runtime files
const src = join(here, "node_modules", "onnxruntime-web", "dist");

// Destination: extension's local runtime folder
const dst = join(here, "vendor", "ort");

// Supabase settings are now read directly from:
// src/background/build-config.js
// We no longer need to generate build-config.json.

// ONNX Runtime files needed for image detection
const KEEP = [
  "ort.webgpu.min.js",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

// Remove old runtime files and recreate the folder
rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });

// Copy required runtime files
let bytes = 0;

for (const f of KEEP) {
  cpSync(join(src, f), join(dst, f));
  bytes += statSync(join(dst, f)).size;
}

console.log(
  `vendored ${KEEP.length} ONNX Runtime Web files (${(bytes / 1e6).toFixed(1)}MB) -> vendor/ort/`
);
