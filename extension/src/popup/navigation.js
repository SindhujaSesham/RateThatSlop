// Switch only the right-hand popup view; the sidebar stays in place.
const VIEWS = ["scores", "auth", "manual", "settings"];

export function showView(viewName) {
  if (!VIEWS.includes(viewName)) {
    console.error(`Unknown view: ${viewName}`);
    return;
  }

  for (const name of VIEWS) {
    const view = document.getElementById(`${name}-view`);
    if (view) view.hidden = name !== viewName;
  }

  document.querySelectorAll(".popup-nav [data-view]").forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

document.querySelectorAll(".popup-nav [data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

// Opening the popup always starts on Scores.
showView("scores");
