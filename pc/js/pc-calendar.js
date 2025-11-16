/**********************************************
 * PC予約カレンダー 完全安定版（2025-11）
 **********************************************/

document.addEventListener("DOMContentLoaded", async function () {

  const calendarEl = document.getElementById("calendar");
  const apiUrl = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

  const TIME_SLOTS = [
    "10:50〜11:40", "11:40〜12:30",
    "13:20〜14:10", "14:10〜15:00",
    "15:10〜16:00", "16:00〜16:50",
    "17:00〜17:50", "17:50〜18:40"
  ];

// ===============================
// PC予約：JSTで前日締切
// ===============================
function isPcSlotAvailable(dateStr) {
  // 今日の JST YYYY-MM-DD を作成
  const now = new Date();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const todayJst = new Date(now.getTime() + jstOffsetMs);
  const todayStr = todayJst.toISOString().split("T")[0];

  // 今日の JST 00:00 を作る
  const today0 = new Date(`${todayStr}T00:00:00+09:00`);

  // 対象日を JST 00:00 に固定
  const target = new Date(`${dateStr}T00:00:00+09:00`);

  // 今日より未来の日付だけ予約可能
  return target > today0;
}

  let rawData = [];


  /************************************************
   * 予約データ取得
   ************************************************/
  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
  } catch (err) {
    console.error("予約データ取得エラー:", err);
    return;
  }


  /************************************************
   * 日付別の予約カウント
   ************************************************/
  const countByDate = {};
  rawData.forEach(r => {
    if (!r.date) return;
    if (!countByDate[r.date]) countByDate[r.date] = 0;
    countByDate[r.date]++;
  });


  /************************************************
   * カレンダー本体
   ************************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    // ========= 日セル描画（初回 & 月移動後に再実行される） =========
    dayCellDidMount(info) {
      paintCell(info, calendar);
    },

    // ========= 表示月が確定した直後に発火（Safari対策・最重要） =========
    datesSet(info) {
      fixMonthPaint(calendar, countByDate);
    },

    dateClick(info) {
      openDayModal(info.dateStr);
    }
  });

  calendar.render();


  /************************************************
   * 日セルの色付け（関数化）
   ************************************************/
  function paintCell(info, calendarInstance) {

    const cellDate = info.date;
    const dispMonth = info.view.currentStart.getMonth();
    const dispYear  = info.view.currentStart.getFullYear();

    // 他の月のセルは背景クリア
    if (cellDate.getMonth() !== dispMonth || cellDate.getFullYear() !== dispYear) {
      const old = info.el.querySelector(".pc-mark");
      if (old) old.remove();
      info.el.style.background = "";
      return;
    }

    const dateStr = cellDate.toISOString().split("T")[0];
    const cnt = countByDate[dateStr] || 0;

    let mark = "◯";
    let color = "#c8f7c5";
    if (cnt >= 4 && cnt <= 7) {
      mark = "△";
      color = "#ffe8b3";
    } else if (cnt >= 8) {
      mark = "×";
      color = "#ffd6d6";
    }

    info.el.style.position = "relative";
    info.el.style.background = color;

    const oldMark = info.el.querySelector(".pc-mark");
    if (oldMark) oldMark.remove();

    const div = document.createElement("div");
    div.className = "pc-mark";
    div.textContent = mark;

    Object.assign(div.style, {
      position: "absolute",
      bottom: "4px",
      right: "4px",
      fontSize: "1.4em",
      fontWeight: "bold",
      pointerEvents: "none"
    });

    info.el.appendChild(div);
  }


  /************************************************
   * 月が確定した後に全日セルを再塗り（最重要）
   ************************************************/
  function fixMonthPaint(calendarInstance, countMap) {

    const view = calendarInstance.view;
    const start = new Date(view.currentStart);
    const end   = new Date(view.currentEnd);

    const mid = new Date((start.getTime() + end.getTime()) / 2);

    const dispMonth = mid.getMonth();
    const dispYear  = mid.getFullYear();

    document.querySelectorAll(".fc-daygrid-day").forEach(cell => {

      const dateStr = cell.getAttribute("data-date");
      if (!dateStr) return;

      const d = new Date(dateStr);

      // 他の月のセルは背景クリア
      if (d.getMonth() !== dispMonth || d.getFullYear() !== dispYear) {
        cell.style.background = "";
        const old = cell.querySelector(".pc-mark");
        if (old) old.remove();
        return;
      }

      // 今月のセルだけ色付け
      const cnt = countMap[dateStr] || 0;

      let mark = "◯";
      let color = "#c8f7c5";
      if (cnt >= 4 && cnt <= 7) {
        mark = "△";
        color = "#ffe8b3";
      } else if (cnt >= 8) {
        mark = "×";
        color = "#ffd6d6";
      }

      cell.style.background = color;
      cell.style.position = "relative";

      const old = cell.querySelector(".pc-mark");
      if (old) old.remove();

      const div = document.createElement("div");
      div.className = "pc-mark";
      div.textContent = mark;

      Object.assign(div.style, {
        position: "absolute",
        bottom: "4px",
        right: "4px",
        fontSize: "1.4em",
        fontWeight: "bold",
        pointerEvents: "none"
      });

      cell.appendChild(div);
    });
  }


  /************************************************
   * 日別モーダル
   ************************************************/
  const dayModal = document.getElementById("dayModal");
  const dayTitle = document.getElementById("dayTitle");
  const timeSlotsEl = document.getElementById("timeSlots");
  const dayClose = document.getElementById("dayClose");

  dayClose.addEventListener("click", () => {
    dayModal.style.display = "none";
  });

  function openDayModal(date) {
    dayTitle.textContent = `${date} の予約状況`;

    const todaysData = rawData.filter(r => r.date === date);
    timeSlotsEl.innerHTML = "";

    TIME_SLOTS.forEach(slot => {
      const reserved = todaysData.some(r => r.slot === slot);
      const available = isPcSlotAvailable(date);

      const btn = document.createElement("button");

      // 締切済み（日付が当日・過去）
      if (!available) {
        btn.className = "slot closed";
        btn.textContent = `${slot}（予約締切）`;
        btn.disabled = true;
        timeSlotsEl.appendChild(btn);
        return;
        }
      if (reserved) {
        btn.className = "slot booked";
        btn.textContent = `${slot}（予約済）`;
        btn.addEventListener("click", () => openCancelModal(date, slot));
      } else {
        btn.className = "slot free";
        btn.textContent = `${slot}（空き）`;
        btn.addEventListener("click", () => openReserveConfirm(date, slot));
      }

      timeSlotsEl.appendChild(btn);
    });

    dayModal.style.display = "flex";
  }


  /************************************************
   * Googleフォームへ飛ぶ
   ************************************************/
  function openReserveConfirm(date, slot) {
    const ok = confirm(`${date} / ${slot}\nこの枠を予約しますか？`);
    if (!ok) return;

    const url =
      `https://docs.google.com/forms/d/e/1FAIpQLSc_03SmPQFbq-BtfRg-BaWW_DxTkARgwdgMReH_ExbQKx6rtQ/viewform?usp=pp_url`
      + `&entry.1916762579=${encodeURIComponent(date)}`
      + `&entry.780927556=${encodeURIComponent(slot)}`;

    window.open(url, "_blank");
  }

  // PC予約の締切判定
  function isPcSlotAvailable(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const target = new Date(dateStr);
      return target > today; // 今日より未来の日だけ可
  }


  /************************************************
   * キャンセル申請
   ************************************************/
  const cancelModal = document.getElementById("cancelModal");
  const cancelTarget = document.getElementById("cancelTarget");
  const cancelClose = document.getElementById("cancelClose");
  const cancelConfirm = document.getElementById("cancelConfirm");
  const cancelMessage = document.getElementById("cancelMessage");

  cancelClose.addEventListener("click", () => cancelModal.style.display = "none");

  let cancelDate = "";
  let cancelSlot = "";

  function openCancelModal(date, slot) {
    cancelDate = date;
    cancelSlot = slot;
    cancelTarget.textContent = `${date} / ${slot}`;
    cancelMessage.textContent = "";
    cancelModal.style.display = "flex";
  }


  cancelConfirm.addEventListener("click", async () => {
    const name = document.getElementById("cancelName").value.trim();
    const code = document.getElementById("cancelCode").value.trim();

    if (!name || !code) {
      cancelMessage.textContent = "⚠️ 氏名と認証コードを入力してください。";
      return;
    }

    const payload = {
      requestType: "PCキャンセル",
      date: cancelDate,
      slot: cancelSlot,
      name: name,
      auth: code
    };

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      cancelMessage.textContent = result.message;

      if (result.status === "success") {
        setTimeout(() => location.reload(), 1500);
      }

    } catch (err) {
      console.error(err);
      cancelMessage.textContent = "⚠️ 通信エラーが発生しました。";
    }
  });

});