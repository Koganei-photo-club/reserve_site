const CALENDAR_API = "https://calendar-proxy.photo-club-at-koganei.workers.dev/";

const yearSelect = document.getElementById("yearSelect");
const tableBox   = document.getElementById("calendar-table");
const addBtn     = document.getElementById("addTermBtn");

const modal      = document.getElementById("termModal");
const form       = document.getElementById("termForm");
const closeBtn   = document.getElementById("closeModalBtn");

const CampusClosedModal = document.getElementById("campusClosedModal");
const campusClosedForm = document.getElementById("campusClosedForm");
const closeCampusClosedBtn = document.getElementById("closeCampusClosedBtn");

const SINGLE_TERM_TYPES = [
  "SPR_Sem00",
  "SMR_Vac",
  "AUT_Sem01",
  "WTR_Vac",
  "AUT_Sem02",
  "SPR_Vac",
];

const MULTI_TERM_TYPE = "CAMPUS_CLOSED";

const TERM_LABELS = {
    SPR_Sem00: "春学期",
    SMR_Vac: "夏季休業",
    AUT_Sem01: "秋学期（年内）",
    WTR_Vac: "冬季休業（年末年始）",
    AUT_Sem02: "秋学期（年明け）",
    SPR_Vac: "春季休業",
    CAMPUS_CLOSED: "入構禁止期間"
};

let currentYear = null;

/* =========
   年度セレクト生成 ★追加
========= */
function getAcademicYear(date = new Date()) {
    const year = date.getFullYear();
    const month =date.getMonth() +1; // 1-12

    // 1~3月は前年度
    return month <= 3 ? year -1 : year;
}

function initYearSelect() {
  const baseYear = getAcademicYear();

  const START_OFFSET = -1;
  const END_OFFSET   = 3;

  yearSelect.innerHTML = "";

  for (let y = baseYear + START_OFFSET; y <= baseYear + END_OFFSET; y++) {
    const option = document.createElement("option");
    option.value = `AY${y}`;        // GAS 用
    option.textContent = `${y}年度`; // 表示用
    yearSelect.appendChild(option);
  }

  yearSelect.value = `AY${baseYear}`;
}

/* =========
   年度初期化（★ここに置く）
========= */
async function initYear(year) {
  const ok = confirm(
    `${year.replace("AY", "")}年度の学年暦を初期化しますか？\n` +
    `（初期データが作成されます）`
  );
  if (!ok) return;

  // 例：初期テンプレート（最低限）
  const templates = [
    { type: "SPR_Sem00", max_days: 7 },
    { type: "SMR_Vac",  max_days: 14 },
    { type: "AUT_Sem01", max_days: 7 },
    { type: "WTR_Vac",  max_days: 14 },
    { type: "AUT_Sem02", max_days: 7 },
    { type: "SPR_Vac",  max_days: 14 },
  ];

  for (const t of templates) {
    await fetch(CALENDAR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "upsert",
        year,
        type: t.type,
        start_date: "", // 仮（後で編集）
        end_date: "",
        max_days: t.max_days
      })
    });
  }

  alert("年度を初期化しました。日付を編集してください。");
  loadTerms(year);
}

/* =========
   初期化
========= */
document.addEventListener("DOMContentLoaded", () => {
  initYearSelect();
  currentYear = yearSelect.value;
  loadTerms(currentYear);
});

/* =========
   年度変更
========= */
yearSelect.addEventListener("change", () => {
  currentYear = yearSelect.value;
  // ★ ここで「切り替え中」状態にする
  document.body.classList.add("year-switching");
  loadTerms(currentYear);
});

/* =========
   一覧取得
========= */
async function loadTerms(year) {
  const res = await fetch(`${CALENDAR_API}?year=${year}`);
  const data = await res.json();

  if (data.result === "no-sheet") {
    document.getElementById("singleTermContainer").innerHTML =
      "<p>この年度は未初期化です。</p>";
    document.getElementById("campusClosedList").innerHTML = "";
    return;
  }

  const rows = data.rows || [];

  const singleTerms = rows.filter(r =>
    SINGLE_TERM_TYPES.includes(r.type)
  );

  const campusClosedTerms = rows.filter(r =>
    r.type === MULTI_TERM_TYPE
  );

  renderSingleTerms(singleTerms);
  renderCampusClosed(campusClosedTerms);

  document.body.classList.remove("year-switching");
}

