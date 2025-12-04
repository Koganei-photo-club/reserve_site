// /reserve_site/pc/admin-pc.js
(() => {
  const PC_API = "https://pc-proxy.photo-club-at-koganei.workers.dev/";
  const adminRoles = [1, 2, 3, 4]; // 部長/副部長/会計/文連のみ

  document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("user");
    if (!userJson) {
      alert("ログインしてください。");
      location.href = "/reserve_site/auth/login.html";
      return;
    }

    const user = JSON.parse(userJson);

    // 管理者権限チェック
    if (!adminRoles.includes(Number(user.role))) {
      alert("管理者権限が必要です。");
      location.href = "/reserve_site/mypage.html";
      return;
    }

    loadPcAdminTable();
  });

  async function loadPcAdminTable() {
    const box = document.getElementById("pc-admin-table");
    if (!box) return;
    box.textContent = "読み込み中…";

    try {
      const res  = await fetch(PC_API);
      const data = await res.json();
      const rows = data.rows || [];

      // 🔽 新しい日付順にソート（降順）
      rows.sort((a, b) => {
        return new Date(b.start) - new Date(a.start);
      });

      if (rows.length === 0) {
        box.textContent = "現在、PCの予約はありません。";
        return;
      }

      box.innerHTML = `
        <table class="reserve-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>枠</th>
              <th>日付</th>
              <th>認証コード</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td>${r.name || "?"}</td>
                <td>${r.slot || "?"}</td>
                <td>${r.start || "?"}</td>
                <td>${r.code || "?"}</td>
                <td>
                  <button class="cancel-btn" data-index="${i}">
                    管理者キャンセル
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;

      // ボタンにイベント付与
      box.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.index);
          const r = rows[idx];
          handlePcAdminCancel(r);
        });
      });

    } catch (err) {
      console.error("PC一覧取得失敗:", err);
      box.textContent = "予約データの取得に失敗しました。";
    }
  }

  // 🔻 管理者キャンセル処理 🔻
  async function handlePcAdminCancel(r) {
    if (!r) return;

    const ok = confirm(
      `次の予約をキャンセルしますか？\n\n` +
      `氏名：${r.name}\n` +
      `日付：${r.start}\n` +
      `枠：${r.slot}\n` +
      `認証コード：${r.code}`
    );
    if (!ok) return;

    const payload = {
      mode: "cancel",
      email: r.email,
      start: r.start,  // date
      slot: r.slot,    // 時間帯
      code: r.code
    };

    try {
      const res = await fetch(PC_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => null);

      console.log("📥 PC admin cancel:", result);

      if (result?.result === "success" || result?.status === "success") {
        alert("キャンセルしました。");
        location.reload();
      } else {
        alert("キャンセル失敗：" + JSON.stringify(result));
      }

    } catch (err) {
      console.error(err);
      alert("通信エラーが発生しました。");
    }
  }

})();