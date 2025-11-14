/*********************************************
 * camera_reserve_site / calendar.js
 * Googleフォームで登録された貸出情報を取得して表示。
 * イベントをクリックするとキャンセル申請ダイアログを開く。
 *********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/"; // WorkerのURL

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

// === スプレッドシートのデータをイベント形式に変換 ===
const events = data.map(row => {
  const startRaw = row["借り始め予定日"];
  const endRaw = row["返却予定日"];
  const equipment = row["借りたい機材"];

  if (!startRaw || !endRaw) return null; // ← 日付が無い場合はスキップ

  // ✅ スラッシュ区切りでもハイフンに変換して安全にパース
  const startDate = new Date(String(startRaw).replace(/\//g, "-"));
  const endDate = new Date(String(endRaw).replace(/\//g, "-"));

  // ✅ 日付が不正な場合はスキップ（Invalid Date対策）
  if (isNaN(startDate) || isNaN(endDate)) {
    console.warn("⚠️ 無効な日付をスキップ:", row);
    return null;
  }

  // ✅ 返却日を含めるため +1日補正
  startDate.setHours(startDate.getHours() + 9); // ← JST調整
  endDate.setHours(endDate.getHours() + 9); // ← JST調整
  endDate.setDate(endDate.getDate() + 1);

  return {
    title: `${equipment} 貸出中`,
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
    color: "#007bff"
  };
}).filter(e => e !== null); // ← 無効データを除外

    // === FullCalendar 設定 ===
const calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: "dayGridMonth",
  locale: "ja",
  height: "auto",

  events: events,

  eventTimeFormat: { hour: "2-digit", minute: "2-digit" },
  displayEventEnd: true,

  // ← 追加：同日複数イベントの最大表示数
  dayMaxEventRows: 3,

  views: {
    dayGridMonth: {
      dayMaxEventRows: 3
    }
  },

  // --- イベントクリック（キャンセル申請） ---
  eventClick: function (info) {
    const modal = document.getElementById("cancelModal");
    const targetText = document.getElementById("cancelTarget");
    const messageEl = document.getElementById("cancelMessage");

    targetText.textContent = `対象：${info.event.title}`;
    messageEl.textContent = "";
    modal.style.display = "flex";

    modal.dataset.equipment = info.event.title.replace(" 貸出中", "").trim();
  }
});

    calendar.render();

    // === モーダル操作 ===
    const modal = document.getElementById("cancelModal");
    const closeBtn = document.getElementById("cancelClose");
    const confirmBtn = document.getElementById("cancelConfirm");
    const messageEl = document.getElementById("cancelMessage");

    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    confirmBtn.addEventListener("click", async () => {
      const name = document.getElementById("cancelName").value.trim();
      const code = document.getElementById("cancelCode").value.trim();
      const equipment = modal.dataset.equipment || "";

      if (!name || !equipment || !code) {
        messageEl.textContent = "⚠️ 氏名・認証コード・機材情報が不足しています。";
        return;
      }

      const payload = {
        requestType: "キャンセルする",
        name: name,
        equipment: equipment,
        authCode: code
      };
      
      console.log("キャンセル送信データ:", payload);

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await res.json();
        messageEl.textContent = result.message;

        if (result.status === "success") {
          setTimeout(() => location.reload(), 1500); // 成功後1.5秒で再読込
        }
      } catch (err) {
        console.error("キャンセル送信エラー:", err);
        messageEl.textContent = "⚠️ 通信エラーが発生しました。";
      }
    });

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
});
