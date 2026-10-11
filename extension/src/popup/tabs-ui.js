// Scores, signup/login form UI, and local Settings preferences.
// Authentication is NOT connected to Supabase yet.
import { showView } from "./navigation.js";

const $ = (selector) => document.querySelector(selector);
const scoresEmpty = $("#scores-empty");
const scoresData = $("#scores-data");
const scoresImages = $("#scores-images");
const scoresHeading = $("#scores-heading");
const scoresSummary = $("#scores-summary");

const retryButton = $("#scores-retry");
retryButton.addEventListener("click", () => {
  $("#scores-empty-message").textContent = "Scanning this listing…";
  document.dispatchEvent(new Event("rts:scan-requested"));
});
document.addEventListener("rts:scan-unavailable", (event) => {
  if (scoresData.hidden) {
    $("#scores-empty-message").textContent = event.detail.message;
    scoresEmpty.hidden = false;
  }
});
$("#scores-report-login").addEventListener("click", () => showView("auth"));

// Display Etsy thumbnails immediately, then update each score as ONNX finishes.
let currentImages = [];

function createScoreCard(item, index) {
  const card = document.createElement("article");
  card.className = "score-image-card";
  const photo = document.createElement("div");
  photo.className = "score-image-photo";
  const img = document.createElement("img");
  img.src = item.url;
  img.alt = item.alt || `Image ${index + 1}`;
  img.loading = "lazy";
  const rating = document.createElement("span");
  rating.className = "score-image-overlay";
  rating.textContent = item.result && Number.isFinite(Number(item.result.score))
    ? `${(Number(item.result.score) * 100).toFixed(1)}% AI`
    : (item.status || "Waiting…");
  const caption = document.createElement("p");
  caption.textContent = `Image ${index + 1}`;
  photo.append(img, rating);
  card.append(photo, caption);
  return card;
}

function updateScoreSummary() {
  const successful = currentImages.filter((item) =>
    item.result && Number.isFinite(Number(item.result.score))
  ).length;
  const completed = currentImages.filter((item) => item.status !== "Analyzing…").length;
  scoresSummary.textContent = `${successful} of ${currentImages.length} images scored · ${completed} processed`;
}

document.addEventListener("rts:analysis-start", (event) => {
  currentImages = event.detail.images.map((item) => ({ ...item }));
  scoresEmpty.hidden = true;
  scoresData.hidden = false;
  scoresHeading.textContent = event.detail.title;
  scoresImages.replaceChildren(...currentImages.map(createScoreCard));
  updateScoreSummary();
});

document.addEventListener("rts:analysis-progress", (event) => {
  const { index, item } = event.detail;
  currentImages[index] = item;
  const oldCard = scoresImages.children[index];
  if (oldCard) oldCard.replaceWith(createScoreCard(item, index));
  updateScoreSummary();
});

document.addEventListener("rts:analysis", (event) => {
  if (event.detail.type !== "listing") return;
  currentImages = event.detail.images;
  scoresEmpty.hidden = true;
  scoresData.hidden = false;
  scoresHeading.textContent = event.detail.title;
  scoresImages.replaceChildren(...currentImages.map(createScoreCard));
  updateScoreSummary();
});

// The form UI is fully navigable. Submitting credentials is intentionally
// blocked until the real background authentication handler is implemented.
let authMode = "login";
const authForm = $("#auth-form");
const authHeading = $("#auth-heading");
const authSubmit = $("#auth-submit");
const authSwitch = $("#auth-switch");
const authFeedback = $("#auth-feedback");
const password = $("#auth-password");

function updateAuthMode() {
  const registering = authMode === "signup";
  authHeading.textContent = registering ? "Create account" : "Log in";
  authSubmit.textContent = registering ? "Sign up" : "Log in";
  authSwitch.textContent = registering ? "Already have an account? Log in" : "Need an account? Sign up";
  password.autocomplete = registering ? "new-password" : "current-password";
  authFeedback.textContent = "";
}

authSwitch.addEventListener("click", () => {
  authMode = authMode === "login" ? "signup" : "login";
  authForm.reset();
  updateAuthMode();
});
authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authFeedback.textContent = "Authentication is not connected yet. Next step: connect this form to Supabase.";
  password.value = "";
});

// All settings require authentication. For now, keep every switch disabled.
// Do not load/store local preferences or allow changes before sign-in.
// A future auth:status handler will enable them after verifying a real session.
document.querySelectorAll("[data-setting]").forEach((control) => {
  control.disabled = true;
  control.closest(".setting-row")?.classList.add("locked");
});

// The scanner is guest-accessible and runs on an Etsy listing at popup start.
document.dispatchEvent(new Event("rts:scan-requested"));
