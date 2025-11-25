/**********************************************
 * 📷 カメラ貸出カレンダー（DB 連携版）
 *  - Google Sheets → GAS → JSON API でカメラ情報を取得
 *  - CAMERAS 配列を完全撤廃し、DB の内容に自動対応
 **********************************************/

function toLocalDate(yyyy_mm_dd) {
  const [y, m, d] = yyyy_mm_dd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // 🔗 Cloudflare Worker（予約データ用）
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  // 🔗 Google Sheets DB（あなたの API）
  const CAMERA_DB_URL =
    "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

  /****************************************
   * 📌 1. カメラ DB を取得
   ****************************************/
  let CAMERA_LIST = [];
  let COLOR_MAP = {};

  try {
    const camRes = await fetch(CAMERA_DB_URL);
    CAMERA_LIST = await camRes.json();

    // 動的に色を割り振る
    const colors = ["#007bff", "#28a745", "#ff9800", "#9c27b0", "#3f51b5", "#ff5722"];
    CAMERA_LIST.forEach((cam, i) => {
      COLOR_MAP[cam.name] = colors[i % colors.length];
    });

    console.log("📸 カメラ一覧:", CAMERA_LIST);
  } catch (err) {
    console.error("❌ カメラ DB の取得に失敗", err);
    CAMERA_LIST = [];
  }

  /****************************************
   * 📌 2. 予約データ取得
   ****************************************/
  let rawData = [];
  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
  } catch (err) {
    console.error("予約データ取得エラー:", err);
  }

  /****************************************
   * 📌 指定日が予約済みか？
   ****************************************/
  function isCameraBookedAtDate(dateStr, equipName) {
    const t = new Date(dateStr + "T00:00:00");

    return rawData.some(r => {
      if (r.equip !== equipName) return false;
      if (!r.start || !r.end) return false;

      const s = toLocalDate(r.start);
      const e = toLocalDate(r.end);

      return s <= t && t <= e;
    });
  }

  /****************************************
   * 📌 返却予定日の候補生成
   ****************************************/
  function getAvailableReturnDates(startDate, equipName) {
    const start = toLocalDate(startDate);

    const maxEnd = new Date(start);
    maxEnd.setDate(start.getDate() + 6);

    let nextStart = null;
    rawData.forEach(r => {
      if (r.equip !== equipName) return;
      const s = toLocalDate(r.start);
      if (s > start && (!nextStart || s < nextStart)) {
        nextStart = s;
      }
    });

    let limit = maxEnd;
    if (nextStart) {
      const before = new Date(nextStart);
      before.setDate(before.getDate() - 1);
      if (before < limit) limit = before;
    }

    const result = [];
    const cur = new Date(start);
    while (cur <= limit) {
      result.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  /****************************************
   * 📌 Googleフォームへプリフィルで遷移
   ****************************************/
  const FORM_BASE_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfNVO0OilcqtDFXmj2FjauZ4fQX7_ZKO0xBdZIf6U9Cg53yMQ/viewform?usp=pp_url";

  function openReserveForm(startDate, equipName, endDate) {
    const sY = startDate.slice(0, 4);
    const sM = startDate.slice(5, 7);
    const sD = startDate.slice(8, 10);

    const rd = new Date(endDate + "T00:00:00");
    const rY = rd.getFullYear();
    const rM = rd.getMonth() + 1;
    const rD = rd.getDate();

    const url =
      FORM_BASE_URL +
      `&entry.389826105=${encodeURIComponent(equipName)}` +
      `&entry.445112185_year=${sY}` +
      `&entry.445112185_month=${sM}` +
      `&entry.445112185_day=${sD}` +
      `&entry.1310995013_year=${rY}` +
      `&entry.1310995013_month=${rM}` +
      `&entry.1310995013_day=${rD}`;

    window.open(url, "_blank");
    setTimeout(() => location.reload(), 300);
  }

  /****************************************
   * 📌 FullCalendar イベント生成
   ****************************************/
  const events = rawData
    .map(r => {
      if (!r.start || !r.end) return null;

      const endPlus1 = new Date(r.end + "T00:00:00");
      endPlus1.setDate(endPlus1.getDate() + 1);

      return {
        title: `${r.equip} 貸出中`,
        start: r.start,
        end: endPlus1.toISOString().slice(0, 10),
        allDay: true,
        backgroundColor: COLOR_MAP[r.equip] || "#666",
        borderColor: COLOR_MAP[r.equip] || "#666",
        textColor: "#fff",
        extendedProps: {
          equip: r.equip,
          startDate: r.start,
          endDate: r.end
        }
      };
    })
    .filter(Boolean);

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const min = new Date();
      min.setDate(today.getDate() + 7);

      if (new Date(info.dateStr) < min) {
        alert("借り始めは「今日から7日後」以降です。");
        return;
      }

      openDayModal(info.dateStr);
    },
    eventClick(info) {
      const ext = info.event.extendedProps;
      openCancelModal(ext.equip, ext.startDate, ext.endDate);
    }
  });

  calendar.render();

  /****************************************
   * 📌 カメラ選択モーダル
   ****************************************/
  const dayModal = document.getElementById("dayModal");
  const dayTitle = document.getElementById("dayTitle");
  const cameraBtns = document.getElementById("cameraButtons");

  function openDayModal(dateStr) {
    console.log("🔥 openDayModal start", dateStr);
    console.log("👉 CAMERA_LIST:", CAMERA_LIST);
    console.log("👉 rawData:", rawData);
    CAMERA_LIST.forEach(c => {
      console.log(`機材名: [${c.name}]`);
    });

    rawData.forEach(r => {
      console.log(`予約データ equip: [${r.equip}]`);
    });

    dayTitle.textContent = `${dateStr} の貸出可能カメラ`;

    cameraBtns.innerHTML = "";

    CAMERA_LIST.forEach(cam => {
      const btn = document.createElement("button");
      btn.className = "camera-btn";

      const booked = isCameraBookedAtDate(dateStr, cam.name);

      if (booked) {
        btn.textContent = `${cam.name}（貸出中）`;
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.textContent = `${cam.name} を予約する`;
        btn.onclick = () => openReturnModal(dateStr, cam.name);
      }

      cameraBtns.appendChild(btn);
    });

    dayModal.style.display = "flex";
    dayModal.classList.add("show");
  }

  document.getElementById("dayClose").onclick = () => {
    dayModal.classList.remove("show");
    dayModal.style.display = "none";
  };

  /****************************************
   * 📌 返却日選択モーダル
   ****************************************/
  const returnModal = document.getElementById("returnModal");
  const returnInfo = document.getElementById("returnInfo");
  const returnSelect = document.getElementById("returnSelect");
  const goFormBtn = document.getElementById("goForm");

  function openReturnModal(startDate, equipName) {
    const dates = getAvailableReturnDates(startDate, equipName);

    returnInfo.textContent = `${equipName}（借り始め：${startDate}）の返却予定日：`;
    returnSelect.innerHTML = "";

    dates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      returnSelect.appendChild(opt);
    });

    goFormBtn.onclick = () => {
      const endDate = returnSelect.value;
      openReserveForm(startDate, equipName, endDate);
    };

    returnModal.style.display = "flex";
    returnModal.classList.add("show");
  }

  document.getElementById("closeReturn").onclick = () => {
    returnModal.classList.remove("show");
    returnModal.style.display = "none";
  };

  /****************************************
   * ❌ キャンセル申請モーダル
   ****************************************/
  const cancelModal = document.getElementById("cancelModal");
  const cancelTarget = document.getElementById("cancelTarget");
  const cancelName = document.getElementById("cancelName");
  const cancelCode = document.getElementById("cancelCode");
  const cancelMsg = document.getElementById("cancelMessage");

  function openCancelModal(equip, start, end) {
    cancelTarget.textContent = `${equip} / ${start}〜${end}`;
    cancelName.value = "";
    cancelCode.value = "";
    cancelMsg.textContent = "";
    cancelModal.style.display = "flex";
    cancelModal.classList.add("show");
  }

  document.getElementById("cancelClose").onclick = () => {
    cancelModal.classList.remove("show");
    cancelModal.style.display = "none";
  };

});