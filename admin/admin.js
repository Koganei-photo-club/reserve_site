// admin.js
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ ログインチェック & 管理者判定
  const raw = sessionStorage.getItem("user");
  if (!raw) {
    alert("ログインが必要です。");
    location.href = "/reserve_site/auth/login.html";
    return;
  }

  const currentUser = JSON.parse(raw);

  // 役職ID: 0=役職なし, 1=部長, 2=副部長, 3=会計, 4=文連, 7=OB/OG
  const adminRoles = new Set([1, 2, 3, 4]);

  if (!adminRoles.has(Number(currentUser.role))) {
    // 一応見せるけど編集できないようにする形でもOK
    alert("管理者権限がありません。");
    // 一覧は見せてもいいならコメントアウト
    // location.href = "/reserve_site/mypage.html";
    // return;
  }

  const gradeNames = ["", "B1","B2","B3","B4","M1","M2","OB/OG"];
  const roleNames  = ["役職なし","部長","副部長","会計","文連"];

  const tbody = document.getElementById("users-table");
  const modal = document.getElementById("edit-modal");
  const modalName = document.getElementById("edit-name");
  const gradeSelect = document.getElementById("edit-grade");
  const roleSelect  = document.getElementById("edit-role");
  const saveBtn     = document.getElementById("edit-save");
  const cancelBtn   = document.getElementById("edit-cancel");
  const msgBox      = document.getElementById("edit-message");

  let users = [];      // /list の結果を保持
  let editingIndex = null;

  // 2️⃣ ユーザー一覧取得
  async function loadUsers() {
    tbody.innerHTML = "<tr><td colspan='4'>読み込み中…</td></tr>";

    try {
      // USER_API は app-auth.js で定義済み
      const res = await fetch(USER_API + "?mode=list");
      const data = await res.json();
      users = data.users || [];

      if (users.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>ユーザーが登録されていません</td></tr>";
        return;
      }

      tbody.innerHTML = users.map((u, i) => `
        <tr>
          <td>${u.name}</td>
          <td>${gradeNames[u.grade] || "-"}</td>
          <td>${roleNames[u.role] ?? "？"}</td>
          <td>
            ${adminRoles.has(Number(currentUser.role))
              ? `<button class="edit-btn" data-index="${i}">編集</button>`
              : `-`}
          </td>
        </tr>
      `).join("");

      // 編集ボタンにイベント付与
      tbody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.index);
          openEditModal(i);
        });
      });
    } catch (e) {
      console.error(e);
      tbody.innerHTML = "<tr><td colspan='4'>読み込みエラー</td></tr>";
    }
  }

  // 3️⃣ 編集モーダルを開く
  function openEditModal(index) {
    editingIndex = index;
    const u = users[index];

    modalName.textContent = `${u.name}（${u.email}）`;
    gradeSelect.value = String(u.grade);  // 1〜7
    roleSelect.value  = String(u.role);   // 0〜4

    msgBox.textContent = "";

    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("show"), 10);
  }

  // 4️⃣ モーダル閉じる
  function closeEditModal() {
    modal.classList.remove("show");
    setTimeout(() => modal.style.display = "none", 200);
    editingIndex = null;
  }

  cancelBtn.addEventListener("click", closeEditModal);

  // 5️⃣ 保存ボタン → GAS へ POST
  saveBtn.addEventListener("click", async () => {
    if (editingIndex == null) return;

    const u = users[editingIndex];
    const newGrade = Number(gradeSelect.value);
    const newRole  = Number(roleSelect.value);

    msgBox.textContent = "⏳ 更新中…";

    try {
      const res = await fetch(USER_API, {
        method: "POST",
        body: JSON.stringify({
          mode:  "updateUser",
          email: u.email,
          grade: newGrade,
          role:  newRole
        })
      });

      const data = await res.json();
      console.log("updateUser response:", data);

      if (data.result === "success") {
        msgBox.textContent = "✔ 更新しました";
        // ローカル配列も更新
        users[editingIndex].grade = newGrade;
        users[editingIndex].role  = newRole;

        // 表も更新
        loadUsers();
        setTimeout(closeEditModal, 500);
      } else {
        msgBox.textContent = "⚠ 更新に失敗: " + (data.message || "Unknown error");
      }

    } catch (e) {
      console.error(e);
      msgBox.textContent = "⚠ 通信エラーが発生しました";
    }
  });

  // 初回読み込み
  loadUsers();
});