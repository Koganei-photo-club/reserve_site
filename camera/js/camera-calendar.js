/**********************************************
 * 📷 カメラ貸出カレンダー 完全版
 *  - Cloudflare Worker (camera-proxy) 経由で予約取得
 *  - 予約期間を FullCalendar に表示
 *  - 日付クリック → カメラ選択 → Googleフォームにプリフィル
 *  - 借り始めは「今日から 7日後 以降」だけ予約可能
 **********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // 🔗 Cloudflare Worker（カメラ用）
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  // 🔧 カメラの種類（表示用 + フォーム用）
  const CAMERAS = [
    "Canon EOS 5D Mark III",
    "Canon EOS R10",
    "Nikon D3000"
  ];

  // 🔧 Googleフォーム（カメラ予約）のプリフィル URL（ベース）
  //  entry.389826105 = 借りたい機材
  //  entry.445112185 = 借り始め予定日
  const FORM_BASE_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfNVO0OilcqtDFXmj2FjauZ4fQX7_ZKO0xBdZIf6U9Cg53yMQ/viewform?usp=pp_url";

  /****************************************
   * ⏰ カメラ予約の「開始可能日」チェック
   *  - 借り始め予定日は「今日から 7日後 以降」
   ****************************************/
  function isCameraStartAvailable(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const minStart = new Date(today);
    minStart.setDate(minStart.getDate() + 7); // 今日 + 7日

    // info.dateStr は "YYYY-MM-DD" 形式
    const target = new Date(dateStr + "T00:00:00");

    return target >= minStart;
  }

  /****************************************
   * 📥 予約データの取得
   ****************************************/
  let rawData = [];

  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
    // 期待する形：
    // [{ timestamp, name, line, equip, start, end, auth }, ...]
  } catch (err) {
    console.error("カメラ予約データ取得エラー:", err);
    rawData = [];
  }

  /****************************************
   * 📅 FullCalendar 用イベント配列に変換
   ****************************************/
  const events = [];

  rawData.forEach(r => {
    if (!r.start || !r.end || !r.equip) return;

    const start = new Date(r.start + "T00:00:00");
    const end = new Date(r.end + "T00:00:00");

    // FullCalendar の allDay イベントで「end は翌日」を指定
    const endPlusOne = new Date(end);
    endPlusOne.setDate(endPlusOne.getDate() + 1);

    events.push({
      title: `${r.equip} 貸出中`,
      start: start.toISOString().split("T")[0],
      end: endPlusOne.toISOString().split("T")[0],
      allDay: true
    });
  });

  /****************************************
   * 📅 カレンダー本体
   ****************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",
    events: events,

    // 日付クリック → カメラ選択モーダル
    dateClick: function (info) {
      const dateStr = info.dateStr; // "YYYY-MM-DD"

      // 予約開始可能日チェック
      if (!isCameraStartAvailable(dateStr)) {
        alert(
          "カメラの予約は、借り始め予定日の 1週間前までに行ってください。\n" +
          "本日から 7日以内の日付は、借り始めとして選択できません。"
        );
        return;
      }

      openDayModal(dateStr);
    }
  });

  calendar.render();

  /****************************************
   * 📦 カメラ選択モーダル（Day Modal）
   ****************************************/
  const dayModal = document.getElementById("dayModal");
  const dayTitle = document.getElementById("dayTitle");
  const cameraButtons = document.getElementById("cameraButtons");
  const dayCloseBtn = document.getElementById("dayClose");

  dayCloseBtn.addEventListener("click", () => {
    dayModal.style.display = "none";
  });

  function openDayModal(dateStr) {
    dayTitle.textContent = `${dateStr} から借り始め`;

    // ボタンを一度リセット
    cameraButtons.innerHTML = "";

    CAMERAS.forEach(equipName => {
      const btn = document.createElement("button");
      btn.textContent = equipName + " を予約する";
      btn.addEventListener("click", () => {
        openReserveForm(dateStr, equipName);
      });
      cameraButtons.appendChild(btn);
    });

    dayModal.style.display = "flex";
  }

  /****************************************
   * 📝 Googleフォームをプリフィルして開く
   ****************************************/
  function openReserveForm(startDate, equipName) {
    const url =
      FORM_BASE_URL +
      `&entry.389826105=${encodeURIComponent(equipName)}` +      // 借りたい機材
      `&entry.445112185=${encodeURIComponent(startDate)}`;       // 借り始め予定日

    window.open(url, "_blank");
  }
});