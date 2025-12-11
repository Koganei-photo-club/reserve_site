/**********************************************
 * 📷 カメラ貸出カレンダー（共通化版）
 **********************************************/

const API_URL = "https://camera-proxy.photo-club-at-koganei.workers.dev/";
const CAMERA_DB_URL =
  "https://script.google.com/macros/s/AKfycbyHEx_s2OigM_JCYkanCdf9NQU7mcGGHOUC__OPSBqTuA7TfA-cCrbskM-NrYIwflsT/exec";

const {
  toDate, toYMD, $, showModal, hideModal,
  buildContinuousEvent, fetchReservations
} = CalendarUtil;

let APPLY_START = null;
let APPLY_END = null;
let APPLY_EQUIP = null;

document.addEventListener("DOMContentLoaded", async function () {

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
    const max = new Date(s);
    max.setDate(max.getDate() + 6);

    let nearest = null;
    reservations.forEach(r => {
      if (r.equip !== equip) return;
      const ee = toDate(r.end);
      ee.setDate(ee.getDate() + 1);
      if (ee > s && (!nearest || ee < nearest)) nearest = ee;
    });

    const limit = nearest ? new Date(nearest - 86400000) : max;
    const arr = [];
    let cur = new Date(s);

    while (cur <= limit) {
      arr.push(toYMD(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }

  /***** 📌 FullCalendar描画 *****/
  const events = reservations.map(r => {
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

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",
    events,
    dateClick(info) {
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
      if (!user) {
        alert("ログインユーザーのみキャンセル可能です");
        return;
      }
      const r = info.event.extendedProps;
      openCancelModal(r.equip, r.start, r.code);
    }
  });
  calendar.render();

  /***** 📌 モーダル操作 *****/
  function openDayModal(dateStr) {
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
    getEndDates(start, equip).forEach(d => {
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
        setTimeout(() => location.reload(), 300);
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