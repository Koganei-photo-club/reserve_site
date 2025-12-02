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
  const roleNames = ["役職なし","部長","副部長","会計","文連"];
  const gradeNames = ["","B1","B2","B3","B4","M1","M2","OB/OG"];

  const tbody = document.getElementById("users-table");
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${gradeNames[u.grade] || "-"}</td>
      <td>${roleNames[u.role] || "？"}</td>
      <td>
        <button class="edit-btn" data-index="${i}">編集</button>
      </td>
    </tr>
  `).join("");
}

// function editUser(email) {
//   alert("後ほど：編集モーダルを追加します！\n対象: " + email);
// }

const editModal = document.getElementById("editModal");
const editName = document.getElementById("editName");
const editGrade = document.getElementById("editGrade");
const editRole = document.getElementById("editRole");
const saveBtn = document.getElementById("saveUserBtn");
const closeBtn = document.getElementById("closeModalBtn");

let editingIndex = null;

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-btn")) {
    editingIndex = e.target.dataset.index;
    const u = users[editingIndex];

    editName.textContent = u.name;
    editGrade.value = u.grade;
    editRole.value = u.role;

    editModal.style.display = "flex";
    setTimeout(() => editModal.classList.add("show"), 10);
  }
});

closeBtn.onclick = () => {
  editModal.classList.remove("show");
  setTimeout(() => editModal.style.display = "none", 200);
};