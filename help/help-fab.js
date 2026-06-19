// ==========================
// Floating Help Button
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.querySelector(".help-fab-wrap");
  const button = document.querySelector(".help-fab-button");
  const panel = document.querySelector(".help-fab-panel");

  if (!wrap || !button || !panel) return;

  function openHelp() {
    wrap.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
  }

  function closeHelp() {
    wrap.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  }

  function toggleHelp() {
    if (wrap.classList.contains("is-open")) {
      closeHelp();
    } else {
      openHelp();
    }
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleHelp();
  });

  panel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    closeHelp();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHelp();
    }
  });

  panel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeHelp();
    });
  });
});