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

/***********************
 * ヘッダー/ナビの出し入れ
 ***********************/
let lastScrollY = window.scrollY;
const header = document.getElementById("main-header");
const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;

  if (scrollTop <= 0) {
    header.style.top = "0";
    navbar.style.top = "70px";
  } else if (scrollTop + windowHeight >= docHeight) {
    header.style.top = "-70px";
    navbar.style.top = "0";
  } else if (scrollTop > lastScrollY) {
    header.style.top = "-70px";
    navbar.style.top = "0";
  } else {
    header.style.top = "0";
    navbar.style.top = "70px";
  }
  lastScrollY = scrollTop;
});

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

      const now = new Date();
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = jst.toISOString().split("T")[0];
      
      list.innerHTML = `
        <table class="reserve-table">
          <tr>
            <th>機材</th>
            <th>期間</th>
            <th>認証コード</th>
            <th>状態</th>
          </tr>
          ${myRes.map(r => {
            const now = new Date();
            const jst = new Date(now.getTime() +9 *60 *60 *1000);
            const todayStr = jst.toISOString().split("T")[0];

            let statusCell = "";

            if (!r.beforeChecked && !r.afterChecked) {
              // 管理者による貸出処理前→キャンセルボタン表示
              statusCell = `
                <button class="cancel-btn"
                  data-equip="${r.equip}"
                  data-start="${r.start}"
                  data-code="${r.code}">
                  キャンセル
                </button>`;
            } else if (r.beforeChecked && !r.afterChecked) {
              // 貸出処理済み・返却処理前
              statusCell = `<span class="status-label status-available">利用可能</span>`;
            } else {
              // 返却処理済み
              statusCell = `<span class="status-label status-done">返却済み</span>`;
            }

            return `
            <tr>
              <td>${r.equip}</td>
              <td>${r.start} ～ <wbr> ${r.end}</td>
              <td>${r.code}</td>
              <td>${statusCell}</td>
            </tr>
            `;
          }).join("")}
        </table>
      `;

      // 「キャンセル」ボタンだけモーダルに繋ぐ
      list.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openMyCancelModal(
            "camera",               // type
            btn.dataset.equip,      // slotOrEquip
            btn.dataset.start,     // startOrDate
            btn.dataset.code       // code
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
          <tr><th>予約日</th><th>枠</th><th>認証コード</th><th>状態</th></tr>
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
  // 🔹 返却日変更モーダルの「閉じる」
  // =========================
  const modifyCloseBtn = document.getElementById("modifyClose");
  if (modifyCloseBtn) {
    modifyCloseBtn.onclick = () => {
      const m = document.getElementById("modifyModal");
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

    // タイトル切り替え（お好みで）
    const title = document.getElementById("cancelTitle");
    if (title) {
      title.textContent = (type === "pc")
        ? "PC予約のキャンセル"
        : "カメラ予約のキャンセル";
    }

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

// =========================
  // 🔹 返却日変更モーダル表示
  // =========================
  function openModifyModal(r, todayStr) {
    const m = document.getElementById("modifyModal");
    document.getElementById("modifyTarget").textContent =
      `${r.equip} / ${r.start}〜${r.end}`;
    document.getElementById("modifyMessage").textContent = "";
    document.getElementById("newEndDate").value = r.end;
    document.getElementById("modifyCode").value = "";

    // 表示＋ふわっと
    m.style.display = "flex";
    setTimeout(() => m.classList.addU("show"), 10);

    document.getElementById("modifySend").onclick =() =>
      modifySend(r, todayStr);
  }

  // =============================
  // 🔄 返却日変更送信
  // =============================
  async function modifySend(r, todayStr) {
    const input = document.getElementById("modifyCode").value.trim();
    if (!input)
      return document.getElementById("modifyMessage").textContent =
        "❌ コード入力してください";
    if (input !== r.code)
      return document.getElementById("modifyMessage").textContent =
        "❌ 認証コードが違います";
    
        document.getElementById("modifyMessage").textContent = "⏳送信中…";

    const newEnd = document.getElementById("newEndDate").value;
    if (newEnd < todayStr)
      return document.getElementById("modifyMessage").textContent =
        "❌ 返却日は今日以降にしてください";

    const payload = {
      mode: "modify",
      email: user.email,
      equip: r.equip,
      start: r.start,
      oldEnd: r.end,
      newEnd: newEnd,
      code: r.code
    };

    const res = await fetch(CAMERA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);
    console.log("📥Modify Return response:", result);
  }

  // =========================
  // 🔹 利用前 / 後 チェックモーダル
  // =========================
  let currentCondition = null; // { type, equip, start, end, code }

  function openConditionModal(type, equip, start, end, code) {
    currentCondition = { type, equip, start, end, code };

    const titleEl = document.getElementById("conditionTitle");
    const targetEl = document.getElementById("conditionTarget");
    const msgEl    = document.getElementById("conditionMessage");

    titleEl.textContent = (type === "after") ? "利用後チェック" : "利用前チェック";
    targetEl.textContent = `${equip} / ${start}〜${end}`;
    msgEl.textContent = "";

    // 初期値リセット
    document.getElementById("bodyCondition").value = "ok";
    document.getElementById("lensCondition").value = "ok";
    document.getElementById("accessoriesCondition").value = "ok";
    document.getElementById("conditionRemarks").value = "";

    const m = document.getElementById("conditionModal");
    m.style.display = "flex";
    setTimeout(() => m.classList.add("show"), 10);
  }

  const conditionCloseBtn = document.getElementById("conditionClose");
  if (conditionCloseBtn) {
    conditionCloseBtn.onclick = () => {
      const m = document.getElementById("conditionModal");
      m.classList.remove("show");
      setTimeout(() => m.style.display = "none", 200);
    };
  }

  const conditionSendBtn = document.getElementById("conditionSend");
  if (conditionSendBtn) {
    conditionSendBtn.onclick = async () => {
      if (!currentCondition) return;
      const msgEl = document.getElementById("conditionMessage");

      const payload = {
        mode: "condition",
        email: user.email,
        name:  user.name,
        equip: currentCondition.equip,
        start: currentCondition.start,
        end:   currentCondition.end,
        code:  currentCondition.code,
        type:  currentCondition.type,      // "before" or "after"
        bodyCondition:  document.getElementById("bodyCondition").value,
        lensCondition:  document.getElementById("lensCondition").value,
        accessories:    document.getElementById("accessoriesCondition").value,
        remarks:        document.getElementById("conditionRemarks").value.trim()
      };

      msgEl.textContent = "⏳送信中…";

      try {
        const res = await fetch(CAMERA_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await res.json().catch(() => null);
        console.log("📥Condition response:", result);

        if (result?.result === "success") {
          msgEl.textContent = "✔ 記録しました";
          setTimeout(() => location.reload(), 900);
        } else {
          msgEl.textContent = "⚠ エラー：" + (result?.message || "記録に失敗しました");
        }
      } catch (e) {
        console.error(e);
        msgEl.textContent = "⚠ 通信エラー";
      }
    };
  }

  // =========================
  // 🔹オフキャンバスナビ
  // =========================

  /* 要素取得 */
  const toggleBtn = document.querySelector(".nav-toggle");
  const offcanvas = document.querySelector(".offcanvas-nav");
  const backdrop  = document.querySelector(".offcanvas-backdrop");

  /* オフキャンバスを閉じる共通関数 */
  function closeOffcanvas() {
    offcanvas.classList.remove("show");
    backdrop.classList.remove("show");
    document.body.classList.remove("scroll-lock");

    /* ドロップダウンメニュー状態リセット */
    document.querySelectorAll(".offcanvas-group.open")
      .forEach(g => g.classList.remove("open"));
  }

  /* ハンバーガーで開閉 */
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = offcanvas.classList.contains("show");

      if (isOpen) {
        closeOffcanvas();
      } else {
        offcanvas.classList.add("show");
        backdrop.classList.add("show");
        document.body.classList.add("scroll-lock");
      }
    });
  }

  /* 背景クリックで閉じる */
  if (backdrop) {
    backdrop.addEventListener("click", closeOffcanvas);
  }

  // オフキャンバス内DropDownメニュー
  document.querySelectorAll(".offcanvas-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetGroup = btn.closest(".offcanvas-group");
      const isOpen = targetGroup.classList.contains("open");
      
      // 他のメニューが開いていたら閉じる
      document.querySelectorAll(".offcanvas-group.open")
        .forEach(g => g.classList.remove("open"));
      
      // 押したものだけ、元々閉じていたなら開く
      if (!isOpen) {
        targetGroup.classList.add("open");
      }
    });
  });

  // =========================
  // active表示
  // =========================
  const page = document.body.dataset.page;
  if(!page) return;

  // navbar
  document
    .querySelectorAll(`.navbar a[data-page="${page}"]`)
    .forEach(a => a.classList.add("active"));

  // offcanvas nav
  document
    .querySelectorAll(`.offcanvas-nav a[data-page="${page}"]`)
    .forEach(a => {
      a.classList.add("active");

      // 親グループを自動で開く
      const group = a.closest(".offcanvas-group");
      if (group) group.classList.add("open");
    });
});  // DOMContentLoaded end