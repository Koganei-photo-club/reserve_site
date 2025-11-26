/**********************************************
 * 📷 カメラ貸出カレンダー（DB + GAS API 連携完成版）
 **********************************************/

// 🔹予約一覧・追加・キャンセル → Cloudflare Worker 経由
const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

function toDate(d) {
  return new Date(d + "T00:00:00");
}

let APPLY_START = null;
let APPLY_END = null;
let APPLY_EQUIP = null;

document.addEventListener("DOMContentLoaded", async function () {

  const calendarEl = document.getElementById("calendar");
  const returnSelect = document.getElementById("returnSelect");

  /***** 📌 カメラ一覧取得 *****/
  let CAMERA_LIST = [];
  let COLOR_MAP = {};

  try {
    const res = await fetch(CAMERA_DB_URL);
    CAMERA_LIST = await res.json();
    const colors = ["#007bff", "#28a745", "#ff9800", "#9c27b0", "#3f51b5", "#ff5722"];
    CAMERA_LIST.forEach((c, i) => COLOR_MAP[c.name] = colors[i % colors.length]);
  } catch {
    alert("カメラDB読込失敗");
  }

  /***** 📌 予約状況取得 *****/
  let reservations = [];
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    // 🔥 rows 部分だけ抽出！！
    reservations = Array.isArray(data.rows) ? data.rows : [];
  } catch {
    alert("予約データ読込失敗");
  }

  function isBooked(date, equip) {
    const t = toDate(date);
    return reservations.some(r => {
      if (r.equip !== equip) return false;
      const s = toDate(r.start);
      const e = toDate(r.end);
      return s <= t && t <= e;
    });
  }

  function getEndDates(start, equip) {
    const s = toDate(start);
    const max = new Date(s); max.setDate(s.getDate() + 6);

    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ds = toDate(r.start);
      if (ds > s && (!nearest || ds < nearest)) nearest = ds;
    });

    const limit = nearest ? new Date(nearest - 86400000) : max;
    const arr = [];
    let cur = new Date(s);

    while (cur <= limit) {
      arr.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 FullCalendar 描画 *****/
  const events = reservations.map(r => {
    const e = toDate(r.end);
    e.setDate(e.getDate() + 1);

    return {
      title: `${r.equip} 貸出中`,
      start: r.start,
      end: e.toISOString().slice(0, 10),
      extendedProps: r,
      backgroundColor: COLOR_MAP[r.equip] ?? "#777",
      borderColor: COLOR_MAP[r.equip] ?? "#777",
      textColor: "#fff",
      allDay: true
    };
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
      const now = new Date(); now.setDate(now.getDate() + 7);
      if (toDate(info.dateStr) < now) {
        alert("借り始めは7日後以降です");
        return;
      }
      openDayModal(info.dateStr);
    },
    eventClick(info) {
      const r = info.event.extendedProps;
      openCancelModal(r.equip, r.start, r.code);
    }
  });
  calendar.render();

  /***** 📌 モーダル制御 *****/
  const modal = id => document.getElementById(id);
  const show = id => { modal(id).style.display = "flex"; modal(id).classList.add("show"); };
  const hide = id => { modal(id).classList.remove("show"); setTimeout(() => modal(id).style.display = "none", 200); };

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

  /***** 📌 返却日選択 *****/
  function openReturnModal(start, equip) {
    APPLY_START = start;
    APPLY_EQUIP = equip;

    returnSelect.innerHTML = "";
    getEndDates(start, equip).forEach(d => {
      returnSelect.insertAdjacentHTML("beforeend", `<option>${d}</option>`);
    });

    hide("dayModal");
    show("returnModal");
  }
  modal("closeReturn").onclick = () => hide("returnModal");

  /***** 📌 予約申請 *****/
  const applyModal = modal("applyModal");
  modal("goForm").onclick = () => {
    APPLY_END = returnSelect.value;
    hide("returnModal");
    show("applyModal");

    modal("applyEquip").textContent = `機材：${APPLY_EQUIP}`;
    modal("applyPeriod").textContent = `${APPLY_START} 〜 ${APPLY_END}`;
    modal("applyMessage").textContent = "";
  };

  modal("applyClose").onclick = () => hide("applyModal");
  modal("applySend").onclick = async () => {
    const payload = {
      mode: "reserve",
      name: modal("applyName").value.trim(),
      lineName: modal("applyLine").value.trim(),
      equip: APPLY_EQUIP,
      start: APPLY_START,
      end: APPLY_END
    };

    await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    modal("applyMessage").textContent = "✔ 予約完了！";
    setTimeout(() => location.reload(), 1000);
  };

  /***** ❌予約キャンセル *****/
  modal("cancelClose").onclick = () => hide("cancelModal");
  function openCancelModal(equip, start, code) {
    modal("cancelTarget").textContent = `${equip} / ${start}`;
    modal("cancelMessage").textContent = "";
    show("cancelModal");
    modal("cancelSend").onclick = () => cancelSend(equip, start, code);
  }

  async function cancelSend(equip, start, code) {
    const name = modal("cancelName").value.trim();
    const userCode = modal("cancelCode").value.trim();

    if (!name || !userCode) {
      modal("cancelMessage").textContent = "❌ 氏名とコードを入力";
      return;
    }

    const payload = {
      mode: "cancel",
      name,
      equip,
      start,
      code: userCode
    };

    await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    modal("cancelMessage").textContent = "✔ キャンセル完了！";
    setTimeout(() => location.reload(), 1000);
  }

});