/**********************************************
 * PC予約カレンダー 完全版（2025-11 修正版）
 **********************************************/

document.addEventListener("DOMContentLoaded", async function () {

  const calendarEl = document.getElementById("calendar");
  const apiUrl = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

  // PC予約枠（8枠）
  const TIME_SLOTS = [
    "10:50〜11:40", "11:40〜12:30",
    "13:20〜14:10", "14:10〜15:00",
    "15:10〜16:00", "16:00〜16:50",
    "17:00〜17:50", "17:50〜18:40"
  ];

  let rawData = [];

  /***********************
   * 予約データ取得
   ***********************/
  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
  } catch (err) {
    console.error("予約データ取得エラー:", err);
    return;
  }


  /***********************
   * 日付ごとの予約数を集計
   ***********************/
  const countByDate = {};
  rawData.forEach(r => {
    const d = r.date;
    if (!d) return;
    if (!countByDate[d]) countByDate[d] = 0;
    countByDate[d]++;
  });


  /***********************
   * 月間カレンダー構築
   ***********************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    /***********************
     * 各日付セルのマーク描画
     ***********************/
    dayCellDidMount(info) {
      const cellDate = info.date;

      // --- 表示中の月を正確に算出 ---
      const start = new Date(info.view.currentStart);
      const end = new Date(info.view.currentEnd);

      const middle = new Date((start.getTime() + end.getTime()) / 2);
      const displayMonth = middle.getMonth();
      const displayYear = middle.getFullYear();

      // === このセルの日付 ===
      const cellMonth = cellDate.getMonth();
      const cellYear = cellDate.getFullYear();

      // === 今月以外（前月・次月）は塗りつぶししない ===
      const isCurrentMonth = (cellYear === displayYear && cellMonth === displayMonth);
      if (!isCurrentMonth) {
        const old = info.el.querySelector(".pc-mark");
        if (old) old.remove();
        info.el.style.background = "";
        return;
      }

      // --- ここから下は「今月の日付」にだけ適用される ---
      const dateStr = cellDate.toISOString().split("T")[0];
      const cnt = countByDate[dateStr] || 0;

      // === マーク判定 ===
      let mark = "◯";
      let color = "#c8f7c5";

      if (cnt >= 4 && cnt <= 7) {
        mark = "△";
        color = "#ffe8b3";
      } else if (cnt >= 8) {
        mark = "×";
        color = "#ffd6d6";
      }

      // === 背景色セット ===
      info.el.style.position = "relative";
      info.el.style.background = color;

      // === 古いマーク削除 ===
      const oldMark = info.el.querySelector(".pc-mark");
      if (oldMark) oldMark.remove();

      // === 新しいマーク（右下固定） ===
      const markDiv = document.createElement("div");
      markDiv.className = "pc-mark";
      markDiv.textContent = mark;

      Object.assign(markDiv.style, {
        position: "absolute",
        bottom: "4px",
        right: "4px",
        fontSize: "1.4em",
        fontWeight: "bold",
        pointerEvents: "none"
      });

      info.el.appendChild(markDiv);
    },

    /***********************
     * 日付クリック → モーダル表示
     ***********************/
    dateClick(info) {
      openDayModal(info.dateStr);
    }
  });

  calendar.render();


  /**********************************************
   * 日別モーダル表示
   **********************************************/
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

      const btn = document.createElement("button");

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


  /**********************************************
   * 空き枠 → Googleフォームへ誘導
   **********************************************/
  function openReserveConfirm(date, slot) {
    const ok = confirm(`${date} / ${slot}\nこの枠を予約しますか？`);
    if (!ok) return;

    const url =
      `https://docs.google.com/forms/d/e/1FAIpQLSc_03SmPQFbq-BtfRg-BaWW_DxTkARgwdgMReH_ExbQKx6rtQ/viewform?usp=pp_url`
      + `&entry.1916762579=${encodeURIComponent(date)}`
      + `&entry.780927556=${encodeURIComponent(slot)}`;

    window.open(url, "_blank");
  }


  /**********************************************
   * キャンセル申請モーダル
   **********************************************/
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