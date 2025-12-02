// admin/admin.js

document.addEventListener("DOMContentLoaded", async () => {
  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    return location.href = "/reserve_site/auth/login.html";
  }
  const user = JSON.parse(userJson);

  // 管理者チェック
  if (!(["部長","副部長","会計","文連"].includes(user.role))) {
    document.getElementById("no-permission").style.display = "block";
    return;
  }

  document.getElementById("admin-section").style.display = "block";

  loadUsers();
});

async function loadUsers() {
  const res = await fetch(USER_API + "?mode=list");
  const data = await res.json();
  const users = data.users || [];

  const tbody = document.getElementById("users-table");
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.grade}</td>
      <td>${u.role}</td>
      <td><button onclick="editUser('${u.email}')">編集</button></td>
    </tr>
  `).join("");
}

function editUser(email) {
  alert("後ほど：編集モーダルを追加します！\n対象: " + email);
}