/*********************************************
 * calendar.js
 * カメラ貸出カレンダー表示用スクリプト
 * Google Sheets（Cloudflare Worker経由）から
 * JSONデータを取得し、FullCalendarに反映する。
 *********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    const events = data.map(row => {
      const endKey = Object.keys(row).find(k => k.includes("返却予定日"));
      const start = row["借り始め予定日"];
      const endRaw = row["返却予定日"];
      // 返却予定日を「含めて」表示するため1日加算
      const endDate = new Date(endRaw);
      endDate.setDate(endDate.getDate() + 1); // ← ここで+1日！

      const equipment = row["借りたい機材"];

      return {
        title: `${equipment} 貸出中`,
        start: start,
        end: end,
        color: "#007bff",
      };
    });

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ja",
      height: "auto",
      events: events,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit" },
      displayEventEnd: true,
    });

    calendar.render();

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
});