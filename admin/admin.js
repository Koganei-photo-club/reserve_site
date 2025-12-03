// const USER_API = "https://script.google.com/macros/s/AKfycbxWNWz8aIr_8DqTTHsk9y089ZLZO6B8m2ywd6e1kCWi6Fyhr4AIOcS5QwdXpHxjx8w/exec";

// 管理者役職番号
const adminRoles = [1, 2, 3, 4];

// ====================
// 初期処理
// ====================
document.addEventListener("DOMContentLoaded", () => {
  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    return location.href = "/reserve_site/auth/login.html";
  }

  const user = JSON.parse(userJson);

  // ❌ 管理者以外 → 強制退去
  if (!adminRoles.includes(Number(user.role))) {
    alert("管理者専用ページです");
    return location.href = "/reserve_site/mypage.html";
  }

  loadUsers();

  // 編集モーダル保存処理
  document.getElementById("editSave").addEventListener("click", updateUserInfo);
});

// ====================
// ユーザー一覧読み込み
// ====================
async function loadUsers() {
  const tbody = document.getElementById("users-table");
  tbody.innerHTML = "<tr><td colspan='4'>読み込み中...</td></tr>";

  const res = await fetch(USER_API + "?mode=list");
  const data = await res.json();
  const users = data.users || [];

  const gradeNames = ["-", "B1", "B2", "B3", "B4", "M1", "M2", "OB/OG"];
  const roleNames = ["役職なし","部長","副部長","会計","文連"];

  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${u.name}</td>
      <td>${gradeNames[u.grade] || "-"}</td>
      <td>${roleNames[u.role] || "-"}</td>
      <td>
        <button class="edit-btn" onclick="openEditModal(${i})">編集</button>
      </td>
    </tr>
  `).join("");

  window._userList = users; // モーダルで参照用
}

// ====================
// 編集モーダル表示
// ====================
function openEditModal(index) {
  const u = window._userList[index];
  document.getElementById("edit-email").value = u.email;
  document.getElementById("edit-grade").value = u.grade;
  document.getElementById("edit-role").value = u.role;

  document.getElementById("editModal").style.display = "flex";
}

// ====================
// 更新送信
// ====================
async function updateUserInfo() {
  const payload = {
    mode: "updateUser",
    email: document.getElementById("edit-email").value,
    grade: document.getElementById("edit-grade").value,
    role: document.getElementById("edit-role").value
  };

  const res = await fetch(USER_API, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.result === "success") {
    alert("更新しました！");
    location.reload();
  } else {
    alert("更新失敗: " + (result.message || "？"))
  }
}