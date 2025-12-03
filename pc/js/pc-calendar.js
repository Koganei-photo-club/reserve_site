/**********************************************
 * 💻 PC予約カレンダー
 **********************************************/

const API_URL = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

document.addEventListener("DOMContentLoaded", async function () {

  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) {
    alert("⚠ 予約を行うにはログインが必要です。");
  }

  const calendarEl = document.getElementById("calendar");

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

    // 今日の JST 00:00
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
    const res = await fetch(API_URL);
    const data = await res.json();
    // GAS が { status, rows } を返している想定
    rawData = Array.isArray(data.rows) ? data.rows : (Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("予約データ取得エラー:", err);
    return;
  }

  /************************************************
   * 日付別の予約カウント
   ************************************************/
  const countByDate = {};
  rawData.forEach(r => {
    const date = r.start;  // PCでは start = 予約日
    if (!date) return;
    if (!countByDate[date]) countByDate[date] = 0;
    countByDate[date]++;
  });

  /************************************************
   * カレンダー本体
   ************************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    dayCellDidMount(info) {
      paintCell(info, calendar);
    },

    datesSet(info) {
      fixMonthPaint(calendar, countByDate);
    },

    dateClick(info) {
      if (!user) {
        alert("ログインユーザーのみ予約できます");
        return;
      }
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
   * 月が確定した後に全日セルを再塗り
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

    const todaysData = rawData.filter(r => r.start === date);
    timeSlotsEl.innerHTML = "";

    TIME_SLOTS.forEach(slot => {
      const reserved = todaysData.some(r => r.equip === slot);
      const available = isPcSlotAvailable(date);

      const btn = document.createElement("button");

      // 予約済チェック（締切より優先）
      if (reserved) {
        btn.className = "slot booked";
        btn.textContent = `${slot}（予約済）`;
        btn.addEventListener("click",()=> openCancelModal(date, slot));
      }
      // 予約はないが締切済→キャンセル不可
      else if (!available) {
        btn.className = "slot closed";
        btn.textContent = `${slot}（予約締切）`;
        btn.disabled = true;
        // timeSlotsEl.appendChild(btn);
        // return;
      }
      // 上記以外→予約可能
      else {
        btn.className = "slot free";
        btn.textContent = `${slot}（空き）`;
        btn.addEventListener("click", () => openReserveConfirm(date, slot));
      }

      timeSlotsEl.appendChild(btn);
    });

    dayModal.style.display = "flex";
  }

  /************************************************
   * 予約（Googleフォームに飛ばさず、直接API）
   ************************************************/
  async function openReserveConfirm(date, slot) {
    if (!user) {
      alert("ログインユーザーのみ予約できます");
      return;
    }

    const ok = confirm(`${date} / ${slot}\nこの枠を予約しますか？`);
    if (!ok) return;

    const payload = {
      mode: "reserve",
      email: user.email,
      name: user.name,
      lineName: user.lineName,
      slot: slot,  // 時間枠
      start: date,  // 予約日
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      alert("予約が完了しました！（認証コード: " + (result.code || "----") + "）");
      window.location.reload();

    } catch (err) {
      console.error(err);
      alert("予約送信でエラーが発生しました。");
    }
  }

  /************************************************
   * キャンセル申請
   ************************************************/
  const cancelModal = document.getElementById("cancelModal");
  const cancelTarget = document.getElementById("cancelTarget");
  const cancelClose = document.getElementById("cancelClose");
  const cancelConfirm = document.getElementById("cancelConfirm");
  const cancelMessage = document.getElementById("cancelMessage");

  cancelClose.addEventListener("click", () => {
    cancelModal.style.display = "none";
  });

  let cancelDate = "";
  let cancelSlot = "";

  function openCancelModal(date, slot) {
    cancelDate = date;
    cancelSlot = slot;
    cancelTarget.textContent = `${date} / ${slot}`;
    cancelMessage.textContent = "";
    cancelModal.style.display = "flex";
  }

const DEBUG = true; // ←切り替えスイッチ！（trueでデバッグ表示）

cancelConfirm.addEventListener("click", async () => {
  if (!user) {
    cancelMessage.textContent = "⚠ ログインしていません。";
    return;
  }

  const code = document.getElementById("cancelCode").value.trim();
  if (!code) {
    cancelMessage.textContent = "⚠ 認証コードを入力してください。";
    return;
  }

  const payload = {
    mode: "cancel",
    email: user.email,
    slot: cancelSlot,
    start: cancelDate,
    code
  };

  if (DEBUG) console.log("🔥Send cancel payload:", payload);

  cancelMessage.textContent = DEBUG
    ? "⏳送信中…（デバッグ: 結果はログ表示）"
    : "⏳キャンセル申請中…";

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);

    if (DEBUG) {
      console.log("📥Cancel response:", result);
      cancelMessage.textContent = "✔ 完了（ログで結果確認）";
    } else {
      if (result.result === "success") {
        cancelMessage.textContent = "✔ キャンセル完了！";
        setTimeout(() => window.location.reload(), 1500);
      } else {
        cancelMessage.textContent = "⚠ 一致する予約が見つかりません";
      }
    }

  } catch (err) {
    console.error(err);
    cancelMessage.textContent = "⚠ 通信エラー";
  }
});

});

/**********************************************
 * 📱 アプリ風ページ遷移（フェードアニメーション）
 **********************************************/
document.querySelectorAll("a").forEach(a => {
  const href = a.getAttribute("href");
  if (!href || href.startsWith("http") || href.startsWith("#") || a.target === "_blank") return;

  a.addEventListener("click", (e) => {
    e.preventDefault();
    const url = href;

    document.body.classList.add("fade-in");
    document.body.classList.add("fade-out");

    setTimeout(() => {
      window.location.href = url;
    }, 350);
  });
});