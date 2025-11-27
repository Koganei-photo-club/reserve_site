/**********************************************
 * 📷 カメラ貸出カレンダー（DB + GAS API 連携 完成版）
 **********************************************/

// 🔹予約一覧・追加・キャンセル・返却日変更 → Cloudflare Worker 経由
const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

// 🔹カメラ一覧（別 GAS）
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

function toDate(d) {
  return new Date(d + "T00:00:00");
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let APPLY_START = null;
let APPLY_END   = null;
let APPLY_EQUIP = null;

document.addEventListener("DOMContentLoaded", async function () {

  const calendarEl   = document.getElementById("calendar");
  const returnSelect = document.getElementById("returnSelect");

  // apply モーダル
  const applyEquipEl   = document.getElementById("applyEquip");
  const applyPeriodEl  = document.getElementById("applyPeriod");
  const applyNameEl    = document.getElementById("applyName");
  const applyLineEl    = document.getElementById("applyLine");
  const applyMsgEl     = document.getElementById("applyMessage");

  // cancel モーダル
  const cancelTargetEl = document.getElementById("cancelTarget");
  const cancelNameEl   = document.getElementById("cancelName");
  const cancelCodeEl   = document.getElementById("cancelCode");
  const cancelMsgEl    = document.getElementById("cancelMessage");

  // modify モーダル
  const modifyTargetEl = document.getElementById("modifyTarget");
  const modifySelectEl = document.getElementById("modifySelect");
  const modifyNameEl   = document.getElementById("modifyName");
  const modifyCodeEl   = document.getElementById("modifyCode");
  const modifyMsgEl    = document.getElementById("modifyMessage");

  /***** 📌 カメラ一覧取得 *****/
  let CAMERA_LIST = [];
  let COLOR_MAP   = {};

  try {
    const res = await fetch(CAMERA_DB_URL);
    CAMERA_LIST = await res.json();
    const colors = ["#007bff", "#28a745", "#ff9800", "#9c27b0", "#3f51b5", "#ff5722"];
    CAMERA_LIST.forEach((c, i) => { COLOR_MAP[c.name] = colors[i % colors.length]; });
  } catch {
    alert("カメラDBの取得に失敗しました");
  }

  /***** 📌 予約状況取得 *****/
  let reservations = [];
  try {
    const res  = await fetch(API_URL);
    const data = await res.json();
    reservations = Array.isArray(data.rows) ? data.rows : [];
  } catch {
    alert("予約データの取得に失敗しました");
  }

  /***** 📌 予約中判定 *****/
  function isBooked(date, equip) {
    const t = toDate(date);
    return reservations.some(r => {
      if (r.equip !== equip) return false;
      const s = toDate(r.start);
      const e = toDate(r.end);
      return s <= t && t <= e;
    });
  }

  /***** 📌 新規予約時の返却日候補（従来仕様） *****/
  function getEndDatesForNew(start, equip) {
    const s   = toDate(start);
    const max = new Date(s); max.setDate(s.getDate() + 6); // 7日間

    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ds = toDate(r.start);
      if (ds > s && (!nearest || ds < nearest)) nearest = ds;
    });

    const limit = nearest ? new Date(nearest.getTime() - 86400000) : max;
    const arr   = [];
    let cur     = new Date(s);

    while (cur <= limit) {
      arr.push(toYMD(cur));   // ← ここも toISOString() やめる
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 返却日変更時の候補 *****/
  function getEndDatesForModify(resv, today) {
    const startDate = toDate(resv.start);

    // 全体上限：借り始め含め7日間
    const max = new Date(startDate);
    max.setDate(startDate.getDate() + 6);

    // 同じカメラの「次の予約」の開始日
    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== resv.equip) return;
      const ds = toDate(r.start);
      if (ds > startDate && (!nearest || ds < nearest)) nearest = ds;
    });

    let limit = max;
    if (nearest) {
      const dayBefore = new Date(nearest);
      dayBefore.setDate(nearest.getDate() - 1);
      if (dayBefore < limit) limit = dayBefore;
    }

    // 変更可能な最小日は「今日」(過去には戻せない)
    const begin = (today > startDate) ? new Date(today) : new Date(startDate);

    const arr = [];
    let cur   = new Date(begin);

    while (cur <= limit) {
      arr.push(toYMD(cur));   // ← ここも toISOString() やめる
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

/***** 📌 FullCalendar イベント生成（JSTずれ修正版） *****/
const events = reservations.map(r => {
  // end は「返却日を含めて」表示したいので +1日する
  const e = toDate(r.end);
  e.setDate(e.getDate() + 1); // FullCalendar は end「翌日」までを指定する仕様

  return {
    title: `${r.equip} 貸出中`,
    start: r.start,       // start はそのまま
    end:   toYMD(e),      // ← ここが重要！toISOString() を使わない
    extendedProps: r,
    backgroundColor: COLOR_MAP[r.equip] ?? "#777",
    borderColor:     COLOR_MAP[r.equip] ?? "#777",
    textColor: "#fff",
    allDay: true
  };
});

  /***** 📌 FullCalendar 描画 *****/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() + 7); // 今日から7日後以降のみ

      if (toDate(info.dateStr) < now) {
        alert("借り始めは今日から7日後以降にしてください");
        return;
      }
      openDayModal(info.dateStr);
    },
    eventClick(info) {
      const r = info.event.extendedProps; // {name, lineName, equip, start, end, code}
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const s = toDate(r.start);
      const e = toDate(r.end);

      // 期間終了後 → 何もさせない
      if (today > e) {
        return;
      }

      // まだ開始前 → キャンセルのみ
      if (today < s) {
        openCancelModal(r);
        return;
      }

      // 期間中 → 返却日変更のみ
      openModifyModal(r, today);
    }
  });

  calendar.render();

  /***** 📌 モーダル共通制御 *****/
  const modal = id => document.getElementById(id);
  const show  = id => { modal(id).style.display = "flex"; modal(id).classList.add("show"); };
  const hide  = id => { modal(id).classList.remove("show"); setTimeout(() => modal(id).style.display = "none", 200); };

  /***** 📌 カメラ選択 *****/
  const camWrap = document.getElementById("cameraButtons");
  function openDayModal(dateStr) {
    camWrap.innerHTML = "";
    CAMERA_LIST.forEach(c => {
      const b = document.createElement("button");
      b.className = "camera-btn";
      if (isBooked(dateStr, c.name)) {
        b.textContent = `${c.name}（貸出中）`;
        b.disabled = true;
      } else {
        b.textContent = `${c.name} を予約`;
        b.onclick = () => openReturnModal(dateStr, c.name);
      }
      camWrap.appendChild(b);
    });
    show("dayModal");
  }
  modal("dayClose").onclick = () => hide("dayModal");

  /***** 📌 返却日選択（新規予約） *****/
  function openReturnModal(start, equip) {
    APPLY_START = start;
    APPLY_EQUIP = equip;

    returnSelect.innerHTML = "";
    getEndDatesForNew(start, equip).forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      returnSelect.appendChild(opt);
    });

    hide("dayModal");
    show("returnModal");
  }
  modal("closeReturn").onclick = () => hide("returnModal");

  /***** 📌 予約申請 *****/
  modal("goForm").onclick = () => {
    APPLY_END = returnSelect.value;

    applyEquipEl.textContent  = `機材：${APPLY_EQUIP}`;
    applyPeriodEl.textContent = `${APPLY_START} 〜 ${APPLY_END}`;
    applyNameEl.value = "";
    applyLineEl.value = "";
    applyMsgEl.textContent = "";

    hide("returnModal");
    show("applyModal");
  };

  modal("applyClose").onclick = () => hide("applyModal");

  modal("applySend").onclick = async () => {
    const payload = {
      mode: "reserve",
      name:     applyNameEl.value.trim(),
      lineName: applyLineEl.value.trim(),
      equip:    APPLY_EQUIP,
      start:    APPLY_START,
      end:      APPLY_END
    };

    await fetch(API_URL, {
      method:  "POST",
      headers: {"Content-Type": "application/json"},
      body:    JSON.stringify(payload)
    });

    applyMsgEl.textContent = "✔ 予約完了！";
    setTimeout(() => location.reload(), 1000);
  };

  /***** ❌ 予約キャンセル *****/
  modal("cancelClose").onclick = () => hide("cancelModal");

  function openCancelModal(r) {
    cancelTargetEl.textContent = `${r.equip} / ${r.start}`;
    cancelNameEl.value = "";
    cancelCodeEl.value = "";
    cancelMsgEl.textContent = "";
    show("cancelModal");
  }

  async function sendCancel() {
    const text  = cancelTargetEl.textContent; // "equip / YYYY-MM-DD"
    const equip = text.split(" / ")[0];
    const start = text.split(" / ")[1];
    const name  = cancelNameEl.value.trim();
    const code  = cancelCodeEl.value.trim();

    if (!name || !code) {
      cancelMsgEl.textContent = "❌ 氏名とコードを入力してください";
      return;
    }

    const payload = {
      mode: "cancel",
      name,
      equip,
      start,
      code
    };

    await fetch(API_URL, {
      method:  "POST",
      headers: {"Content-Type": "application/json"},
      body:    JSON.stringify(payload)
    });

    cancelMsgEl.textContent = "✔ キャンセル完了！";
    setTimeout(() => location.reload(), 1000);
  }

  modal("cancelSend").onclick = () => { sendCancel(); };

  /***** 🔁 返却日変更 *****/
  modal("modifyClose").onclick = () => hide("modifyModal");

  function openModifyModal(r, today) {
    modifyTargetEl.textContent = `${r.equip} / ${r.start}〜${r.end}`;
    modifyNameEl.value = "";
    modifyCodeEl.value = "";
    modifyMsgEl.textContent = "";
    modifySelectEl.innerHTML = "";

    const candidates = getEndDatesForModify(r, today);
    if (candidates.length === 0) {
      alert("返却日を変更できる候補日がありません");
      return;
    }

    candidates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      modifySelectEl.appendChild(opt);
    });

    show("modifyModal");

    modal("modifySend").onclick = async () => {
      const name = modifyNameEl.value.trim();
      const code = modifyCodeEl.value.trim();
      const newEnd = modifySelectEl.value;

      if (!name || !code) {
        modifyMsgEl.textContent = "❌ 氏名とコードを入力してください";
        return;
      }

      const payload = {
        mode: "modify",
        name,
        equip: r.equip,
        start: r.start,
        code,
        newEnd
      };

      await fetch(API_URL, {
        method:  "POST",
        headers: {"Content-Type": "application/json"},
        body:    JSON.stringify(payload)
      });

      modifyMsgEl.textContent = "✔ 返却日を変更しました！";
      setTimeout(() => location.reload(), 1000);
    };
  }

}); // END DOMContentLoaded