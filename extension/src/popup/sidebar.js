// The left branding area can collapse independently of right-panel tabs.
const toggleButton = document.getElementById("toggle-sidebar");
const appCard = document.querySelector(".app-card");
const sidebarContent = document.getElementById("sidebar-content");
const popupBody = document.body;
const popupDocument = document.documentElement;

let isCollapsed = false;

if (toggleButton && appCard && sidebarContent) {
  toggleButton.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    appCard.classList.toggle("sidebar-collapsed", isCollapsed);
    popupBody.classList.toggle("sidebar-collapsed", isCollapsed);
    popupDocument.classList.toggle("sidebar-collapsed", isCollapsed);
    sidebarContent.hidden = isCollapsed;
    toggleButton.textContent = isCollapsed ? "→" : "←";
    toggleButton.setAttribute("aria-expanded", String(!isCollapsed));
    toggleButton.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar");
  });
}
