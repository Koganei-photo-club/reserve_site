// ======================
// マイページ表示制御
// ======================
const CAMERA_API = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const PC_API     = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

const DEBUG_MODE = false;   // ← ログを見たい間は true、本番運用時は false

// 🔹 管理者権限ロール番号
// 1:部長 / 2:副部長 / 3:会計 / 4:文連
const adminRoles = [1, 2, 3, 4];

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

      const now = new Date();
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const todayStr = jst.toISOString().split("T")[0];
      
      list.innerHTML = `
        <table class="reserve-table">
          <tr>
            <th>機材</th>
            <th>期間</th>
            <th>認証コード</th>
            <th>取り消し</th>
            <th>状態チェック</th>
          </tr>
          ${myRes.map(r => {
            const now = new Date();
            const jst = new Date(now.getTime() +9 *60 *60 *1000);
            const todayStr = jst.toISOString().split("T")[0];
            
            // キャンセル/変更/終了
            let actionCell = "";
            if (todayStr < r.start) {
              actionCell = `
              <button class="cancel-btn"
                data-equip="${r.equip}"
                data-start="${r.start}"
                data-code="${r.code}">
                取り消し
                </button>`;
            } else if (todayStr >= r.start && todayStr < r.end && !r.afterChecked) {
              actionCell = `
              <button class="modify-btn"
                data-equip="${r.equip}"
                data-start="${r.start}"
                data-end="${r.end}"
                data-code="${r.code}">
                返却日変更
              </button>`;
            } else {
              actionCell = `<span class="disabled-btn">終了</span>`;
            }

            // 状態チェック
            let statusCell = "";
            if (todayStr === r.start && !r.beforeChecked) {
              // 利用開始日 & 利用前チェックまだ → 「借りる」
              statusCell = `
              <button class="status-btn"
                data-type="before"
                data-equip="${r.equip}"
                data-start="${r.start}"
                data-end="${r.end}"
                data-code="${r.code}">
                借りる
              </button>`;
            } else if (todayStr === r.end && r.beforeChecked && !r.afterChecked) {
              // 返却予定日 & 利用前済 & 利用後まだ → 「返す」
              statusCell = `
              <button class="status-btn"
                data-type="after"
                data-equip="${r.equip}"
                data-start="${r.start}"
                data-end="${r.end}"
                data-code="${r.code}">
                返す
              </button>`;
            } else if (r.afterChecked) {
              statusCell = `<span class="status-done">返却済み</span>`;
            } else if (r.beforeChecked && !r.afterChecked) {
              statusCell = `<span class="status-ing">貸出中</span>`;
            } else {
              statusCell = `<span class="status-plan">貸出予定</span>`;
            }

            return `
            <tr>
              <td>${r.equip}</td>
              <td>${r.start}〜${r.end}</td>
              <td>${r.code}</td>
              <td>${actionCell}</td>
              <td>${statusCell}</td>
            </tr>
          `;
          }).join("")}
        </table>
      `;

      // このリストの中のボタンだけにイベントを付与
      list.querySelectorAll(".cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openMyCancelModal(
            "camera",            // type
            btn.dataset.equip,   // equip
            btn.dataset.start,   // start
            btn.dataset.code     // code
          );
        });
      });

      // 🔹 返却日変更ボタンのイベント
      list.querySelectorAll(".modify-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const r = {
            equip: btn.dataset.equip,
            start: btn.dataset.start,
            end:   rows.find(row =>
              row.equip === btn.dataset.equip &&
              row.start === btn.dataset.start &&
              row.code === btn.dataset.code
            )?.end,
            code:  btn.dataset.code
          };
          openModifyModal(r, todayStr);
        });
      });

      // 🔹 状態チェックボタンのイベント
      list.querySelectorAll(".status-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          openConditionModal(
            btn.dataset.type,    // "before" or "after"
            btn.dataset.equip,
            btn.dataset.start,
            btn.dataset.end,
            btn.dataset.code
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
// 🔁 返却日変更モーダル
// =========================
const modifyModal = document.getElementById("modifyModal");
const modifyTargetEl = document.getElementById("modifyTarget");
const modifySelectEl = document.getElementById("modifySelect");
const modifyNameEl = document.getElementById("modifyName");
const modifyCodeEl = document.getElementById("modifyCode");
const modifyMsgEl = document.getElementById("modifyMessage");

document.getElementById("modifyClose").onclick = () => {
  modifyModal.classList.remove("show");
  setTimeout(() => modifyModal.style.display = "none", 200);
};

/** 🔹 候補日生成：貸出開始から7日以内 */
function getEndDatesForModify(r, todayStr) {
  const results = [];
  let d = new Date(todayStr);

  for (let i = 0; i < 7; i++) {
    const ymd = d.toISOString().split("T")[0];
    if (ymd >= r.start) results.push(ymd);
    d.setDate(d.getDate() + 1);
  }
  return results;
}

function openModifyModal(r, todayStr) {
  modifyTargetEl.textContent = `${r.equip} / ${r.start}〜${r.end}`;
  modifyMsgEl.textContent = "";
  modifySelectEl.innerHTML = "";

  const candidates = getEndDatesForModify(r, todayStr);
  if (candidates.length === 0) return alert("候補日なし");

  candidates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    modifySelectEl.appendChild(opt);
  });

  modifyModal.style.display = "flex";
  setTimeout(() => modifyModal.classList.add("show"), 10);

  document.getElementById("modifySend").onclick = async () => {
    modifyMsgEl.textContent = "⏳送信中…";

    const payload = {
      mode: "modify",
      email: user.email,
      equip: r.equip,
      start: r.start,
      code: r.code,  // ← 認証コードは自動設定
      newEnd: modifySelectEl.value
    };

    const res = await fetch(CAMERA_API, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);

    if (result?.result === "success") {
      modifyMsgEl.textContent = "✔ 返却日を変更しました！";
      setTimeout(() => location.reload(), 900);
    } else {
      modifyMsgEl.textContent =
        "⚠ エラー：" + (result?.message || "変更できませんでした");
    }
  };
}
});  // DOMContentLoaded end