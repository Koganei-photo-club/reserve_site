/**********************************************
 * 📷 カメラ貸出カレンダー（共通化版）
 **********************************************/

const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";
const CALENDAR_API = "https://calendar-proxy.photo-club-at-koganei.workers.dev/";

const {
  toDate, toYMD, $, showModal, hideModal,
  buildContinuousEvent, fetchReservations
} = CalendarUtil;

let APPLY_START = null;
let APPLY_END = null;
let APPLY_EQUIP = null;
let CALENDAR_TERMS = [];
let CAMPUS_CLOSED = [];

document.addEventListener("DOMContentLoaded", async function () {

  // ===== 学年暦読み込み =====
  try {
    const now = new Date();
    const ay = now.getMonth() < 3
      ? now.getFullYear() -1
      : now.getFullYear();
    const year = "AY" + ay;
    const res = await fetch(`${CALENDAR_API}?year=${year}`);
    const data = await res.json();

    CALENDAR_TERMS = data.rows || [];
    CAMPUS_CLOSED = CALENDAR_TERMS.filter(t => t.type === "CAMPUS_CLOSED");

    console.log("CALENDAR_TERMS:", CALENDAR_TERMS);
    console.log("CAMPUS_CLOSED:", CAMPUS_CLOSED);
  } catch (e) {
    console.error("学年暦取得失敗", e);
  }

  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) alert("⚠ 予約するにはログインが必要です！");

  const calendarEl = $("calendar");
  const returnSelect = $("returnSelect");

  /***** 📌 カメラ一覧読み込み *****/
  let CAMERA_LIST = [];
  let COLOR_MAP = {};
  try {
    const res = await fetch(CAMERA_DB_URL);
    CAMERA_LIST = await res.json();
    const colors = ["#007bff", "#28a745", "#ff9800", "#9c27b0", "#3f51b5", "#ff5722"];
    CAMERA_LIST.forEach((c, i) => COLOR_MAP[c.name] = colors[i % colors.length]);
  } catch {}

  /***** 📌 予約データ読み込み *****/
  const reservations = await fetchReservations(API_URL);

  function isBooked(date, equip) {
    const t = toDate(date);
    return reservations.some(r => {
      if (r.equip !== equip) return false;
      const s = toDate(r.start);
      const e = toDate(r.end);
      const ee = new Date(e);
      ee.setDate(ee.getDate() + 1);
      return s <= t && t < ee;
    });
  }

  function getEndDates(start, equip) {
    const s = toDate(start);
    const maxDays = getMaxDaysByStartDate(start);

    // 次の予約日を探す（既存ロジック維持）
    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ee = toDate(r.end);
      ee.setDate(ee.getDate() +1);
      if (ee > s && (!nearest || ee < nearest)) nearest = ee;
    });

    const hardLimit = nearest
      ? new Date(nearest - 86400000)
      : new Date(s.getTime() + (maxDays -1) * 86400000);

    const list =[];
    let cur = new Date(s);

    while (cur <= hardLimit) {
      // 🚫 貸出日・返却日そのものが入構禁止はNG
      if (!isCampusClosed(cur)) {
        list.push(toYMD(cur));
      }
      cur.setDate(cur.getDate() +1);
    }

    return list;
  }

  /* 日付正規化関数 */
  function normalizeDate(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /* 入構禁止日チェック関数 */
  function isCampusClosed(date) {
    const target = normalizeDate(date);
    return CAMPUS_CLOSED.some(t => {
      const s = normalizeDate(t.start_date);
      const e = normalizeDate(t.end_date);
      return s <= target && target <= e;
    });
  }

  /* 最大日数を学年暦から取得 */
  function getMaxDaysByStartDate(startDate) {
    const d = normalizeDate(startDate);

    const term = CALENDAR_TERMS.find(t => {
      if (!t.start_date || !t.end_date) return false;
      const s = normalizeDate(t.start_date);
      const e = normalizeDate(t.end_date);
      return s <= d && d <= e;
    });

    return term ? Number(term.max_days) : 7;
  }

  /* ===== 入構禁止日を背景イベントに変換 ===== */
  function buildCampusClosedEvents() {
    return CAMPUS_CLOSED.map(t => ({
      title: "入構禁止",
      start: t.start_date,
      // FullCalendarはend-exclusiveなので +1日
      end: toYMD(new Date(normalizeDate(t.end_date).getTime() + 86400000)),
      display: "background",
      allDay: true,
      backgroundColor: "rgba(178, 34, 34, 0.35)",
      overlap: false,

      extendedProps: {
        type: "CAMPUS_CLOSED"
      }
    }));
  }

  /***** 📌 FullCalendar描画 *****/
  const reservationEvents = reservations.map(r => {
    const ev = buildContinuousEvent(r);

    // 🔽 貸出状態に応じてタイトル変更
    if (!r.beforeChecked) {
      ev.title = `${r.equip}（準備中）`;
    } else if (r.beforeChecked && !r.afterChecked) {
      ev.title = `${r.equip}（貸出中）`;
    } else if (r.afterChecked) {
      ev.title = `${r.equip}（返却済）`;
    }

    ev.backgroundColor = COLOR_MAP[r.equip] ?? "#777";
    ev.textColor = "#fff";
    return ev;
  });

  const closedEvents = buildCampusClosedEvents();
  const events = [...reservationEvents, ...closedEvents];

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
      const clickedDate = normalizeDate(info.dateStr);

      // 入構禁止日はクリック不可
      if (isCampusClosed(clickedDate)) {
        alert("⚠︎ この日は大学入構禁止期間のため、貸出開始できません");
        return;
      }

      if (!user) {
        alert("ログインユーザーのみ予約できます");
        return;
      }
      const now = new Date();
      now.setDate(now.getDate() + 7);
      if (toDate(info.dateStr) < now) {
        alert("借り始めは7日後以降です");
        return;
      }
      openDayModal(info.dateStr);
    },
    eventClick(info) {
      if (info.event.extendedProps?.type === "CAMPUS_CLOSED") {
        return;
      }
      if (!user) {
        alert("ログインユーザーのみキャンセル可能です");
        return;
      }
      const r = info.event.extendedProps;
      openCancelModal(r.equip, r.start, r.code);
    }
  });
  calendar.render();

  /* 凡例を作成 */
  function renderCalendarLegend() {
    const legend = document.getElementById("calendar-legend") ;
    if (!legend) return;

    legend.innerHTML = `
      <div class="legend-item">
        <span class="legend-box" style="background:#777;"></span>
        <span>予約済み（貸出中・準備中）</span>
      </div>
      
      <div class="legend-item">
        <span class="legend-box" style="background:rgba(178,34,34,0.35);"></span>
        <span>入構禁止日（貸出不可）</span>
      </div>
      `;
  }
  renderCalendarLegend();
  /***** 📌 モーダル操作 *****/
  function openDayModal(dateStr) {
    if (isCampusClosed(toDate(dateStr))) {
      alert("⚠︎ この日は貸出開始日にできません。");
      return;
    }

    dayTitle.textContent = `${dateStr} の予約`;

    const camWrap = $("cameraButtons");
    camWrap.innerHTML = "";
    CAMERA_LIST.forEach(c => {
      const b = document.createElement("button");
      b.className = "camera-btn";
      if (isBooked(dateStr, c.name)) {
        b.textContent = `${c.name}（予約不可）`;
        b.disabled = true;
      } else {
        b.textContent = `${c.name} を予約`;
        b.onclick = () => openReturnModal(dateStr, c.name);
      }
      camWrap.appendChild(b);
    });
    showModal("dayModal");
  }
  $("dayClose").onclick = () => hideModal("dayModal");

  function openReturnModal(start, equip) {
    APPLY_START = start;
    APPLY_EQUIP = equip;
    returnSelect.innerHTML = "";
    const dates = getEndDates(start, equip);

    if (dates.length === 0) {
      alert(
        "⚠︎ この期間は返却日を設定できません。\n" +
        "・入構禁止期間のみになる\n" +
        "・最大貸出日数を超える\n" +
        "・次の予約と重なる\n\n" +
        "別の日付を選択してください。"
      );
      return;
    }
    dates.forEach(d => {
      returnSelect.insertAdjacentHTML("beforeend", `<option>${d}</option>`);
    });
    hideModal("dayModal");
    showModal("returnModal");
  }
  $("closeReturn").onclick = () => hideModal("returnModal");

  $("goForm").onclick = () => {
    APPLY_END = returnSelect.value;
    hideModal("returnModal");
    showModal("applyModal");

    $("applyEquip").textContent = APPLY_EQUIP;
    $("applyPeriod").textContent = `${APPLY_START} 〜 ${APPLY_END}`;
    $("applyUser").textContent = user.name;
    $("applyUserLine").textContent = user.lineName;
    $("applyMessage").textContent = "";
  };

  $("applyClose").onclick = () => hideModal("applyModal");

  $("applySend").onclick = async () => {

    $("applyMessage").textContent = "⏳予約申請中…";

    const payload = {
      mode: "reserve",
      email: user.email,
      name: user.name,
      lineName: user.lineName,
      equip: APPLY_EQUIP,
      start: APPLY_START,
      end: APPLY_END
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json().catch(() => null);

      if (result?.result === "success") {
        $("applyMessage").textContent = "✔ 予約完了！";
        // モーダルを閉じる
        hideModal("applyModal");

        // リロードしてカレンダーを更新
        setTimeout(() => location.reload(), 800);
      } else {
        $("applyMessage").textContent = "⚠ エラー";
      }
    } catch (e) {
      console.error(e);
      $("applyMessage").textContent = "⚠ 通信エラーが発生しました";
    }
  };

  function openCancelModal(equip, start, code) {
    $("cancelTarget").textContent = `${equip} / ${start}`;
    $("cancelMessage").textContent = "";
    showModal("cancelModal");
    $("cancelSend").onclick = () => cancelSend(equip, start, code);
  }
  $("cancelClose").onclick = () => hideModal("cancelModal");

  async function cancelSend(equip, start, code) {
    const userCode = $("cancelCode").value.trim();
    if (!userCode) return $("cancelMessage").textContent = "❌ コードを入力";
    if (userCode !== code) return $("cancelMessage").textContent = "❌ コードが違います";

    $("cancelMessage").textContent = "⏳キャンセル申請中…";

    const payload = {
      mode: "cancel",
      email: user.email,
      equip,
      start,
      code
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json().catch(() => null);

    if (result?.result === "success") {
      $("cancelMessage").textContent = "✔ 完了！";
      setTimeout(() => location.reload(), 800);
    } else {
      $("cancelMessage").textContent = "⚠ エラー";
    }
  }

  /***** 返却日変更 *******/
  $("modifyClose").onclick = () => hideModal("modifyModal");
  // hideModal("modifyClose").onclick = () => hideModal("modifyModal");

  function openModifyModal(r, today) {
    showModal("modifyModal");
    modifyTargetEquip.textContent = `${r.equip} / ${r.start}〜${r.end}`;
    modifyNameEl.value = " ";
    modifyCodeEl.value = " ";
    modifyMsgEl.textContent = "";
    modifySelect.innerHTML = "";

    const candidates = getEndDatesForModify(r, today);
    if (candidates.length === 0) {
      alert("返却日を変更できる候補日がありません");
      return;
    }

    candidates.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      modifySelectEl.appendChild(opt);
    });

    showModal("modifyModal");

    modal("modifySend").onclick = async () => {
      const name = modifyNameEl.value.trim();
      const code = modifyCodeEl.value.trim();
      const newEnd = modifySelectEl.value;

      if(!name || !code) {
        modifyMsgEl.textContent = "❌ 名前とコードを入力してください";
        return;
      }

      const payload = {
        mode: "modify",
        name,
        equip: r.equip,
        start: r.start,
        code,
        newEnd
    };

    await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    modifyMsgEl.textContent = "✔ 返却日を変更しました！";
    setTimeout(() => location.reload(), 800);
    };
  }

});