/**********************************************
 * 🧩 共通Calendar Utility
 **********************************************/

// 📌 JSTで日付扱い
function toDate(d) {
  return new Date(d + "T00:00:00+09:00");
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 📌 モーダル操作統一
function $(id) {
  return document.getElementById(id);
}

function showModal(id) {
  $(id).style.display = "flex";
  setTimeout(() => $(id).classList.add("show"), 10);
}

function hideModal(id) {
  $(id).classList.remove("show");
  setTimeout(() => $(id).style.display = "none", 200);
}

// 📌 FullCalendarイベント変換（連続日）
function buildContinuousEvent(res) {
  const end = toDate(res.end);
  end.setDate(end.getDate() + 1);
  return {
    title: `${res.equip} 貸出中`,
    start: res.start,
    end: toYMD(end),
    extendedProps: res,
    allDay: true
  };
}

// 📌 予約データ取得（共通）
async function fetchReservations(apiUrl) {
  try {
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.rows || [];
  } catch (e) {
    console.error("予約データ取得失敗:", e);
    return [];
  }
}

window.CalendarUtil = {
  toDate, toYMD,
  $, showModal, hideModal,
  buildContinuousEvent,
  fetchReservations
};