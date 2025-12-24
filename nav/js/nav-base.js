// ==========================
// Nav Base JS（全ページ共通）
// ==========================
document.addEventListener("DOMContentLoaded", () => {

  // ==========================
  // header offcanvas offset
  // ==========================
  function updateHeaderOffset() {
    const header = document.getElementById("main-header");
    if (!header) return;

    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty(
      "--header-height",
      `${header.offsetHeight}px`
    );
  }

  // 初期化
  updateHeaderOffset();

  // リサイズ対応
  window.addEventListener("resize", updateHeaderOffset);

  // スクロールで header 高さが変わるページ対策
  window.addEventListener("scroll", () => {
    requestAnimationFrame(updateHeaderOffset);
  });

  const toggleBtn = document.querySelector(".nav-toggle");
  const offcanvas = document.querySelector(".offcanvas-nav");
  const backdrop  = document.querySelector(".offcanvas-backdrop");

  if (!toggleBtn || !offcanvas) return;

  /* 共通クローズ */
  function closeOffcanvas() {
    offcanvas.classList.remove("show");
    backdrop?.classList.remove("show");
    document.body.classList.remove("scroll-lock");

    // dropdown リセット
    document.querySelectorAll(".offcanvas-group.is-open")
      .forEach(g => g.classList.remove("is-open"));
  }

  /* 🍔 トグル */
  toggleBtn.addEventListener("click", () => {
    const isOpen = offcanvas.classList.contains("show");

    if (isOpen) {
      closeOffcanvas();
    } else {
      offcanvas.classList.add("show");
      backdrop?.classList.add("show");
      document.body.classList.add("scroll-lock");
    }
  });

  /* backdrop クリックで閉じる（主にスマホ） */
  backdrop?.addEventListener("click", closeOffcanvas);

document.querySelectorAll(".offcanvas-toggle").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    const group = btn.closest(".offcanvas-group");
    if (!group) return;

    const isOpen = group.classList.contains("is-open");

    // 他はすべて閉じる
    document.querySelectorAll(".offcanvas-group.is-open")
      .forEach(g => g.classList.remove("is-open"));

    // 自分だけ開く（トグル）
    if (!isOpen) {
      group.classList.add("is-open");
    }
  });
});

// ==========================
// Active 表示（共通）
// ==========================
const page = document.body.dataset.page;

if (page) {
  document
    .querySelectorAll(`.offcanvas-nav a[data-page="${page}"]`)
    .forEach(a => {
      a.classList.add("active");

      // dropdown内なら「親をactiveにするだけ」
      const group = a.closest(".offcanvas-group");
      if (group) {
        group.classList.add("active");
        // ❌ is-open は付けない
      }
    });
}

});