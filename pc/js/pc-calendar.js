/**********************************************
 * 💻 PC予約カレンダー（共通化版）
 **********************************************/

const API_URL = "https://pc-proxy.photo-club-at-koganei.workers.dev/";
const {
  toDate, toYMD, $, showModal, hideModal,
  fetchReservations
} = CalendarUtil;

// 固定の時間枠
const TIME_SLOTS = [
  "10:50〜11:40", "11:40〜12:30",
  "13:20〜14:10", "14:10〜15:00",
  "15:10〜16:00", "16:00〜16:50",
  "17:00〜17:50", "17:50〜18:40"
];

document.addEventListener("DOMContentLoaded", async function () {

  const userJson = sessionStorage.getItem("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!user) alert("⚠ 予約にはログインが必要です");

  // 🎯 API 経由で予約を取得
  let reservations = await fetchReservations(API_URL);

  // 日付毎の予約数表示用
  const dailyCount = {};
  reservations.forEach(r => {
    const d = r.start;
    dailyCount[d] = (dailyCount[d] || 0) + 1;
  });

  /**********************************************
   * 📅 FullCalendar
   **********************************************/
  const calendar = new FullCalendar.Calendar($("#calendar"), {
    initialView: "dayGridMonth",
    locale: "ja",

    dayCellDidMount(info) {
      // 日別予約数に応じて色分け
      const d = info.date.toISOString().split("T")[0];
      const cnt = dailyCount[d] || 0;
      let bg = "#c8f7c5", mark = "◯";
      if (cnt >= 4) { bg = "#ffd6d6"; mark = "×"; }
      else if (cnt >= 2) { bg = "#ffe8b3"; mark = "△"; }

      info.el.style.background = bg;
      info.el.innerHTML += `<div class="pc-mark">${mark}</div>`;
    },

    dateClick(info) {
      if (!user) return alert("ログインが必要です");
      openDayModal(info.dateStr);
    }
  });

  calendar.render();


  /**********************************************
   * 🔹 PC：締切判定 (JST)
   **********************************************/
  function isSlotAvailable(date) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const d = new Date(date + "T00:00:00+09:00");
    return d > today; // 前日締切
  }


  /**********************************************
   * 🔹 日別モーダル
   **********************************************/
  const dayModal = $("#dayModal");
  const timeSlotsEl = $("#timeSlots");

  function openDayModal(date) {
    $("#dayTitle").textContent = `${date} の予約状況`;
    timeSlotsEl.innerHTML = "";

    const todays = reservations.filter(r => r.start === date);

    TIME_SLOTS.forEach(slot => {
      const reserved = todays.some(r => r.slot === slot);
      const available = isSlotAvailable(date);

      const btn = document.createElement("button");

      if (reserved) {
        btn.className = "slot booked";
        btn.textContent = `${slot}（予約済）`;
        btn.onclick = () => openCancelModal(date, slot);
      }
      else if (!available) {
        btn.className = "slot closed";
        btn.textContent = `${slot}（締切）`;
        btn.disabled = true;
      }
      else {
        btn.className = "slot free";
        btn.textContent = `${slot}（空き）`;
        btn.onclick = () => reserve(date, slot);
      }

      timeSlotsEl.appendChild(btn);
    });

    showModal("dayModal");
  }

  $("#dayClose").onclick = () => hideModal("dayModal");


  /**********************************************
   * 📌 予約
   **********************************************/
  async function reserve(date, slot) {
    if (!confirm(`${date} / ${slot} を予約しますか？`)) return;

    const payload = {
      mode: "reserve",
      email: user.email,
      name: user.name,
      lineName: user.lineName,
      start: date,
      slot
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(`予約完了！認証コード: ${data.code}`);
    location.reload();
  }


  /**********************************************
   * 📌 キャンセル
   **********************************************/
  const cancelModal = $("#cancelModal");

  function openCancelModal(date, slot) {
    $("#cancelTarget").textContent = `${date} / ${slot}`;
    $("#cancelCode").value = "";
    $("#cancelMessage").textContent = "";
    $("#cancelConfirm").onclick = () => cancel(date, slot);
    showModal("cancelModal");
  }

  $("#cancelClose").onclick = () => hideModal("cancelModal");

  async function cancel(date, slot) {
    const code = $("#cancelCode").value.trim();
    if (!code) return $("#cancelMessage").textContent = "❌ 認証コード入力";

    const payload = {
      mode: "cancel",
      email: user.email,
      start: date,
      slot,
      code
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result?.result === "success") {
      alert("キャンセル成功");
      location.reload();
    } else {
      $("#cancelMessage").textContent = "一致なし / エラー";
    }
  }

});