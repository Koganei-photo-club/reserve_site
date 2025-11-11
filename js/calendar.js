/*********************************************
 * camera_reserve_site / calendar.js
 * Googleフォームで登録された貸出情報を取得して表示。
 * イベントをクリックするとキャンセル申請ダイアログを開く。
 *********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/"; // WorkerのURLに合わせて変更

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    // === スプレッドシートのデータをイベント形式に変換 ===
    const events = data.map(row => {
      const startRaw = row["借り始め予定日"];
      const endRaw = row["返却予定日"];
      const equipment = row["借りたい機材"];

      // 返却日を含めるために +1日補正
      const endDate = new Date(endRaw);
      endDate.setDate(endDate.getDate() + 1);

      return {
        title: `${equipment} 貸出中`,
        start: startRaw,
        end: endDate.toISOString().split("T")[0], // FullCalendar用
        color: "#007bff"
      };
    });

    // === FullCalendar 設定 ===
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ja",
      height: "auto",
      events: events,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit" },
      displayEventEnd: true,

      // --- イベントクリック（キャンセル申請） ---
      eventClick: async function (info) {
        const eventTitle = info.event.title;
        const name = prompt(`「${eventTitle}」の予約をキャンセルします。\nご自身の氏名を入力してください：`);
        if (!name) return;

        const code = prompt("認証コード（4桁）を入力してください：");
        if (!code) return;

        // キャンセルリクエスト送信
        const payload = {
          requestType: "キャンセルする",
          name: name,
          equipment: eventTitle.replace(" 貸出中", ""),
          authCode: code
        };

        try {
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          const result = await res.json();
          alert(result.message || "キャンセル処理が完了しました。");
          location.reload(); // 成功時に再読込
        } catch (err) {
          console.error("キャンセル送信エラー:", err);
          alert("キャンセル処理に失敗しました。");
        }
      }
    });

    calendar.render();

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
});