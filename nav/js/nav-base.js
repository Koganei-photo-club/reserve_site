// ==========================
// Nav Base JS（全ページ共通）
// ==========================
document.addEventListener("DOMContentLoaded", () => {

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
    document.querySelectorAll(".offcanvas-group.open")
      .forEach(g => g.classList.remove("open"));
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

  /* dropdown（1つだけ開く） */
  document.querySelectorAll(".offcanvas-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.closest(".offcanvas-group");
      if (!group) return;

      const isOpen = group.classList.contains("open");

      document.querySelectorAll(".offcanvas-group.open")
        .forEach(g => g.classList.remove("open"));

      if (!isOpen) {
        group.classList.add("open");
      }
    });
  });

// ==========================
// Active 表示（共通）
// ==========================
const page = document.body.dataset.page;
if (page) {
  // オフキャンバス
  document
    .querySelectorAll(`.offcanvas-nav a[data-page="${page}"]`)
    .forEach(a => {
      a.classList.add("active");

      // dropdown内なら親を開く
      const group = a.closest(".offcanvas-group");
      if (group) group.classList.add("open");
    });
}

});