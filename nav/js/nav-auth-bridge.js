// ==========================
// Offcanvas Auth UI Bridge
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  const userJson = sessionStorage.getItem("user");
  const isLoggedIn = !!userJson;

  const navLogin    = document.getElementById("nav-login");
  const navLoggedIn = document.getElementById("nav-loggedin");
  const navMypage   = document.getElementById("nav-mypage");
  const navLogout   = document.getElementById("nav-logout");

  if (!navLogin || !navMypage || !navLogout) return;

  if (isLoggedIn) {
    navLogin.style.display    = "none";
    if (navLoggedIn) navLoggedIn.style.display = "block";
    navMypage.style.display   = "block";
    navLogout.style.display   = "block";

    // ユーザー名表示
    if (nameEl && user.name) {
      nameEl.textContent = user.name;
    }

  } else {
    navLogin.style.display    = "block";
    if (navLoggedIn) navLoggedIn.style.display = "none";
    navMypage.style.display   = "none";
    navLogout.style.display   = "none";
  }

  // ログアウト処理（既存仕様に合わせる）
  const logoutBtn = document.getElementById("logoutBtnOffcanvas");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", e => {
      e.preventDefault();
      sessionStorage.clear();
      location.href = "/reserve_site/auth/login.html";
    });
  }
});