// Change note: Adapt this build script if the Etsy extension adds entry points
// or runtime assets beyond the retained ONNX Runtime Web files.

// Copies the ONNX Runtime Web runtime from node_modules into the extension.
// Everything the extension runs ships inside the extension directory —
// no CDN, no remote code.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "node_modules", "onnxruntime-web", "dist");
const dst = join(here, "vendor", "ort");
const generatedConfig = join(here, "src", "background", "build-config.json");
const backendEnv = join(here, "..", "backend", ".env");

function readPublicSupabaseConfig() {
  if (!existsSync(backendEnv)) return {};
  const values = {};
  for (const line of readFileSync(backendEnv, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

const publicConfig = readPublicSupabaseConfig();
writeFileSync(generatedConfig, JSON.stringify({
  SUPABASE_URL: publicConfig.SUPABASE_URL || "",
  SUPABASE_PUBLISHABLE_KEY: publicConfig.SUPABASE_PUBLISHABLE_KEY || "",
}, null, 2) + "\n");
console.log(`generated Supabase extension config from ${existsSync(backendEnv) ? "backend/.env" : "empty defaults"}`);

// Only the files Sieve actually loads. offscreen.html statically loads the
// webgpu (jsep) bundle, which lazily requests exactly its matching wasm pair.
// The forced-WASM path in the test suite (mode-test.mjs) proves the wasm
// fallback works from this exact set — extend the list only with test cover.
const KEEP = [
  "ort.webgpu.min.js",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
];

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
let bytes = 0;
for (const f of KEEP) {
  cpSync(join(src, f), join(dst, f));
  bytes += statSync(join(dst, f)).size;
}
console.log(`vendored ${KEEP.length} ONNX Runtime Web files (${(bytes / 1e6).toFixed(1)}MB) -> vendor/ort/`);
