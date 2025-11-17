/**********************************************
 * 📷 カメラ貸出カレンダー 完全版
 *  - Cloudflare Worker (camera-proxy) 経由で予約取得
 *  - 機材ごとに色分けされた貸出帯を表示
 *  - 日付クリック → カメラ選択 → Googleフォームにプリフィル
 *  - 帯クリック → キャンセル申請モーダル → GAS で行削除
 *  - 借り始めは「今日から 7日後 以降」だけ予約可
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

  // 🔧 機材ごとの色
  const COLOR_MAP = {
    "Canon EOS 5D Mark III": "#007bff", // 青
    "Canon EOS R10":          "#28a745", // 緑
    "Nikon D3000":            "#ff9800"  // オレンジ
  };

  // ---返却日モーダル ---
  const returnModal    = document.getElementById("returnModal");
  const returnInfo     = document.getElementById("returnInfo");
  const returnSelect   = document.getElementById("returnSelect");
  const goFormBtn      = document.getElementById("goForm");
  const closeReturnBtn = document.getElementById("closeReturn");

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
   * 🧮 end（返却予定日）の翌日を返す
   *   FullCalendar の allDay イベントは end を含まないため
   ****************************************/
  function datePlusOne(str) {
    const d = new Date(str + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  /****************************************
   * 📌 特定の日付に、その機材の予約がかぶっているか？
   *   → 日クリック時にボタンをグレーアウトする用
   ****************************************/
  function isCameraBookedAtDate(dateStr, equipName) {
    const target = new Date(dateStr + "T00:00:00");

    return rawData.some(r => {
      if (r.equip !== equipName) return false;
      if (!r.start || !r.end) return false;

      const s = new Date(r.start + "T00:00:00");
      const e = new Date(r.end + "T00:00:00");
      return s <= target && target <= e;
    });
  }

  // ==============================
  // 返却予定日の候補生成
  // ==============================
  function getAvailableReturnDates(startDate, equipName) {
    const start = new Date(startDate + "T00:00:00");

    // 最大7日間(start含む → +6)
    const maxEnd = new Date(start);
    maxEnd.setDate(maxEnd.getDate() + 6);

    // 次の予約の start を探す
    let nextBookingStart = null;

    rawDate.forEach(r => {
      if (r.equip !== equipName) return;
      if (!r.start || !r.end) return;

      const s =new Date(r.start + "T00:00:00");
      if (s > start) {
        if (!nextBookingStart || s < nextBookingStart) {
          nextBookingStart = s;
        }
      }
    });

    let limitEnd = maxEnd;

    // 次の予約があるなら「前日」まで
    if (nextBookingStart) {
      const dayBefore = new Date(nextBookingStart);
      dayBefore.setDate(dayBefore.getDate() - 1);

      if (dayBefore < limitEnd) {
        limitEnd = dayBefore;
      }
    }

    // リスト作成
    const result = [];
    let cur = new Date(start);

    while (cur <= limitEnd) {
      result.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    return result;
  }

  // ==============================
  // 返却日選択モーダルを開く
  // ==============================
  function openReturnModal(startDate, equipName) {
    returnInfo.textContent =
      `${equipName} の返却予定日を選択してください（借り始め：${startDate}）`;

    returnSelect.innerHTML = "";

    const dates = getAvailableReturnDates(startDate, equipName);

    dates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      returnSelect.appendChild(opt);
    });

    returnModal.style.display = "flex";

    // 「申請フォームへ進む」
    goFormBtn.onclick = () => {
      const returnDate = returnSelect.value;
      openReserveForm(startDate, equipName, returnDate);
    };

    // 閉じる
    closeReturnBtn.onclick = () => {
      returnModal.style.display = "none";
    };
  }

  /****************************************
   * 📅 FullCalendar 用イベント配列に変換
   ****************************************/
  const events = [];

  rawData.forEach(r => {
    if (!r.start || !r.end || !r.equip) return;

    const color = COLOR_MAP[r.equip] || "#888888";

    events.push({
      title: `${r.equip} 貸出中`,
      start: r.start,                 // "YYYY-MM-DD"
      end: datePlusOne(r.end),        // 翌日
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      textColor: "#ffffff",
      // 後からキャンセルに使うための情報
      extendedProps: {
        equip: r.equip,
        startDate: r.start,
        endDate: r.end
      }
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

      if (!isCameraStartAvailable(dateStr)) {
        alert(
          "カメラの予約は、借り始め予定日の 1週間前までに行ってください。\n" +
          "本日から 7日以内の日付は、借り始めとして選択できません。"
        );
        return;
      }

      openDayModal(dateStr);
    },

    // 貸出帯クリック → キャンセル申請モーダル
    eventClick: function (info) {
      const ext = info.event.extendedProps;
      if (!ext || !ext.equip) return;

      openCancelModal(ext.equip, ext.startDate, ext.endDate);
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

    cameraButtons.innerHTML = "";

    CAMERAS.forEach(equipName => {
      const btn = document.createElement("button");
      const booked = isCameraBookedAtDate(dateStr, equipName);

      btn.textContent = booked
        ? `${equipName} はこの日付を含む期間は貸出中です`
        : `${equipName} を予約する`;

      btn.className = "camera-btn";
      if (booked) {
        btn.disabled = true;
        btn.classList.add("disabled");
      } else {
        btn.addEventListener("click", () => {
          openReturnModal(dateStr, equipName);
        });
      }

      cameraButtons.appendChild(btn);
    });

    dayModal.style.display = "flex";
  }

  /****************************************
   * 📝 Googleフォームをプリフィルして開く
   ****************************************/
  function openReserveForm(startDate, equipName, endDate) {
    const sY = startDate.slice(0, 4);
    const sM = startDate.slice(5, 7);
    const sD = startDate.slice(8, 10);

    const r = new Date(returnDate + "T00:00:00");
    const rY = r.getFullYear();
    const rM = r.getMonth() + 1;
    const rD = r.getDate();

    const url =
      FORM_BASE_URL +
      `&entry.389826105=${encodeURIComponent(equipName)}` +
      `&entry.445112185_year=${sY}` +
      `&entry.445112185_month=${sM}` +
      `&entry.445112185_day=${sD}`;
      `&entry.1310995013_year=${rY}` +
      `&entry.1310995013_month=${rM}` +
      `&entry.1310995013_day=${rD}`;

    window.open(url, "_blank");

    // const url =
    //   FORM_BASE_URL +
    //   `&entry.389826105=${encodeURIComponent(equipName)}` +      // 借りたい機材
    //   `&entry.445112185=${encodeURIComponent(startDate)}`;       // 借り始め予定日

    // window.open(url, "_blank");
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

  cancelCloseBtn.addEventListener("click", () => {
    cancelModal.style.display = "none";
  });

  let cancelState = { equip: "", start: "", end: "" };

  function openCancelModal(equip, start, end) {
    cancelState = { equip, start, end };

    cancelTarget.textContent = `${equip} / ${start} 〜 ${end}`;
    cancelNameEl.value = "";
    cancelCodeEl.value = "";
    cancelMsgEl.textContent = "";

    cancelModal.style.display = "flex";
  }

  cancelSendBtn.addEventListener("click", async () => {
    const name = cancelNameEl.value.trim();
    const auth = cancelCodeEl.value.trim();

    if (!name || !auth) {
      cancelMsgEl.textContent = "⚠️ 氏名と認証番号を入力してください。";
      return;
    }

    const payload = {
      action: "cancel",            // ← これだけで GAS が cancel と判定する
      equip: cancelState.equip,
      start: cancelState.start,
      end:   cancelState.end,
      name:  name,
      auth:  auth
    };

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      cancelMsgEl.textContent = result.message || "サーバーからの応答が不正です。";

      if (result.status === "success") {
        setTimeout(() => location.reload(), 1000);
      }

    } catch (err) {
      console.error(err);
      cancelMsgEl.textContent = "⚠️ 通信エラーが発生しました。";
    }
  });

  function openReturnModal(startDate, equipName) {
    const dates = getValidReturnDates(startDate, equipName);

    document.getElementById("returnInfo").textContent =
    `借り始め：${startDate}\n機材：${equipName}`;

    const sel = document.getElementById("returnSelect");
    sel.innerHTML = " ";
    dates.forEach(d => {
      const op = document.createElement("option");
      op.value = d;
      op.textContent = d;
      sel.appendChild(op);
    });

    openReturnModal.style.display = "flex";

    // 決定ボタン
    document.getElementById("goForm").onclick = ( ) => {
      openReserveForm(startDate, equipName, sel.value);
    };
  }
});