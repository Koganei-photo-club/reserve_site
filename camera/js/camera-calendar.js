/**********************************************
 * 📷 カメラ貸出カレンダー
 **********************************************/

const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
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
let APPLY_END = null;
let APPLY_EQUIP = null;

document.addEventListener("DOMContentLoaded", async function () {

  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) {
    alert("⚠ 予約するにはログインが必要です！");
  }

  const calendarEl = document.getElementById("calendar");
  const returnSelect = document.getElementById("returnSelect");

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
  let reservations = [];
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    reservations = Array.isArray(data.rows) ? data.rows : [];
  } catch {}

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
    max.setDate(s.getDate() + 6);

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
      arr.push(toYMD(cur));   // ← ここも toISOString() やめる
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 FullCalendar描画 *****/
  const events = reservations.map(r => {
    const e = toDate(r.end);
    e.setDate(e.getDate() + 1);
    return {
      title: `${r.equip} 貸出中`,
      start: r.start,
      end:   toYMD(e),      // ← ここが重要！toISOString() を使わない
      extendedProps: r,
      backgroundColor: COLOR_MAP[r.equip] ?? "#777",
      textColor: "#fff",
      allDay: true
    };
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
  const modal = id => document.getElementById(id);
  const show = id => { modal(id).style.display="flex"; modal(id).classList.add("show"); };
  const hide = id => { modal(id).classList.remove("show"); setTimeout(() => modal(id).style.display="none",200); };

  function openDayModal(dateStr) {
    const camWrap = document.getElementById("cameraButtons");
    camWrap.innerHTML = "";
    CAMERA_LIST.forEach(c=>{
      const b=document.createElement("button");
      b.className="camera-btn";
      if(isBooked(dateStr,c.name)){
        b.textContent=`${c.name}（貸出中）`; b.disabled=true;
      } else {
        b.textContent=`${c.name} を予約`;
        b.onclick=()=>openReturnModal(dateStr,c.name);
      }
      camWrap.appendChild(b);
    });
    show("dayModal");
  }
  modal("dayClose").onclick=()=>hide("dayModal");

  function openReturnModal(start,equip){
    APPLY_START=start;
    APPLY_EQUIP=equip;
    returnSelect.innerHTML="";
    getEndDates(start,equip).forEach(d=>{
      returnSelect.insertAdjacentHTML("beforeend",`<option>${d}</option>`);
    });
    hide("dayModal");
    show("returnModal");
  }
  modal("closeReturn").onclick=()=>hide("returnModal");

  modal("goForm").onclick=()=>{
    APPLY_END=returnSelect.value;
    hide("returnModal");
    show("applyModal");

    modal("applyEquip").textContent=APPLY_EQUIP;
    modal("applyPeriod").textContent=`${APPLY_START} 〜 ${APPLY_END}`;
    modal("applyUser").textContent=user.name;
    modal("applyUserLine").textContent=user.lineName;
    modal("applyMessage").textContent="";
  };

  modal("applyClose").onclick=()=>hide("applyModal");

modal("applySend").onclick = async () => {
  const payload = {
    mode: "reserve",
    email: user.email,     // ← 追加！
    name: user.name,
    lineName: user.lineName,
    equip: APPLY_EQUIP,
    start: APPLY_START,
    end: APPLY_END
  };

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // 追加推奨
    body: JSON.stringify(payload)
  });

  modal("applyMessage").textContent = "✔ 予約完了！";
  setTimeout(() => location.reload(), 800);
};

  function openCancelModal(equip,start,code){
    modal("cancelTarget").textContent=`${equip} / ${start}`
    modal("cancelMessage").textContent="";
    show("cancelModal");
    modal("cancelSend").onclick=()=>cancelSend(equip,start,code);
  }
  modal("cancelClose").onclick=()=>hide("cancelModal");

const DEBUG = false; // 共通！

async function cancelSend(equip, start, code) {
  const userCode = modal("cancelCode").value.trim();
  if (!userCode) {
    modal("cancelMessage").textContent = "❌ コードを入力";
    return;
  }
  if (userCode !== code) {
    modal("cancelMessage").textContent = "❌ コードが違います";
    return;
  }

  const payload = {
    mode: "cancel",
    email: user.email,
    equip,
    start,
    code
  };

  if (DEBUG) console.log("🔥Send cancel payload:", payload);

  modal("cancelMessage").textContent = DEBUG
    ? "⏳送信中…（デバッグログ確認）"
    : "⏳キャンセル申請中…";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await res.json().catch(() => null);

  if (DEBUG) {
    console.log("📥Cancel response:", result);
    modal("cancelMessage").textContent =
      "✔ 完了（デバッグ：削除結果はログ）";
  } else {
    modal("cancelMessage").textContent = "✔ 完了！";
    setTimeout(() => location.reload(), 800);
  }
}

});