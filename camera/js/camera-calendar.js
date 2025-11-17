/**********************************************
 * 📷 カメラ貸出カレンダー 完全版（2025/11 修正版）
 *  - Cloudflare Worker (camera-proxy) 経由で予約取得
 *  - 機材ごとに色分けされた貸出帯を表示
 *  - 日付クリック → カメラ選択 → 返却日選択 → Googleフォームにプリフィル
 *  - 帯クリック → キャンセル申請モーダル
 *  - 借り始めは「今日から 7日後 以降」だけ予約可
 **********************************************/

document.addEventListener("DOMContentLoaded", async function () {
  const calendarEl = document.getElementById("calendar");

  // 🔗 Cloudflare Worker（カメラ用）
  const apiUrl = "https://camera-proxy.photo-club-at-koganei.workers.dev/";

  // 🔧 カメラの種類
  const CAMERAS = [
    "Canon EOS 5D Mark III",
    "Canon EOS R10",
    "Nikon D3000"
  ];

  // 🔧 機材ごとの色
  const COLOR_MAP = {
    "Canon EOS 5D Mark III": "#007bff",
    "Canon EOS R10": "#28a745",
    "Nikon D3000": "#ff9800"
  };

  // 🔧 Googleフォーム（プリフィルURL）
  const FORM_BASE_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfNVO0OilcqtDFXmj2FjauZ4fQX7_ZKO0xBdZIf6U9Cg53yMQ/viewform?usp=pp_url";

  /****************************************
   * 📌 借り始め可能日のチェック
   ****************************************/
  function isCameraStartAvailable(dateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);

    const minStart = new Date(today);
    minStart.setDate(minStart.getDate() + 7);

    const target = new Date(dateStr + "T00:00:00");
    return target >= minStart;
  }

  /****************************************
   * 📥 予約データ取得
   ****************************************/
  let rawData = [];

  try {
    const res = await fetch(apiUrl);
    rawData = await res.json();
  } catch (err) {
    console.error("予約データ取得エラー:", err);
    rawData = [];
  }

  /****************************************
   * 📌 指定日がその機材の予約にかぶっているか
   ****************************************/
  function isCameraBookedAtDate(dateStr, equip) {
    const t = new Date(dateStr + "T00:00:00");

    return rawData.some(r => {
      if (r.equip !== equip) return false;
      if (!r.start || !r.end) return false;
      const s = new Date(r.start + "T00:00:00");
      const e = new Date(r.end + "T00:00:00");
      return s <= t && t <= e;
    });
  }

  /****************************************
   * 📌 返却日候補生成（最大7日・次予約前日まで）
   ****************************************/
  function getAvailableReturnDates(startDate, equipName) {

    const start = new Date(startDate + "T00:00:00");

    // 最大 7日間
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 6);

    // 次予約の開始日
    let nextStart = null;

    rawData.forEach(r => {
      if (r.equip !== equipName) return;

      const s = new Date(r.start + "T00:00:00");
      if (s > start) {
        if (!nextStart || s < nextStart) nextStart = s;
      }
    });

    let limit = maxEnd;

    if (nextStart) {
      const dayBefore = new Date(nextStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      if (dayBefore < limit) limit = dayBefore;
    }

    const result = [];
    let cur = new Date(start);

    while (cur <= limit) {
      result.push(cur.toISOString().slice(0,10));
      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  /****************************************
   * 📌 Googleフォームにプリフィルして開く
   ****************************************/
  function openReserveForm(startDate, equipName, endDate) {

    // 借り始め
    const sY = startDate.slice(0,4);
    const sM = startDate.slice(5,7);
    const sD = startDate.slice(8,10);

    // 返却予定日
    const rd = new Date(endDate + "T00:00:00");
    const rY = rd.getFullYear();
    const rM = rd.getMonth() + 1;
    const rD = rd.getDate();

    // 完全プリフィル URL
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
  }

  /****************************************
   * 📌 FullCalendar のイベント作成
   ****************************************/
  const events = rawData.map(r => {
    if (!r.start || !r.end) return null;

    return {
      title: `${r.equip} 貸出中`,
      start: r.start,
      end: (d => { d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })(new Date(r.end + "T00:00:00")),
      allDay: true,
      backgroundColor: COLOR_MAP[r.equip],
      borderColor: COLOR_MAP[r.equip],
      textColor: "#fff",
      extendedProps: {
        equip: r.equip,
        startDate: r.start,
        endDate: r.end
      }
    };
  }).filter(Boolean);

  /****************************************
   * 📅 カレンダー初期化
   ****************************************/
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events: events,

    dateClick(info) {
      const dateStr = info.dateStr;

      if (!isCameraStartAvailable(dateStr)) {
        alert("借り始め予定日は「今日から7日後以降」のみ選択できます。");
        return;
      }

      openDayModal(dateStr);
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
  const dayModal   = document.getElementById("dayModal");
  const dayTitle   = document.getElementById("dayTitle");
  const cameraBtns = document.getElementById("cameraButtons");
  const dayClose   = document.getElementById("dayClose");

  dayClose.onclick = () => dayModal.style.display = "none";

  function openDayModal(dateStr) {
    dayTitle.textContent = `${dateStr} から借り始め`;
    cameraBtns.innerHTML = "";

    CAMERAS.forEach(cam => {
      const booked = isCameraBookedAtDate(dateStr, cam);
      const btn = document.createElement("button");

      btn.className = "camera-btn";

      if (booked) {
        btn.textContent = `${cam} は貸出中`;
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.textContent = `${cam} を予約する`;
        btn.onclick = () => openReturnModal(dateStr, cam);
      }

      cameraBtns.appendChild(btn);
    });

    dayModal.style.display = "flex";
  }

  /****************************************
   * 📌 返却日選択モーダル
   ****************************************/
  const returnModal    = document.getElementById("returnModal");
  const returnInfo     = document.getElementById("returnInfo");
  const returnSelect   = document.getElementById("returnSelect");
  const goFormBtn      = document.getElementById("goForm");
  const closeReturnBtn = document.getElementById("closeReturn");

  closeReturnBtn.onclick = () => {
    returnModal.style.display = "none";
  };

  function openReturnModal(startDate, equipName) {

    const dates = getAvailableReturnDates(startDate, equipName);

    returnInfo.textContent =
      `${equipName}（借り始め：${startDate}）の返却予定日を選択`;

    returnSelect.innerHTML = "";
    dates.forEach(d => {
      const op = document.createElement("option");
      op.value = d;
      op.textContent = d;
      returnSelect.appendChild(op);
    });

    goFormBtn.onclick = () => {
      const endDate = returnSelect.value;
      openReserveForm(startDate, equipName, endDate);
    };

    returnModal.style.display = "flex";
  }

  /****************************************
   * ❌ キャンセル申請モーダル
   ****************************************/
  const cancelModal   = document.getElementById("cancelModal");
  const cancelTarget  = document.getElementById("cancelTarget");
  const cancelNameEl  = document.getElementById("cancelName");
  const cancelCodeEl  = document.getElementById("cancelCode");
  const cancelSendBtn = document.getElementById("cancelSend");
  const cancelCloseBtn= document.getElementById("cancelClose");
  const cancelMsgEl   = document.getElementById("cancelMessage");

  cancelCloseBtn.onclick = () => {
    cancelModal.style.display = "none";
  };

  let cancelState = { equip: "", start: "", end: "" };

  function openCancelModal(equip, start, end) {
    cancelState = { equip, start, end };
    cancelTarget.textContent = `${equip} / ${start}〜${end}`;
    cancelMsgEl.textContent = "";
    cancelNameEl.value = "";
    cancelCodeEl.value = "";
    cancelModal.style.display = "flex";
  }

  cancelSendBtn.onclick = async () => {
    const name = cancelNameEl.value.trim();
    const auth = cancelCodeEl.value.trim();

    if (!name || !auth) {
      cancelMsgEl.textContent = "⚠️ 氏名と認証番号を入力してください。";
      return;
    }

    const payload = {
      action: "cancel",
      equip: cancelState.equip,
      start: cancelState.start,
      end: cancelState.end,
      name: name,
      auth: auth
    };

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      cancelMsgEl.textContent = result.message;

      if (result.status === "success") {
        setTimeout(() => location.reload(), 1000);
      }

    } catch (err) {
      console.error(err);
      cancelMsgEl.textContent = "⚠️ 通信エラーが発生しました。";
    }
  };
});