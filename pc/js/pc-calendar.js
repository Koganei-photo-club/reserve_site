/**********************************************
 * 💻 PC予約カレンダー（安定版復元）
 **********************************************/

const API_URL = "https://pc-proxy.photo-club-at-koganei.workers.dev/";
const { $, fetchReservations, showModal, hideModal } = CalendarUtil;

const TIME_SLOTS = [
  "10:50〜11:40", "11:40〜12:30",
  "13:20〜14:10", "14:10〜15:00",
  "15:10〜16:00", "16:00〜16:50",
  "17:00〜17:50", "17:50〜18:40"
];

document.addEventListener("DOMContentLoaded", async () => {

  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return console.error("❌ #calendar not found");

  const rawUser = sessionStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;

  if (!user) alert("⚠ ログインが必要です");

  let rows = await fetchReservations(API_URL);

  const countByDate = {};
  rows.forEach(r => {
    const d = r.start;
    countByDate[d] = (countByDate[d] || 0) + 1;
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "ja",

    dayCellDidMount(info) {
      const dateStr = info.date.toISOString().split("T")[0];
      const cnt = countByDate[dateStr] || 0;

      let color = "#c8f7c5", mark = "◯";
      if (cnt >= 4) { color = "#ffd6d6"; mark = "×"; }
      else if (cnt >= 2) { color = "#ffe8b3"; mark = "△"; }

      info.el.style.background = color;
      info.el.innerHTML += `<div class="pc-mark">${mark}</div>`;
    },

    dateClick(info) {
      if (!user) return alert("ログインが必要です");
      openDayModal(info.dateStr);
    }
  });

  calendar.render();


  // ────────────────────────────────────
  // 日別モーダル
  // ────────────────────────────────────
  function isSlotAvailable(date) {
    const d = new Date(date + "T00:00:00+09:00");
    const today = new Date();
    today.setHours(0,0,0,0);
    return d > today;
  }

  const timeSlotsEl = $("timeSlots");

  function openDayModal(date) {
    $("dayTitle").textContent = `${date} の予約状況`;
    timeSlotsEl.innerHTML = "";

    const todays = rows.filter(r => r.start === date);

    TIME_SLOTS.forEach(slot => {
      const btn = document.createElement("button");

      if (todays.some(r => r.slot === slot)) {
        btn.className = "slot booked";
        btn.textContent = `${slot}（予約済）`;
        btn.onclick = () => openCancelModal(date, slot);
      }
      else if (!isSlotAvailable(date)) {
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

  const dayCloseBtn = $("dayClose");
  if (dayCloseBtn) dayCloseBtn.onclick = () => hideModal("dayModal");


  // ────────────────────────────────────
  // 予約処理
  // ────────────────────────────────────
  async function reserve(date, slot) {
    if (!confirm(`${date} / ${slot} を予約しますか？`)) return;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "reserve",
        email: user.email,
        name: user.name,
        lineName: user.lineName,
        start: date,
        slot
      })
    });

    const data = await res.json();
    alert(`予約完了！認証コード: ${data.code}`);
    location.reload();
  }


  // ────────────────────────────────────
  // キャンセル処理
  // ────────────────────────────────────
  function openCancelModal(date, slot) {
    $("cancelTarget").textContent = `${date} / ${slot}`;
    $("cancelCode").value = "";
    $("cancelMessage").textContent = "";
    $("cancelConfirm").onclick = () => cancel(date, slot);
    showModal("cancelModal");
  }

  const cancelCloseBtn = $("cancelClose");
  if (cancelCloseBtn) cancelCloseBtn.onclick = () => hideModal("cancelModal");

  async function cancel(date, slot) {
    const code = $("cancelCode").value.trim();
    if (!code) return $("cancelMessage").textContent = "❌認証コード入力";

    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "cancel",
        email: user.email,
        start: date,
        slot,
        code
      })
    });

    const result = await res.json();
    if (result?.result === "success") {
      alert("キャンセル成功");
      location.reload();
    } else {
      $("cancelMessage").textContent = "一致なし / エラー";
    }
  }

});