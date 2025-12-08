// /reserve_site/camera/admin-camera.js
(() => {
  const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
  // 1:部長 / 2:副部長 / 3:会計 / 4:文連
  const adminRoles = [1, 2, 3, 4];

  document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("user");
    if (!userJson) {
      alert("ログインしてください。");
      location.href = "/reserve_site/auth/login.html";
      return;
    }
    const user = JSON.parse(userJson);

    // 管理者チェック
    if (!adminRoles.includes(Number(user.role))) {
      alert("管理者権限が必要です。");
      location.href = "/reserve_site/mypage.html";
      return;
    }

    loadCameraAdminTable(user);
  });

  async function loadCameraAdminTable(currentUser) {
    const box = document.getElementById("camera-admin-table");
    if (!box) return;
    box.textContent = "読み込み中…";

    try {
      const res  = await fetch(CAMERA_API);
      const data = await res.json();
      const rows = data.rows || [];
      // 🔽 新しいstart日時順にソート
      rows.sort((a, b) => {
        return new Date(b.start) - new Date(a.start); // 降順（新しい → 古い）
      });

      if (rows.length === 0) {
        box.innerHTML = "<p>現在、カメラの予約はありません。</p>";
        return;
      }

      // 予約一覧テーブルを生成
      box.innerHTML = `
        <table class="reserve-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>機材</th>
              <th>期間</th>
              <th>認証コード</th>
              <th>処理</th>
              <th>キャンセル</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => {
              let procHtml = "";

              if (!r.beforeChecked) {
                // 貸出処理まだ
                procHtml = `
                <button class="process-btn"
                  data-index="${i}"
                  data-type="lend">
                  貸出処理
                </button>`;
              } else if (r.beforeChecked && !r.afterChecked) {
                // 貸出済み・返却前
                procHtml = `
                <button class="process-btn"
                  data-index="${i}"
                  data-type="return">
                  返却処理
                </button>`;
              } else {
                // 返却処理済み
                procHtml = `<span class="process-done">返却済み</span>`;
              }
              
              return `
              <tr data-index="${i}">
                <td>${r.name || "?"}</td>
                <td>${r.equip || "?"}</td>
                <td>${r.start || "?"}〜${r.end || "?"}</td>
                <td>${r.code || "?"}</td>
                <td>${procHtml}</td>
                <td>
                  <button class="cancel-btn" data-index="${i}">
                    管理者キャンセル
                  </button>
                </td>
              </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;

      // 貸出処理/返却処理ボタンにイベント付与
      box.querySelectorAll(".process-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx  = Number(btn.dataset.index);
          const type = btn.dataset.type; // "lend" or "return"
          const r    = rows[idx];
          handleProcess(r, type);
        });
      });
      // キャンセルボタンにイベント付与
      box.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.index);
          const r = rows[idx];
          handleCameraAdminCancel(r);
        });
      });

    } catch (err) {
      console.error(err);
      box.textContent = "予約情報取得に失敗しました。";
    }
  }

  // ✴ 管理者：貸出／返却処理
  async function handleProcess(r, type) {
    const label = (type === "return") ? "返却処理" : "貸出処理";

    const ok = confirm(
      `次の予約に対して「${label}」を記録しますか？\n\n` +
      `氏名：${r.name}\n` +
      `機材：${r.equip}\n` +
      `期間：${r.start}〜${r.end}\n` +
      `認証コード：${r.code}`
    );
    if (!ok) return;

    const payload = {
      mode: "process",
      type,           // "lend" or "return"
      email: r.email, // ← doGet で email を返している想定
      equip: r.equip,
      start: r.start,
      code:  r.code
    };

    try {
      const res = await fetch(CAMERA_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
        });
      const result = await res.json().catch(() => null);

      if (result?.result === "success") {
        alert(`${label}を記録しました。`);
        location.reload();
      } else {
        alert("処理に失敗しました：" + (result?.message || JSON.stringify(result)));
      }
    } catch (err) {
      console.error(err);
      alert("通信エラーが発生しました。");
    }
  }

  async function handleCameraAdminCancel(r) {
    if (!r) return;

    const ok = confirm(
      `次の予約をキャンセルしますか？\n\n` +
      `氏名：${r.name}\n` +
      `機材：${r.equip}\n` +
      `期間：${r.start}〜${r.end}\n` +
      `認証コード：${r.code}`
    );
    if (!ok) return;

    // ※ camera のキャンセルは既存のユーザーキャンセル API をそのまま利用
    const payload = {
      mode: "cancel",
      email: r.email,          // rows に email が入っている前提（既存仕様）
      equip: r.equip,
      start: r.start,
      code: r.code
    };

    try {
      const res = await fetch(CAMERA_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json().catch(() => null);
      console.log("📥Camera admin cancel:", result);

      if (result?.result === "success" || result?.status === "success") {
        alert("キャンセルしました。");
        location.reload();
      } else {
        alert("キャンセルに失敗しました：" + (result?.message || JSON.stringify(result)));
      }
    } catch (err) {
      console.error(err);
      alert("通信エラーが発生しました。");
    }
  }

})();