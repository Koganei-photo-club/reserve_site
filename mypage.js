// ======================
// マイページ表示制御
// ======================

document.addEventListener("DOMContentLoaded", () => {

  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    window.location.href = "/reserve_site/auth/login.html";
    return;
  }

  const user = JSON.parse(userJson);

  // 基本情報表示
  const gradeNames = ["","B1","B2","B3","B4","M1","M2"];
  const roleNames  = ["役職なし","部長","副部長","会計","文連"];

  document.getElementById("mp-name").textContent  = user.name;
  document.getElementById("mp-grade").textContent = gradeNames[user.grade] ?? "ー";
  document.getElementById("mp-line").textContent  = user.lineName;
  document.getElementById("mp-email").textContent = user.email;
  document.getElementById("mp-role").textContent  = roleNames[user.role] ?? "ー";

  // ログアウト
  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "/reserve_site/auth/login.html";
  };

  loadCameraReservations(user);
  loadPCReservations(user);
});

// ======================
// 🔹 カメラ予約読み込み
// ======================

const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

async function loadReservations(email) {
  let list = document.getElementById("reserve-list");
  list.innerHTML = "読み込み中…";

  try {
    const res = await fetch(CAMERA_API);
    const data = await res.json();
    const rows = data.rows || [];

    // 👤 user.name でフィルタ（メールより確実）
    const userRes = rows.filter(r => r.name === user.name);

    if (userRes.length === 0) {
      list.innerHTML = "現在アクティブな予約はありません。";
      return;
    }

    // 🔥 HTML生成（キャンセルボタン付き）
    list.innerHTML = userRes.map((r, idx) => `
      <div class="reserve-item" data-index="${idx}">
        <strong>${r.equip}</strong><br>
        ${r.start} 〜 ${r.end}<br>
        認証コード: ${r.code}<br>
        <button class="cancel-btn" data-code="${r.code}" data-equip="${r.equip}" data-start="${r.start}">
          キャンセル
        </button>
      </div>
    `).join("");

    // ------- 🔹キャンセルボタン処理 ------ //
    document.querySelectorAll(".cancel-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const payload = {
          mode: "cancel",
          name: user.name,
          equip: btn.dataset.equip,
          start: btn.dataset.start,
          code: btn.dataset.code
        };

        const ok = confirm("予約をキャンセルしますか？");
        if (!ok) return;

        await fetch(CAMERA_API, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        alert("キャンセル完了！");
        loadReservations(); // ← 自動再読み込み！！🔥
      });
    });

  } catch (err) {
    console.error(err);
    list.innerHTML = "予約情報を取得できませんでした。";
  }
}

// ======================
// 🔹 PC予約読み込み
// ======================

const PC_API = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

async function loadPCReservations(user) {
  const container = document.getElementById("pc-reservations");
  container.textContent = "読み込み中...";

  try {
    const res = await fetch(PC_API);
    const data = await res.json();
    const rows = data.rows || [];

    const myRows = rows.filter(r => r.name === user.name);

    if (myRows.length === 0) {
      container.textContent = "予約はありません";
      return;
    }

    myRows.sort((a,b)=> new Date(a.start) - new Date(b.start));

    container.innerHTML = `
      <table class="mypage-table">
        <tr><th>枠</th><th>日時</th><th>認証コード</th></tr>
        ${myRows.map(r=>`
          <tr>
            <td>${r.pc}</td>
            <td>${r.start}</td>
            <td>${r.code}</td>
          </tr>
        `).join("")}
      </table>
    `;

  } catch {
    container.textContent = "取得エラー";
  }
}