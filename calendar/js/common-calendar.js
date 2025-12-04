// common-calendar.js
// 予約カレンダー共通ユーティリティ
// 🔹 グローバルには CalendarUtil だけを公開する

(function (global) {
  // 日付文字列 "yyyy-mm-dd" → Date (JST 00:00)
  function toDate(d) {
    return new Date(d + "T00:00:00");
  }

  // Date → "yyyy-mm-dd"
  function toYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // シンプルな ID ショートカット
  function $(id) {
    return document.getElementById(id);
  }

  // モーダル表示
  function showModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.style.display = "flex";
    m.classList.add("show");
  }

  // モーダル非表示
  function hideModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("show");
    setTimeout(() => {
      m.style.display = "none";
    }, 200);
  }

  // 連続日イベント（貸出中バー）を作る
  // row: { equip or slot, start, end, ... }
  function buildContinuousEvent(row) {
    const end = toDate(row.end);
    end.setDate(end.getDate() + 1); // FullCalendar の end は「翌日00:00まで」

    const label = row.equip || row.slot || "貸出中";

    return {
      title: `${label} 貸出中`,
      start: row.start,
      end: toYMD(end),
      extendedProps: row,
      allDay: true
    };
  }

  // 予約一覧取得
  // API が {rows:[...]} か、配列そのものを返す想定
  async function fetchReservations(apiUrl) {
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (Array.isArray(data.rows)) return data.rows;
      if (Array.isArray(data)) return data;
      return [];
    } catch (e) {
      console.error("予約データ取得エラー:", e);
      return [];
    }
  }

  // 🌟 ここだけグローバルに出す
  global.CalendarUtil = {
    toDate,
    toYMD,
    $,
    showModal,
    hideModal,
    buildContinuousEvent,
    fetchReservations
  };
})(window);