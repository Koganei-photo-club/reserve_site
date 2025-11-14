// /pc/js/pc-calendar.js

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("pc-calendar");
  if (!calendarEl) return;

  // ★ここはあなたの PC 用 Worker の URL に差し替え
  const apiUrl = "https://pc-proxy.photo-club-at-koganei.workers.dev/";

  // ★ここはあなたの PC 予約 Googleフォームの「プレフィルURL」をベースに差し替え
  //   例: https://docs.google.com/forms/d/e/xxxxx/viewform?usp=pp_url&entry.123456=
  const FORM_BASE_URL = "https://docs.google.com/forms/d/e/XXXXXXXXXXXX/viewform?usp=pp_url";

  // Googleフォームの「申請予定枠」用entry ID (例)
  const ENTRY_SLOT = "entry.123456"; // ← 実際のIDに変えてください

  // 3コマの情報（表示ラベルと内部ID）
  const SLOTS = [
    { id: "slot1", label: "1限 10:50〜12:30" },
    { id: "slot2", label: "2限 13:20〜15:00" },
    { id: "slot3", label: "3限 15:10〜16:50" },
  ];

  // ========== 1. 予約データ取得 ==========
  let reservations = [];
  try {
    const res = await fetch(apiUrl);
    reservations = await res.json();
    // 期待フォーマット（例）:
    // [{ date: "2025-11-15", slot: "slot1" }, ...]
  } catch (e) {
    console.error("PC予約データ取得エラー:", e);
  }

  // ========== 2. 日別にどの枠が埋まっているか集計 ==========
  const dayMap = {}; // { "YYYY-MM-DD": { reserved: Set(["slot1", "slot2"]) } }

  reservations.forEach(row => {
    const date = row.date;     // "2025-11-15"
    const slot = row.slot;     // "slot1" / "slot2" / "slot3"
    if (!date || !slot) return;

    if (!dayMap[date]) {
      dayMap[date] = { reserved: new Set() };
    }
    dayMap[date].reserved.add(slot);
  });

  // ========== 3. FullCalendar 初期化 ==========
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    // 今回は枠単位のイベント表示より「セルの色と記号」がメイン
    events: [],

    // ◯ / △ / × の文字を日付に追加
    dayCellContent: function (arg) {
      const dateStr = arg.date.toISOString().split("T")[0]; // "YYYY-MM-DD"
      const reservedSet = dayMap[dateStr]?.reserved || new Set();
      const count = reservedSet.size;

      let mark = ""; // デフォルトは何も付けない
      if (count === 0) mark = "◯";
      else if (count < SLOTS.length) mark = "△";
      else mark = "×";

      // 既存の日付テキストを保持しつつ、◯△×を付ける
      const inner = document.createElement("div");
      inner.innerHTML = `
        <span class="fc-daygrid-day-number pc-status-mark">
          ${arg.dayNumberText}
        </span>
        <span style="margin-left:0.3em;">${mark}</span>
      `;
      return { domNodes: [inner] };
    },

    // セル背景色の付与
    dayCellClassNames: function (arg) {
      const dateStr = arg.date.toISOString().split("T")[0];
      const reservedSet = dayMap[dateStr]?.reserved || new Set();
      const count = reservedSet.size;

      if (count === 0) return [ "pc-free" ];
      if (count < SLOTS.length) return [ "pc-partial" ];
      return [ "pc-full" ];
    },

    // 日付クリックでその日の枠一覧モーダルを開く
    dateClick: function (info) {
      const dateStr = info.dateStr; // "YYYY-MM-DD"
      openSlotModal(dateStr);
    }
  });

  calendar.render();

  // ========== 4. モーダルの中身生成ロジック ==========
  const modal = document.getElementById("pcSlotModal");
  const modalBox = document.getElementById("pcSlotModalBox");

  function openSlotModal(dateStr) {
    const reservedSet = dayMap[dateStr]?.reserved || new Set();

    // 日付表示用
    const dateLabel = dateStr.replace(/-/g, "/");

    // モーダル内容（まずは枠一覧）
    let html = `<h3>${dateLabel} の予約状況</h3>`;
    html += `<p>時間枠を選択してください。</p>`;

    html += `<div>`;
    SLOTS.forEach(slot => {
      const isReserved = reservedSet.has(slot.id);
      const btnClass = isReserved ? "pc-slot-button reserved" : "pc-slot-button free";
      const disabled = isReserved ? "data-type='cancel'" : "data-type='reserve'";

      html += `
        <button class="${btnClass}"
                data-slot-id="${slot.id}"
                data-slot-label="${slot.label}"
                ${disabled}>
          ${slot.label} ${isReserved ? "（予約済）" : "（空き）"}
        </button>
      `;
    });
    html += `</div>`;
    html += `<button id="pcSlotClose" style="margin-top:1em;">閉じる</button>`;

    modalBox.innerHTML = html;
    modal.style.display = "flex";

    // 枠ボタンのイベント登録
    modalBox.querySelectorAll(".pc-slot-button").forEach(btn => {
      const slotId = btn.dataset.slotId;
      const slotLabel = btn.dataset.slotLabel;
      const isReserved = reservedSet.has(slotId);

      btn.addEventListener("click", () => {
        if (isReserved) {
          // キャンセルフローへ
          openCancelFlow(dateStr, slotId, slotLabel);
        } else {
          // 予約フローへ
          openReserveConfirm(dateStr, slotId, slotLabel);
        }
      });
    });

    // 閉じるボタン
    modalBox.querySelector("#pcSlotClose").addEventListener("click", () => {
      modal.style.display = "none";
    });

    // 背景クリックでも閉じる
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.style.display = "none";
    }, { once: true });
  }

  // ========== 5. 予約フロー ==========
  function openReserveConfirm(dateStr, slotId, slotLabel) {
    const dateLabel = dateStr.replace(/-/g, "/");

    modalBox.innerHTML = `
      <h3>予約申請</h3>
      <p>${dateLabel} の「${slotLabel}」枠を予約しますか？</p>
      <div style="margin-top:1em;">
        <button id="pcReserveYes" class="pc-slot-button free">はい</button>
        <button id="pcReserveNo" class="pc-slot-button reserved">いいえ</button>
      </div>
    `;

    document.getElementById("pcReserveYes").addEventListener("click", () => {
      // Googleフォームに飛ぶ（枠をURLに仕込む）
      const slotText = `${dateLabel} ${slotLabel}`;
      const url = `${FORM_BASE_URL}&${ENTRY_SLOT}=${encodeURIComponent(slotText)}`;
      window.open(url, "_blank");
      modal.style.display = "none";
    });

    document.getElementById("pcReserveNo").addEventListener("click", () => {
      // 元の枠一覧に戻る
      openSlotModal(dateStr);
    });
  }

  // ========== 6. キャンセルフロー ==========
  function openCancelFlow(dateStr, slotId, slotLabel) {
    const dateLabel = dateStr.replace(/-/g, "/");

    modalBox.innerHTML = `
      <h3>キャンセル申請</h3>
      <p>${dateLabel} の「${slotLabel}」の予約をキャンセルしますか？</p>
      <div style="margin-top:1em;">
        <button id="pcCancelYes" class="pc-slot-button free">はい</button>
        <button id="pcCancelNo" class="pc-slot-button reserved">いいえ</button>
      </div>
      <p id="pcCancelMessage" style="margin-top:1em; font-weight:bold;"></p>
    `;

    const msgEl = document.getElementById("pcCancelMessage");

    document.getElementById("pcCancelYes").addEventListener("click", () => {
      // 氏名＋認証コード入力フォーム表示
      modalBox.innerHTML = `
        <h3>キャンセル申請</h3>
        <p>${dateLabel} の「${slotLabel}」のキャンセルを行います。</p>
        <input type="text" id="pcCancelName" placeholder="氏名を入力" style="width:100%; margin:0.3em 0;">
        <input type="text" id="pcCancelCode" placeholder="認証コード（4桁）" style="width:100%; margin:0.3em 0;">
        <div style="margin-top:1em;">
          <button id="pcCancelSend" class="pc-slot-button free">申請する</button>
          <button id="pcCancelBack" class="pc-slot-button reserved">戻る</button>
        </div>
        <p id="pcCancelMessage" style="margin-top:1em; font-weight:bold;"></p>
      `;

      const msgEl2 = document.getElementById("pcCancelMessage");

      document.getElementById("pcCancelSend").addEventListener("click", async () => {
        const name = document.getElementById("pcCancelName").value.trim();
        const code = document.getElementById("pcCancelCode").value.trim();

        if (!name || !code) {
          msgEl2.textContent = "⚠️ 氏名と認証コードを入力してください。";
          return;
        }

        const payload = {
          requestType: "PCキャンセル",
          date: dateStr,
          slot: slotId,
          name: name,
          authCode: code
        };

        try {
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const result = await res.json();
          msgEl2.textContent = result.message || "キャンセル申請を送信しました。";

          if (result.status === "success") {
            setTimeout(() => location.reload(), 1500);
          }
        } catch (e) {
          console.error("PCキャンセル送信エラー:", e);
          msgEl2.textContent = "⚠️ 通信エラーが発生しました。";
        }
      });

      document.getElementById("pcCancelBack").addEventListener("click", () => {
        openSlotModal(dateStr);
      });
    });

    document.getElementById("pcCancelNo").addEventListener("click", () => {
      openSlotModal(dateStr);
    });
  }
});