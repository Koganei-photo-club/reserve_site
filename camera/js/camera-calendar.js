/**********************************************
 * 📷 カメラ貸出カレンダー（DB + GAS API 連携 完成版）
 **********************************************/

// 🔹 予約一覧・追加・キャンセル → Cloudflare Worker 経由
const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
// 🔹 カメラ一覧（機材DB） → 別GAS
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

// "YYYY-MM-DD" → Date（ローカル）
function toDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Date → "YYYY-MM-DD"（※絶対に toISOString は使わない）
function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    CAMERA_LIST.forEach((c, i) => {
      COLOR_MAP[c.name] = colors[i % colors.length];
    });
  } catch (err) {
    console.error("❌ CAMERA DB error:", err);
    alert("カメラDBの読込に失敗しました。");
  }

  /***** 📌 予約状況取得 *****/
  let reservations = [];
  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    // GAS 側 doGet は { status, rows: [...] } を返している想定
    reservations = Array.isArray(data.rows) ? data.rows : [];
  } catch (err) {
    console.error("❌ Reservations DB error:", err);
    alert("予約データの読込に失敗しました。");
  }

  /***** 📌 指定日が予約済みか？ *****/
  function isBooked(date, equip) {
    const t = toDate(date);
    return reservations.some(r => {
      if (r.equip !== equip) return false;
      const s = toDate(r.start);
      const e = toDate(r.end);
      return s <= t && t <= e;
    });
  }

  /***** 📌 借り始め日から選べる返却日の候補 *****/
  function getEndDates(start, equip) {
    const s = toDate(start);
    const max = new Date(s);
    max.setDate(s.getDate() + 6);  // 最大6泊7日

    let nearest = null;

    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ds = toDate(r.start);
      if (ds > s && (!nearest || ds < nearest)) {
        nearest = ds;
      }
    });

    // 次の予約の前日まではOK
    const limit = nearest ? (() => {
      const d = new Date(nearest);
      d.setDate(d.getDate() - 1);
      return d;
    })() : max;

    const arr = [];
    let cur = new Date(s);

    while (cur <= limit) {
      arr.push(formatYMD(cur));   // ★ toISOString禁止
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 FullCalendar 描画用イベント *****/
  const events = reservations.map(r => {
    const e = toDate(r.end);
    e.setDate(e.getDate() + 1);   // FullCalendar の「終了日は翌日指定」

    return {
      title: `${r.equip} 貸出中`,
      start: r.start,            // "YYYY-MM-DD"
      end: formatYMD(e),         // ★ ここも toISOString禁止でズレ防止
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
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() + 7); // 今日から7日後以降

      if (toDate(info.dateStr) < now) {
        alert("借り始めは「今日から7日後」以降です。");
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
  const show = id => {
    const el = modal(id);
    el.style.display = "flex";
    el.classList.add("show");
  };
  const hide = id => {
    const el = modal(id);
    el.classList.remove("show");
    setTimeout(() => (el.style.display = "none"), 200);
  };

  /***** 📌 カメラ選択モーダル *****/
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
        b.textContent = `${c.name} を予約する`;
        b.onclick = () => openReturnModal(dateStr, c.name);
      }

      camWrap.appendChild(b);
    });

    show("dayModal");
  }

  modal("dayClose").onclick = () => hide("dayModal");

  /***** 📌 返却日選択モーダル *****/
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

  /***** 📌 予約申請モーダル *****/
  modal("goForm").onclick = () => {
    APPLY_END = returnSelect.value;

    modal("applyEquip").textContent = `機材：${APPLY_EQUIP}`;
    modal("applyPeriod").textContent = `${APPLY_START} 〜 ${APPLY_END}`;
    modal("applyMessage").textContent = "";
    modal("applyName").value = "";
    modal("applyLine").value = "";

    hide("returnModal");
    show("applyModal");
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

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
      modal("applyMessage").textContent = "✔ 予約完了！";
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error("予約送信エラー:", err);
      modal("applyMessage").textContent = "⚠ 通信エラーが発生しました。";
    }
  };

  /***** ❌ 予約キャンセルモーダル *****/
  modal("cancelClose").onclick = () => hide("cancelModal");

  function openCancelModal(equip, start, code) {
    modal("cancelTarget").textContent = `${equip} / ${start}`;
    modal("cancelMessage").textContent = "";
    modal("cancelName").value = "";
    modal("cancelCode").value = "";
    show("cancelModal");

    // クリック時にその予約に対応する情報を渡す
    modal("cancelSend").onclick = () => cancelSend(equip, start, code);
  }

  async function cancelSend(equip, start, _codeFromDB) {
    const name = modal("cancelName").value.trim();
    const userCode = modal("cancelCode").value.trim();

    if (!name || !userCode) {
      modal("cancelMessage").textContent = "❌ 氏名と認証コードを入力してください。";
      return;
    }

    const payload = {
      mode: "cancel",
      name,
      equip,
      start,      // "YYYY-MM-DD"
      code: userCode
    };

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });

      modal("cancelMessage").textContent = "✔ キャンセル完了！";
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      console.error("キャンセル送信エラー:", err);
      modal("cancelMessage").textContent = "⚠ 通信エラーが発生しました。";
    }
  }

}); // END DOMContentLoaded