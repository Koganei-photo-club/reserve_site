/**********************************************
 * 📷 カメラ貸出カレンダー（共通化版）
 **********************************************/

const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

const {
  toDate, toYMD, $, showModal, hideModal,
  buildContinuousEvent, fetchReservations
} = CalendarUtil;

let APPLY_START = null;
let APPLY_END = null;
let APPLY_EQUIP = null;

document.addEventListener("DOMContentLoaded", async function () {

  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) alert("⚠ 予約するにはログインが必要です！");

  const calendarEl = $("calendar");
  const returnSelect = $("returnSelect");

  /***** 📌 カメラ一覧読み込み *****/
  let CAMERA_LIST = [];
  let COLOR_MAP = {};
  try {
    const res = await fetch(CAMERA_DB_URL);
    CAMERA_LIST = await res.json();
    const colors = ["#007bff", "#28a745", "#ff9800", "#9c27b0", "#3f51b5", "#ff5722"];
    CAMERA_LIST.forEach((c, i) => COLOR_MAP[c.name] = colors[i % colors.length]);
  } catch {}

  /***** 📌 予約データ読み込み *****/
  const reservations = await fetchReservations(API_URL);

  function isBooked(date, equip) {
    const t = toDate(date);
    return reservations.some(r => {
      if (r.equip !== equip) return false;
      const s = toDate(r.start);
      const e = toDate(r.end);
      const ee = new Date(e);
      ee.setDate(ee.getDate() + 1);
      return s <= t && t < ee;
    });
  }

  function getEndDates(start, equip) {
    const s = toDate(start);
    const max = new Date(s);
    max.setDate(max.getDate() + 6);

    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ee = toDate(r.end);
      ee.setDate(ee.getDate() + 1);
      if (ee > s && (!nearest || ee < nearest)) nearest = ee;
    });

    const limit = nearest ? new Date(nearest - 86400000) : max;
    const arr = [];
    let cur = new Date(s);

    while (cur <= limit) {
      arr.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 FullCalendar描画 *****/
  const events = reservations.map(r => {
    const ev = buildContinuousEvent(r);
    ev.backgroundColor = COLOR_MAP[r.equip] ?? "#777";
    ev.textColor = "#fff";
    return ev;
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
      if (!user) {
        alert("ログインユーザーのみ予約できます");
        return;
      }
      const now = new Date();
      now.setDate(now.getDate() + 7);
      if (toDate(info.dateStr) < now) {
        alert("借り始めは7日後以降です");
        return;
      }
      openDayModal(info.dateStr);
    },
    eventClick(info) {
      if (!user) {
        alert("ログインユーザーのみキャンセル可能です");
        return;
      }
      const r = info.event.extendedProps;
      openCancelModal(r.equip, r.start, r.code);
    }
  });
  calendar.render();

  /***** 📌 モーダル操作 *****/
  function openDayModal(dateStr) {
    const camWrap = $("cameraButtons");
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
    showModal("dayModal");
  }
  $("dayClose").onclick = () => hideModal("dayModal");

  function openReturnModal(start, equip) {
    APPLY_START = start;
    APPLY_EQUIP = equip;
    returnSelect.innerHTML = "";
    getEndDates(start, equip).forEach(d => {
      returnSelect.insertAdjacentHTML("beforeend", `<option>${d}</option>`);
    });
    hideModal("dayModal");
    showModal("returnModal");
  }
  $("closeReturn").onclick = () => hideModal("returnModal");

  $("goForm").onclick = () => {
    APPLY_END = returnSelect.value;
    hideModal("returnModal");
    showModal("applyModal");

    $("applyEquip").textContent = APPLY_EQUIP;
    $("applyPeriod").textContent = `${APPLY_START} 〜 ${APPLY_END}`;
    $("applyUser").textContent = user.name;
    $("applyUserLine").textContent = user.lineName;
    $("applyMessage").textContent = "";
  };

  $("applyClose").onclick = () => hideModal("applyModal");

  $("applySend").onclick = async () => {
    const payload = {
      mode: "reserve",
      email: user.email,
      name: user.name,
      lineName: user.lineName,
      equip: APPLY_EQUIP,
      start: APPLY_START,
      end: APPLY_END
    };

    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    $("applyMessage").textContent = "✔ 予約完了！";
    setTimeout(() => location.reload(), 800);
  };

  function openCancelModal(equip, start, code) {
    $("cancelTarget").textContent = `${equip} / ${start}`;
    $("cancelMessage").textContent = "";
    showModal("cancelModal");
    $("cancelSend").onclick = () => cancelSend(equip, start, code);
  }
  $("cancelClose").onclick = () => hideModal("cancelModal");

  async function cancelSend(equip, start, code) {
    const userCode = $("cancelCode").value.trim();
    if (!userCode) return $("cancelMessage").textContent = "❌ コードを入力";
    if (userCode !== code) return $("cancelMessage").textContent = "❌ コードが違います";

    $("cancelMessage").textContent = "⏳キャンセル申請中…";

    const payload = {
      mode: "cancel",
      email: user.email,
      equip,
      start,
      code
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);

    if (result?.result === "success") {
      $("cancelMessage").textContent = "✔ 完了！";
      setTimeout(() => location.reload(), 800);
    } else {
      $("cancelMessage").textContent = "⚠ エラー";
    }
  }

});