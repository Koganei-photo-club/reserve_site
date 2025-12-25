// ==========================
// Nav Auth Bridge（offcanvas対応）
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const userJson = sessionStorage.getItem("user");

  const loginItem   = document.getElementById("nav-login");
  const loggedinItem = document.getElementById("nav-loggedin");
  const mypageItem  = document.getElementById("nav-mypage");
  const logoutItem  = document.getElementById("nav-logout");
  const nameEl      = document.getElementById("nav-user-name");

  // 必須要素チェック
  if (!loginItem || !loggedinItem || !mypageItem || !logoutItem) return;

  if (userJson) {
    // ===== ログイン中 =====
    const user = JSON.parse(userJson);

    loginItem.style.display    = "none";
    loggedinItem.style.display = "block";
    mypageItem.style.display   = "block";
    logoutItem.style.display   = "block";

    if (nameEl && user.name) {
      nameEl.textContent = user.name;
    }

    const logoutBtn = document.getElementById("logoutBtnOffcanvas");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        sessionStorage.clear();
        window.location.href = "/reserve_site/auth/login.html";
      };
    }

  } else {
    // ===== 未ログイン =====
    loginItem.style.display    = "block";
    loggedinItem.style.display = "none";
    mypageItem.style.display   = "none";
    logoutItem.style.display   = "none";
  }
});