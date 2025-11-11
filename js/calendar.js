/*********************************************
 * calendar.js
 * カメラ貸出カレンダー表示＋キャンセル申請対応版
 *********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    // スプレッドシートから取得したデータをイベント化
    const events = data.map(row => {
      const start = row["借り始め予定日"];
      const endRaw = row["返却予定日"];
      const endDate = new Date(endRaw);
      endDate.setDate(endDate.getDate() + 1); // ← 返却日を含めて表示
      const equipment = row["借りたい機材"];

      return {
        title: `${equipment} 貸出中`,
        start: start,
        end: endDate.toISOString().split("T")[0],
        color: "#007bff",
        extendedProps: { equipment: equipment },
      };
    });

    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      locale: "ja",
      height: "auto",
      events: events,

      // イベントクリックでキャンセルモーダルを開く
      eventClick: function (info) {
        const modal = document.createElement("div");
        modal.className = "cancel-modal";
        modal.innerHTML = `
          <div class="cancel-box">
            <h3>キャンセル申請</h3>
            <p>この予約をキャンセルしますか？<br>本人確認のため氏名と認証コードを入力してください。</p>
            <input type="text" id="cancelName" placeholder="氏名（例：山田 太郎）">
            <input type="text" id="cancelCode" placeholder="認証コード（4桁）">
            <div class="cancel-buttons">
              <button id="cancelConfirm">キャンセルする</button>
              <button id="cancelClose">閉じる</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        // 閉じるボタン
        modal.querySelector("#cancelClose").addEventListener("click", () => modal.remove());

        // キャンセル送信
        modal.querySelector("#cancelConfirm").addEventListener("click", async () => {
          const name = document.getElementById("cancelName").value.trim();
          const code = document.getElementById("cancelCode").value.trim();

          if (!name || !code) {
            alert("氏名と認証コードを入力してください。");
            return;
          }

          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestType: "キャンセルする",
              name: name,
              authCode: code,
              equipment: info.event.extendedProps.equipment,
            }),
          });

          const result = await res.json();
          alert(result.message || "処理が完了しました。");
          modal.remove();

          if (result.status === "success") location.reload();
        });
      },
    });

    calendar.render();

  } catch (error) {
    console.error("データ取得エラー:", error);
  }
});