function renderSingleTerms(terms) {
  const box = document.getElementById("singleTermContainer");

  if (terms.length === 0) {
    box.innerHTML = "<p>未設定です。</p>";
    return;
  }

  box.innerHTML = `
    <table class="reserve-table">
      <thead>
        <tr>
          <th>種別</th>
          <th>期間</th>
          <th>最大日数</th>
          <th>編集</th>
        </tr>
      </thead>
      <tbody>
        ${terms.map(t => `
          <tr>
            <td>${labelOf(t.type)}</td>
            <td>${format(t.start_date)} 〜 ${format(t.end_date)}</td>
            <td>${t.max_days}日</td>
            <td>
              <button class="edit-single" data-row='${JSON.stringify(t)}'>
                編集
              </button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  box.querySelectorAll(".edit-single").forEach(btn => {
    btn.onclick = () => openTermModal(JSON.parse(btn.dataset.row));
  });
}

function renderCampusClosed(terms) {
  const box = document.getElementById("campusClosedList");

  if (terms.length === 0) {
    box.innerHTML = "<p>入構禁止期間は未登録です。</p>";
    return;
  }

  box.innerHTML = terms.map(t => `
    <div class="campus-closed-card">
      <div>
        <strong>${format(t.start_date)} 〜 ${format(t.end_date)}</strong>
      </div>
      <div class="actions">
        <button class="edit-closed" data-row='${JSON.stringify(t)}'>編集</button>
        <button class="delete-closed" data-row='${JSON.stringify(t)}'>削除</button>
      </div>
    </div>
  `).join("");

  box.querySelectorAll(".edit-closed").forEach(btn => {
    btn.onclick = () => openCampusClosedModal(JSON.parse(btn.dataset.row));
  });

  box.querySelectorAll(".delete-closed").forEach(btn => {
    btn.onclick = () => deleteCampusClosed(JSON.parse(btn.dataset.row));
  });
}

function labelOf(type) {
  return TERM_LABELS[type] || type;
}

/* =========
   モーダル
========= */
addBtn.onclick = () => openCampusClosedModal(null);
closeBtn.onclick = closeModal;

function openModal(row) {
  form.reset();

  if (row) {
    form.type.value       = row.type;
    form.start_date.value = row.start_date.slice(0, 10);
    form.end_date.value   = row.end_date.slice(0, 10);
    form.max_days.value   = row.max_days;
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

function openCampusClosedModal(row) {
  campusClosedForm.reset();

  if (row) {
    campusClosedForm.start_date.value = row.start_date.slice(0, 10);
    campusClosedForm.end_date.value   = row.end_date.slice(0, 10);
    campusClosedForm.dataset.editing = "true";
    campusClosedForm.dataset.oldStart = row.start_date;
  } else {
    campusClosedForm.dataset.editing = "";
    campusClosedForm.dataset.oldStart = "";
  }

  campusClosedModal.classList.remove("hidden");
}

function closeCampusClosedModal() {
  campusClosedModal.classList.add("hidden");
}

closeCampusClosedBtn.onclick = closeCampusClosedModal;

/* =========
   保存
========= */
form.onsubmit = async e => {
  e.preventDefault();

  const payload = {
    mode: "upsert",
    year: currentYear,
    type: form.type.value,
    start_date: form.start_date.value,
    end_date: form.end_date.value,
    max_days: Number(form.max_days.value)
  };

  const res = await fetch(CALENDAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log("calendar upsert:", data);

  closeModal();
  loadTerms(currentYear);
};

campusClosedForm.onsubmit = async e => {
  e.preventDefault();

  const payload = {
    mode: "upsert",
    year: currentYear,
    type: "CAMPUS_CLOSED",
    start_date: campusClosedForm.start_date.value,
    end_date: campusClosedForm.end_date.value,
    max_days: ""   // GAS 側で無視される
  };

  await fetch(CALENDAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  closeCampusClosedModal();
  loadTerms(currentYear);
};

/* =========
    入構禁止期間削除
  ========= */
async function deleteCampusClosed(row) {
  if (!confirm("この入構禁止期間を削除しますか？")) return;

  alert("削除APIは Step3 で実装します");
}

/* =========
   util
========= */
function format(d) {
  return new Date(d).toLocaleDateString("ja-JP");
}