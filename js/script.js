document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // ✅ Cloudflare Worker の URL
  const apiUrl = "https://camera-proxy.koganei-photo-club-hosei-1c2.workers.dev";

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    // ✅ 改行を含むキーを正規化して取得
    const events = data.map(row => {
      const endKey = Object.keys(row).find(k => k.includes("返却予定日"));

      // ✅ 日付を "YYYY-MM-DD" に変換
      const start = row["借り始め予定日を選択してください。"]?.replaceAll("/", "-");
      const end = row[endKey]?.replaceAll("/", "-");

      return {
        title: `${row["借りたい機材を選択してください。"]} 貸出中（${row["LINEの名前を記入してください。"]}）`,
        start: start,
        end: end,
        color: "#007bff"
      };
    });

    // ✅ FullCalendar初期化
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ja",
      height: "auto",
      events: events,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit" },
      displayEventEnd: true
    });

    calendar.render();

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
});