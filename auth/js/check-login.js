// auth/check-login.js

(function() {
  const raw = sessionStorage.getItem("user");
  if (!raw) {
    // 未ログイン → トップへ
    window.location.href = "/index.html";
    return;
  }

  try {
    const user = JSON.parse(raw);

    // data-user-name, data-user-grade, data-user-email に埋め込み
    document.querySelectorAll("[data-user-name]").forEach(el => {
      el.textContent = user.name || "";
    });
    document.querySelectorAll("[data-user-email]").forEach(el => {
      el.textContent = user.email || "";
    });
    document.querySelectorAll("[data-user-grade]").forEach(el => {
      el.textContent = user.gradeLabel || ""; // GAS側で gradeLabel を返しておくと◎
    });

    // ログアウトボタン（あれば）
    const logoutBtn = document.querySelector("[data-logout]");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("user");
        window.location.href = "/index.html";
      });
    }

  } catch (e) {
    console.error(e);
    sessionStorage.removeItem("user");
    window.location.href = "/index.html";
  }
})();