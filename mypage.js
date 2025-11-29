// ======================
// マイページ表示制御
// ======================
const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const PC_API = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

document.addEventListener("DOMContentLoaded", () => {

  // ユーザー情報の取得
  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    window.location.href = "/reserve_site/auth/login.html";
    return;
  }

  const user = JSON.parse(userJson);

  const gradeNames = ["","B1","B2","B3","B4","M1","M2"];
  const roleNames  = ["役職なし","部長","副部長","会計","文連"];

  document.getElementById("mp-name").textContent  = user.name;
  document.getElementById("mp-grade").textContent = gradeNames[user.grade] ?? "ー";
  document.getElementById("mp-line").textContent  = user.lineName;
  document.getElementById("mp-email").textContent = user.email;
  document.getElementById("mp-role").textContent  = roleNames[user.role] ?? "ー";

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "/reserve_site/auth/login.html";
  };

  // 🔹カメラ予約API
  // const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  async function loadCameraReservations() {
    const list = document.getElementById("reserve-list");
    list.innerHTML = "読み込み中…";

    try {
      const res = await fetch(CAMERA_API);
      const data = await res.json();
      const rows = data.rows || [];

      const myRes = rows.filter(r => r.name === user.name);

      if (myRes.length === 0) {
        list.innerHTML = `<div class="reserve-item">予約はありません</div>`;
        return;
      }

      list.innerHTML = `
        <table class="reserve-table">
          <tr><th>機材</th><th>期間</th><th>認証コード</th></tr>
          ${myRes.map(r => `
            <tr>
              <td>${r.equip}</td>
              <td>${r.start}〜${r.end}</td>
              <td>${r.code}</td>
              <td>
                <button class="cancel-btn" data-equip="${r.equip}" data-start="${r.start}" data-code="${r.code}">
                  取り消し
                </button>
              </td>
            </tr>
          `).join("")}
        </table>
      `;

      document.querySelectorAll(".cancel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    openMyCancelModal(
      btn.dataset.equip,
      btn.dataset.start,
      btn.dataset.code
    );
  });
});

    } catch (err) {
      console.error(err);
      list.innerHTML = "予約情報取得失敗…";
    }
  }


  // 🔹PC予約API
  // const PC_API = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

  async function loadPCReservations() {
    const list = document.getElementById("pc-reserve-list");
    if (!list) return;

    list.innerHTML = "読み込み中…";

    try {
      const res = await fetch(PC_API);
      const data = await res.json();
      const rows = data.rows || [];

      const myRes = rows.filter(r => r.name === user.name);

      if (myRes.length === 0) {
        list.innerHTML = `<div class="reserve-item">PC の予約はありません</div>`;
        return;
      }

      list.innerHTML = `
        <table class="reserve-table">
          <tr><th>PC</th><th>期間</th><th>認証コード</th></tr>
          ${myRes.map(r => `
            <tr>
              <td>${r.equip || "PC"}</td>
              <td>${r.start}〜${r.end}</td>
              <td>${r.code}</td>
              <td>
                <button class="cancel-btn" data-equip="${r.equip}" data-start="${r.start}" data-code="${r.code}">
                  取り消し
                </button>
              </td>
            </tr>
          `).join("")}
        </table>
      `;

      document.querySelectorAll(".cancel-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    openMyCancelModal(
      btn.dataset.equip,
      btn.dataset.start,
      btn.dataset.code
    );
  });
});

    } catch (err) {
      console.error(err);
      list.innerHTML = "予約情報取得失敗…";
    }
  }

  const cancelCloseBtn = document.getElementById("cancelClose");
  if (cancelCloseBtn) {
    cancelCloseBtn.onclick = () => {
      const m = document.getElementById("cancelModal");
      m.classList.remove("show");
      setTimeout(() => m.style.display = "none", 200);
    };
  }


  // 🔥 初回ロード
  loadCameraReservations();
  loadPCReservations();

// =============================
// マイページ用キャンセル操作
// =============================

// 既存のキャンセルモーダルを利用
function openMyCancelModal(equip, start, code) {
  const m = document.getElementById("cancelModal");

  document.getElementById("cancelTarget").textContent =
    `${equip} / ${start}`;
  document.getElementById("cancelMessage").textContent = "";

  // 表示＋ふわっと出るアニメーション
  m.style.display = "flex";
  setTimeout(() => m.classList.add("show"), 10);

  document.getElementById("cancelSend").onclick = () =>
    myCancelSend(equip, start, code);
}

const DEBUG_MODE = true; // ← ここだけ切り替える！

async function myCancelSend(equip, start, correctCode) {

  const input = document.getElementById("cancelCode").value.trim();
  if (!input) {
    document.getElementById("cancelMessage").textContent = "❌ コードを入力";
    return;
  }
  if (input !== correctCode) {
    document.getElementById("cancelMessage").textContent = "❌ コードが違います";
    return;
  }

  const targetAPI = equip.includes("PC") ? PC_API : CAMERA_API;

  const payload = {
    mode: "cancel",
    email: user.email,
    equip,
    start,
    code: correctCode
  };

  if (DEBUG_MODE) {
    console.log("🔥Send cancel payload:", payload);
    document.getElementById("cancelMessage").textContent = "⏳通信中…";
  }

  const res = await fetch(targetAPI, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });

  if (DEBUG_MODE) {
    const result = await res.json().catch(()=>null);
    console.log("📥Cancel response:", result);
    document.getElementById("cancelMessage").textContent = "✔ 完了（デバッグ中）";
  } else {
    document.getElementById("cancelMessage").textContent = "✔ キャンセル完了！";
    setTimeout(() => location.reload(), 800);
  }
}

});
