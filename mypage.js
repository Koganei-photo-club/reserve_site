// ▼ セッションチェック（未ログインなら拒否）
const userData = sessionStorage.getItem("user");
if (!userData) {
  window.location.href = "../auth/login.html";
}

// ▼ ユーザー情報を反映
const user = JSON.parse(userData);
document.getElementById("mp-name").textContent = user.name;
document.getElementById("mp-grade").textContent = user.gradeLabel;
document.getElementById("mp-line").textContent = user.lineName;
document.getElementById("mp-email").textContent = user.email;

// ▼ ログアウト
document.getElementById("logoutBtn").onclick = () => {
  sessionStorage.clear();
  window.location.href = "../auth/login.html";
};