/**********************************************
 * Camera Reservation Calendar (FullCalendar)
 * カメラ予約システム Ver.1
 **********************************************/

document.addEventListener("DOMContentLoaded", async function () {

  const calendarEl = document.getElementById("calendar");

  // GAS → Worker → JSON 取得
  const apiUrl = "https://pc-proxy.photo-club-at-koganei.workers.dev/"; 
  // ↑ PC と違う Worker を後で camera-proxy に変更する（今は仮）

  let rawData = [];

  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
  } catch (err) {
    console.error("予約データ取得エラー:", err);
  }

  /**********************************************
   * 機材カラー
   **********************************************/
  const EQUIP_COLORS = {
    "Canon EOS 5D Mark III": "#b3d9ff",
    "Canon EOS R10": "#d0f0c0",
    "Nikon D3000": "#ffd6cc"
  };

  /**********************************************
   * 予約不可判定：借り始め日 = 今日 + 7日 以降だけ
   **********************************************/
  function isCameraStartAvailable(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const minStart = new Date(today);
    minStart.setDate(minStart.getDate() + 7);

    const target = new Date(dateStr);
    return target >= minStart;
  }

  /**********************************************
   * カレンダー構築
   **********************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    height: "auto",

    dayCellDidMount(info) {
      const dateStr = info.date.toISOString().split("T")[0];

      // その日を含む予約帯を集める
      const matches = rawData.filter(r => {
        if (!r.start || !r.end) return false;
        const start = new Date(r.start);
        const end = new Date(r.end);
        const d = new Date(dateStr);
        return d >= start && d <= end;
      });

      if (matches.length > 0) {
        // ひとまず1機材だけを表示（後で複数重ねる拡張も可能）
        const equip = matches[0].equip;
        const color = EQUIP_COLORS[equip] || "#e6e6e6";

        info.el.style.background = color;
        info.el.style.opacity = "0.9";
      }
    },

    dateClick(info) {
      openModal(info.dateStr);
    }
  });

  calendar.render();


  /**********************************************
   * モーダル（借りたい機材 ＋ 返却予定日）
   **********************************************/
  const modal = document.getElementById("cameraModal");
  const modalTitle = document.getElementById("modalTitle");
  const startDateSpan = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");
  const equipSelect = document.getElementById("equipSelect");
  const closeBtn = document.getElementById("closeModal");
  const submitBtn = document.getElementById("submitReserve");

  closeBtn.addEventListener("click", () => modal.style.display = "none");

  // モーダルを開く関数
  function openModal(dateStr) {

    if (!isCameraStartAvailable(dateStr)) {
      alert("予約は借り始め予定日の7日前までです。\nこの日は選択できません。");
      return;
    }

    modalTitle.textContent = `借り始め予定日：${dateStr}`;
    startDateSpan.textContent = dateStr;

    // 自動返却予定日（7日後）
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 7);
    endDateInput.value = d.toISOString().split("T")[0];

    modal.style.display = "flex";
  }


  /**********************************************
   * Googleフォームへプリフィルして遷移
   **********************************************/
  submitBtn.addEventListener("click", () => {

    const equip = equipSelect.value;
    const start = startDateSpan.textContent;
    const end = endDateInput.value;

    if (!equip) {
      alert("借りたい機材を選択してください");
      return;
    }

    const url =
      "https://docs.google.com/forms/d/e/1FAIpQLSfNVO0OilcqtDFXmj2FjauZ4fQX7_ZKO0xBdZIf6U9Cg53yMQ/viewform?usp=pp_url"
      + `&entry.389826105=${encodeURIComponent(equip)}`
      + `&entry.445112185=${encodeURIComponent(start)}`
      + `&entry.1310995013=${encodeURIComponent(end)}`;

    window.open(url, "_blank");
  });

});