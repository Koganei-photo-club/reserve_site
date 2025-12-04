// ======================
// マイページ表示制御
// ======================
const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const PC_API     = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

const DEBUG_MODE = false;   // ← ログを見たい間は true、本番運用時は false

// 🔹 管理者権限ロール番号
// 1:部長 / 2:副部長 / 3:会計 / 4:文連
const adminRoles = [1, 2, 3, 4];

document.addEventListener("DOMContentLoaded", () => {

  // ----------------------
  // ログインユーザー取得
  // ----------------------
  const userJson = sessionStorage.getItem("user");
  if (!userJson) {
    window.location.href = "/reserve_site/auth/login.html";
    return;
  }
  const user = JSON.parse(userJson);

  document.getElementById("mp-name").textContent  = user.name;
  document.getElementById("mp-grade").textContent = user.gradeLabel || ["","B1","B2","B3","B4","M1","M2","OB/OG"][user.grade];
  document.getElementById("mp-line").textContent  = user.lineName;
  document.getElementById("mp-email").textContent = user.email;
  document.getElementById("mp-role").textContent = user.roleLabel || ["役職なし","部長","副部長","会計","文連"][user.role];
  // 管理者メニューの表示切り替え
  const adminMenu = document.getElementById("admin-menu");
  if (adminMenu) {
    if (adminRoles.includes(Number(user.role))) {
      adminMenu.style.display = "block";
    } else {
      adminMenu.style.display = "none";
    }
  }

  document.getElementById("logoutBtn").onclick = () => {
    sessionStorage.clear();
    window.location.href = "/reserve_site/auth/login.html";
  };

  // =========================
  // 🔹 カメラ予約一覧の読み込み
  // =========================
  async function loadCameraReservations() {
    const list = document.getElementById("camera-reserve-list");
    if (!list) return;
    list.innerHTML = "読み込み中…";

    try {
      const res  = await fetch(CAMERA_API);
      const data = await res.json();
      const rows = data.rows || [];

      const myRes = rows.filter(r => r.name === user.name);

      if (myRes.length === 0) {
        list.innerHTML = `<div class="reserve-item">カメラの予約はありません</div>`;
        return;
      }

      list.innerHTML = `
        <table class="reserve-table">
          <tr><th>機材</th><th>期間</th><th>認証コード</th><th></th></tr>
          ${myRes.map(r => `
            <tr>
              <td>${r.equip}</td>
              <td>${r.start}〜${r.end}</td>
              <td>${r.code}</td>
              <td>
                <button class="cancel-btn"
                  data-equip="${r.equip}"
                  data-start="${r.start}"
                  data-code="${r.code}">
                  取り消し
                </button>
              </td>
            </tr>
          `).join("")}
        </table>
      `;

      // このリストの中のボタンだけにイベントを付与
      list.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openMyCancelModal(
            btn.dataset.equip,   // equip
            btn.dataset.start,   // start
            btn.dataset.code     // code
          );
        });
      });

    } catch (err) {
      console.error(err);
      list.innerHTML = "予約情報取得失敗…";
    }
  }

  // =========================
  // 🔹 PC予約一覧の読み込み
  // =========================
  async function loadPCReservations() {
    const list = document.getElementById("pc-reserve-list");
    if (!list) return;

    list.innerHTML = "読み込み中…";

    try {
      const res  = await fetch(PC_API);
      const data = await res.json();

      // PC API のフィールドに合わせて正しく取り出す
      const rows = (data.rows || []).map(r => ({
        email: r.email,
        name:  r.name,
        slot:  r.slot,
        date:  r.start,
        auth:  r.code
      }));

      // PC 側は email で紐付け
      const myRes = rows.filter(r => r.email === user.email);

      if (myRes.length === 0) {
        list.innerHTML = `<div class="reserve-item">PC の予約はありません</div>`;
        return;
      }

      list.innerHTML = `
        <table class="reserve-table">
          <tr><th>予約日</th><th>枠</th><th>認証コード</th><th></th></tr>
          ${myRes.map(r => `
            <tr>
              <td>${r.date || "?"}</td>
              <td>${r.slot || "?"}</td>
              <td>${r.auth || "?"}</td>
              <td>
                <button class="cancel-btn"
                  data-slot="${r.slot}"
                  data-date="${r.date}"
                  data-code="${r.auth}">
                  取り消し
                </button>
              </td>
            </tr>
          `).join("")}
        </table>
      `;

      // 📌 Cancelボタンにイベントをつける
      list.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openMyCancelModal(
            "pc",               // type
            btn.dataset.slot,    // slot
            btn.dataset.date,   // startOrDate
            btn.dataset.code    // code
          );
        });
      });

    } catch (err) {
      console.error(err);
      list.innerHTML = "予約情報取得失敗…";
    }
  }

  // =========================
  // 🔹 キャンセルモーダルの「閉じる」
  // =========================
  const cancelCloseBtn = document.getElementById("cancelClose");
  if (cancelCloseBtn) {
    cancelCloseBtn.onclick = () => {
      const m = document.getElementById("cancelModal");
      m.classList.remove("show");
      setTimeout(() => m.style.display = "none", 200);
    };
  }

  // =========================
  // 🔥 初回ロード
  // =========================
  loadCameraReservations();
  loadPCReservations();

  // =============================
  // マイページ用キャンセル操作
  // =============================

  // 共通モーダル表示
  function openMyCancelModal(type, slotOrEquip, date, code) {
    const m = document.getElementById("cancelModal");

    document.getElementById("cancelTarget").textContent =
      `${date} / ${slotOrEquip}`;
    document.getElementById("cancelMessage").textContent = "";
    document.getElementById("cancelCode").value = "";

    // 表示＋ふわっと
    m.style.display = "flex";
    setTimeout(() => m.classList.add("show"), 10);

    document.getElementById("cancelSend").onclick = () =>
      myCancelSend(type, slotOrEquip, date, code);
  }

  // =============================
  // 🚫 キャンセル送信
  // =============================
  async function myCancelSend(type, slotOrEquip, date, correctCode) {
    const input = document.getElementById("cancelCode").value.trim();
    if (!input)
      return document.getElementById("cancelMessage").textContent =
        "❌ コード入力してください";
    if (input !== correctCode)
      return document.getElementById("cancelMessage").textContent =
        "❌ 認証コードが違います";

    document.getElementById("cancelMessage").textContent = "⏳送信中…";

  // =============================
  // 📌 PC予約キャンセル
  // =============================
  if (type === "pc") {
    const payload = {
      mode: "cancel",
      email: user.email,
      start: date,
      slot: slotOrEquip,
      code: correctCode
    };

    const res = await fetch(PC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);
    console.log("📥PC Cancel response:", result);

    if (result?.result === "success") {
      document.getElementById("cancelMessage").textContent = "✔ キャンセル成功！";
      return setTimeout(() => location.reload(), 1000);
    } else {
      return document.getElementById("cancelMessage").textContent =
        "⚠ 一致する予約がありません";
    }
  }

  // =============================
  // 📸 カメラ貸出キャンセル
  // =============================
  const payload = {
    mode: "cancel",
    email: user.email,
    equip: slotOrEquip, // カメラの機材名
    start: date,
    code: correctCode
  };

  const res = await fetch(CAMERA_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json().catch(() => null);
  console.log("📥CAMERA Cancel response:", result);

  if (result?.result === "success") {
    document.getElementById("cancelMessage").textContent = "✔ キャンセル成功！";
    setTimeout(() => location.reload(), 1000);
  } else {
    document.getElementById("cancelMessage").textContent =
      "⚠ エラー：" + (result?.message || "不明なエラー");
  }
}
});  // DOMContentLoaded end