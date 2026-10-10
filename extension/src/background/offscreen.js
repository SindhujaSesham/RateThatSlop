// Local ONNX inference. Images are fetched and processed inside the extension;
// no image bytes are sent to a remote service.

const MODEL_URL = chrome.runtime.getURL("src/background/w5810_best_fp16.onnx");
const MANIFEST_URL = chrome.runtime.getURL("model_manifest.json");
let sessionPromise = null;
let manifestPromise = null;

async function getManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then((response) => {
      if (!response.ok) throw new Error(`model manifest fetch failed: ${response.status}`);
      return response.json();
    });
  }
  return manifestPromise;
}

async function getSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`model fetch failed: ${response.status}`);
      const model = await response.arrayBuffer();
      ort.env.wasm.wasmPaths = chrome.runtime.getURL("vendor/ort/");
      ort.env.wasm.numThreads = 1;
      return ort.InferenceSession.create(model, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

async function getBlob(imageUrl, imageData) {
  if (imageData) {
    const response = await fetch(imageData);
    if (!response.ok) throw new Error("image data could not be decoded");
    return response.blob();
  }
  const response = await fetch(imageUrl, { credentials: "omit", cache: "force-cache" });
  if (!response.ok) throw new Error(`image fetch failed: ${response.status}`);
  return response.blob();
}

async function decodeImage(blob) {
  const bitmap = await createImageBitmap(blob);
  if (bitmap.width < 32 || bitmap.height < 32) {
    bitmap.close();
    throw new Error("image is too small; minimum size is 32x32 pixels");
  }
  return bitmap;
}

function sigmoid(logit, calibration = {}) {
  if (calibration.type && calibration.type !== "sigmoid") {
    throw new Error(`unsupported calibration type: ${calibration.type}`);
  }
  const temperature = Number(calibration.temperature || 1);
  const bias = Number(calibration.bias || 0);
  if (!Number.isFinite(temperature) || temperature <= 0 || !Number.isFinite(bias)) {
    throw new Error("invalid sigmoid calibration parameters");
  }
  const value = logit / temperature + bias;
  return 1 / (1 + Math.exp(-value));
}

async function imageToTensor(bitmap, manifest) {
  const size = Number(manifest.input_size);
  const shorterSide = Number(manifest.resize_shorter_side || size);
  if (!Number.isInteger(size) || size <= 0 || !Number.isFinite(shorterSide) || shorterSide < size) {
    throw new Error("invalid model input size in manifest");
  }
  const scale = shorterSide / Math.min(bitmap.width, bitmap.height);
  const width = Math.max(size, Math.round(bitmap.width * scale));
  const height = Math.max(size, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);
  const pixels = context.getImageData(left, top, size, size).data;
  const mean = manifest.norm_mean;
  const standardDeviation = manifest.norm_std;
  if (
    !Array.isArray(mean) ||
    mean.length !== 3 ||
    !Array.isArray(standardDeviation) ||
    standardDeviation.length !== 3 ||
    standardDeviation.some((value) => !Number.isFinite(Number(value)) || Number(value) <= 0)
  ) {
    throw new Error("invalid normalization values in manifest");
  }
  const plane = size * size;
  const values = new Float32Array(plane * 3);

  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    values[index] = (pixels[pixel] / 255 - mean[0]) / standardDeviation[0];
    values[plane + index] = (pixels[pixel + 1] / 255 - mean[1]) / standardDeviation[1];
    values[(plane * 2) + index] = (pixels[pixel + 2] / 255 - mean[2]) / standardDeviation[2];
  }
  return new ort.Tensor("float32", values, [1, 3, size, size]);
}

async function infer(imageUrl, imageData) {
  const started = performance.now();
  const [session, manifest, blob] = await Promise.all([
    getSession(),
    getManifest(),
    getBlob(imageUrl, imageData),
  ]);
  const bitmap = await decodeImage(blob);
  try {
    const tensor = await imageToTensor(bitmap, manifest);
    const output = await session.run({
      [session.inputNames[0]]: tensor,
    });
    const outputTensor = output[session.outputNames[0]];
    const rawOutput = Number(outputTensor?.data?.[0]);
    if (!Number.isFinite(rawOutput)) {
      throw new Error("model returned an invalid output");
    }
    const score = sigmoid(rawOutput, manifest.calibration);
    return {
      ok: true,
      score,
      processingTimeMs: Math.round(performance.now() - started),
    };
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.kind !== "aid:infer") return false;
  infer(message.imageUrl, message.imageData)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
