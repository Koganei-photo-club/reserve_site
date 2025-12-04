// reserve_site/pc/js/pc-calendar.js
/**********************************************
 * 💻 PC予約カレンダー（共通化版 ＋ 旧仕様の表示）
 **********************************************/

const API_URL = "https://pc-proxy.photo-club-at-koganei.workers.dev/";
const {
  toDate, toYMD, $, showModal, hideModal,
  fetchReservations
} = CalendarUtil;

// 固定の時間枠
const TIME_SLOTS = [
  "10:50〜11:40", "11:40〜12:30",
  "13:20〜14:10", "14:10〜15:00",
  "15:10〜16:00", "16:00〜16:50",
  "17:00〜17:50", "17:50〜18:40"
];

document.addEventListener("DOMContentLoaded", async () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    console.error("❌ #calendar が見つかりません");
    return;
  }

  /**********************************************
   * 📌 ユーザー情報取得
   **********************************************/
  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) {
    alert("⚠ 予約にはログインが必要です");
  }

  /**********************************************
   * 📌 予約データ取得
   **********************************************/
  const reservations = await fetchReservations(API_URL);

  // 日付別の予約カウント（旧 countByDate と同じ）
  const dailyCount = {};
  reservations.forEach(r => {
    const date = r.start;       // PC では start = 予約日
    if (!date) return;
    if (!dailyCount[date]) dailyCount[date] = 0;
    dailyCount[date]++;
  });

  /**********************************************
   * 📅 FullCalendar 本体
   **********************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    // 各セル生成時に一度塗る
    dayCellDidMount(info) {
      paintCell(info, calendar);
    },

    // 月が切り替わった後に全セル塗り直す
    datesSet() {
      fixMonthPaint(calendar, dailyCount);
    },

    dateClick(info) {
      console.log("クリック検知:", info.dateStr);
      if (!user) {
        alert("ログインユーザーのみ予約できます");
        return;
      }
      openDayModal(info.dateStr);
    }
  });

  calendar.render();

  /************************************************
   * 日セルの色付け（旧 paintCell ロジック移植）
   ************************************************/
  function paintCell(info, calendarInstance) {
    const cellDate = info.date;
    const view = calendarInstance.view;

    const dispMonth = view.currentStart.getMonth();
    const dispYear  = view.currentStart.getFullYear();

    // 表示中の月以外（前月・翌月）は何もしない
    if (cellDate.getMonth() !== dispMonth || cellDate.getFullYear() !== dispYear) {
      const old = info.el.querySelector(".pc-mark");
      if (old) old.remove();
      info.el.style.background = "";
      return;
    }

    const dateStr = cellDate.toISOString().split("T")[0];
    const cnt = dailyCount[dateStr] || 0;

    let mark = "◯";
    let color = "#c8f7c5";
    if (cnt >= 4 && cnt <= 7) {
      // 4〜7件 → △
      mark = "△";
      color = "#ffe8b3";
    } else if (cnt >= 8) {
      // 8件以上 → ×（8枠あるので満杯）
      mark = "×";
      color = "#ffd6d6";
    }

    info.el.style.position = "relative";
    info.el.style.background = color;

    // 既存マークを消す
    const oldMark = info.el.querySelector(".pc-mark");
    if (oldMark) oldMark.remove();

    // 右下にマークを重ねて表示
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
   * 月が確定した後に全日セルを再塗り（旧 fixMonthPaint）
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

      // 表示中の月以外は背景＆マークをリセット
      if (d.getMonth() !== dispMonth || d.getFullYear() !== dispYear) {
        cell.style.background = "";
        const old = cell.querySelector(".pc-mark");
        if (old) old.remove();
        return;
      }

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

  /**********************************************
   * 🔹 PC：締切判定 (JST)
   **********************************************/
  function isSlotAvailable(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 今日の0時
    const d = new Date(date + "T00:00:00+09:00");
    return d > today; // 前日締切
  }

  /**********************************************
   * 🔹 日別モーダル
   **********************************************/
  const timeSlotsEl = $("#timeSlots");

  function openDayModal(date) {
    const titleEl = $("#dayTitle");
    if (!titleEl) return; // 念のため

    titleEl.textContent = `${date} の予約状況`;
    timeSlotsEl.innerHTML = "";

    const todays = reservations.filter(r => r.start === date);

    TIME_SLOTS.forEach(slot => {
      const reserved = todays.some(r => r.slot === slot);
      const available = isSlotAvailable(date);

      const btn = document.createElement("button");

      if (reserved) {
        btn.className = "slot booked";
        btn.textContent = `${slot}（予約済）`;
        btn.onclick = () => openCancelModal(date, slot);
      } else if (!available) {
        btn.className = "slot closed";
        btn.textContent = `${slot}（締切）`;
        btn.disabled = true;
      } else {
        btn.className = "slot free";
        btn.textContent = `${slot}（空き）`;
        btn.onclick = () => reserve(date, slot);
      }

      timeSlotsEl.appendChild(btn);
    });

    showModal("dayModal");
  }

  const dayCloseBtn = document.getElementById("dayClose");
  if (dayCloseBtn) {
    dayCloseBtn.onclick = () => hideModal("dayModal");
  }

  /**********************************************
   * 📌 予約
   **********************************************/
  async function reserve(date, slot) {
    if (!confirm(`${date} / ${slot} を予約しますか？`)) return;

    const payload = {
      mode: "reserve",
      email: user.email,
      name: user.name,
      lineName: user.lineName,
      start: date,
      slot
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(`予約完了！認証コード: ${data.code}`);
    location.reload();
  }

  /**********************************************
   * 📌 キャンセル
   **********************************************/
  function openCancelModal(date, slot) {
    $("#cancelTarget").textContent = `${date} / ${slot}`;
    $("#cancelCode").value = "";
    $("#cancelMessage").textContent = "";
    const confirmBtn = $("#cancelConfirm");
    if (confirmBtn) {
      confirmBtn.onclick = () => cancel(date, slot);
    }
    showModal("cancelModal");
  }

  const cancelCloseBtn = document.getElementById("cancelClose");
  if (cancelCloseBtn) {
    cancelCloseBtn.onclick = () => hideModal("cancelModal");
  }

  async function cancel(date, slot) {
    const code = $("#cancelCode").value.trim();
    if (!code) {
      $("#cancelMessage").textContent = "❌ 認証コード入力";
      return;
    }

    const payload = {
      mode: "cancel",
      email: user.email,
      start: date,
      slot,
      code
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result?.result === "success") {
      alert("キャンセル成功");
      location.reload();
    } else {
      $("#cancelMessage").textContent = "一致なし / エラー";
    }
  }
});