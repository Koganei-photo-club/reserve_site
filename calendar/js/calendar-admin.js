const CALENDAR_API = "https://calendar-proxy.photo-club-at-koganei.workers.dev/";

const yearSelect = document.getElementById("yearSelect");
const tableBox   = document.getElementById("calendar-table");
const addBtn     = document.getElementById("addTermBtn");

const modal      = document.getElementById("termModal");
const form       = document.getElementById("termForm");
const closeBtn   = document.getElementById("closeModalBtn");

const TERM_LABELS = {
    SPR_Sem00: "春学期",
    SMR_Vac: "夏季休業",
    AUT_Sem01: "秋学期（年内）",
    WTR_Vac: "冬季休業（年末年始）",
    AUT_Sem02: "秋学期（年明け）",
    SPR_Vac: "春季休業",
};

let currentYear = null;

/* =========
   年度セレクト生成 ★追加
========= */
function initYearSelect() {
  const now = new Date();
  const baseYear = now.getFullYear();

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
  tableBox.textContent = "読み込み中…";

  const res = await fetch(`${CALENDAR_API}?year=${year}`);
  const data = await res.json();

  if (data.result === "no-sheet") {
    tableBox.innerHTML = `
      <div class="empty-state">
        <p><strong>${year.replace("AY", "")}年度</strong>の学年暦はまだ作成されていません。</p>
        <button id="initYearBtn" class="primary-btn">
          この年度を初期化する
        </button>
      </div>
    `;

    document.getElementById("initYearBtn").onclick = () => {
        initYear(year);
    };
    return;
  }

  if (!data.rows?.length) {
    tableBox.innerHTML = "<p>期間が登録されていません。</p>";
    return;
  }

  tableBox.innerHTML = `
  <div class="term-card-list">
    ${data.rows.map(r => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const start = r.start_date ? new Date(r.start_date) : null;
      const end = r.end_date ? new Date(r.end_date) : null;

      const isActive =
        start && end && 
        today >= start && 
        today <= end;

      const isUnset = !r.start_date || !r.end_date;
      return `
      <div class="term-card 
        ${isActive ? "term-card--active" : ""}
        ${isUnset ? "term-card--warning" : ""}
      ">
        
        ${isActive ? `
            <div class="term-badge term-badge--active">
              現在適用中
            </div>
            ` : ""}

        ${isUnset ? `
            <div class="term-alert">
              ⚠︎ 期間が設定されていません
            </div>
        ` : ""}
        <div class="term-card-header">
          <span class="term-type">
            ${TERM_LABELS[r.type] ?? r.type}
          </span>
          <span class="term-days ${isUnset ? "badge-warning" : ""}">
            ${r.max_days}日
          </span>
        </div>

        <div class="term-dates">
          <div>
            <small>開始</small>
            <span>${r.start_date ? format(r.start_date) : "未設定"}</span>
          </div>
          <div>
            <small>終了</small>
            <span>${r.end_date ? format(r.end_date) : "未設定"}</span>
          </div>
        </div>

        <button class="edit-btn" data-row='${JSON.stringify(r)}'>
          編集
        </button>
      </div>
      `;
    }).join("")}
  </div>
`;

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.onclick = () => openModal(JSON.parse(btn.dataset.row));
  });

  // ★ ここで解除
  document.body.classList.remove("year-switching");
}

/* =========
   モーダル
========= */
addBtn.onclick = () => openModal(null);
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

/* =========
   util
========= */
function format(d) {
  return new Date(d).toLocaleDateString("ja-JP");
}