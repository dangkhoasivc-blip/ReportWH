// ================================================================
// HỆ THỐNG BÁO CÁO KHO — SABECO
// Sidebar trái = danh sách báo cáo | Vùng phải = chi tiết báo cáo
// ================================================================

// ---------- Khai báo báo cáo ----------
// file      : tên file JSON dữ liệu
// arrayKey  : key chứa mảng dòng dữ liệu trong JSON
// prefix    : tiền tố tên file CSV khi export
const DB_BASE = 'https://bc-kho-default-rtdb.asia-southeast1.firebasedatabase.app/';

const REPORTS = [
  { id:'bc1', idx:'01', name:'Hàng Gửi C1',
    desc:'Dashboard hàng gửi C1 theo kho & Tcos (chọn ngày)',
    icon:'fa-truck-ramp-box', ready:true,
    file: DB_BASE + 'bc01_manifest.json', arrayKey:'tcosRows', prefix:'BC01_HangGuiC1',
    multiDate: true },
  { id:'bc2', idx:'02', name:'Hàng Gần Hết Hạn Sử Dụng',
    desc:'Mã hàng có % HSD còn lại cần theo dõi (QĐ49)',
    icon:'fa-hourglass-half', ready:true,
    file: DB_BASE + 'data.json', arrayKey:'shelfLife', prefix:'BC02_HangGanHetHan' },
  { id:'bc3', idx:'03', name:'Hàng Block',
    desc:'Hàng bị khoá không cho xuất (D: hư hỏng / R: bị từ chối)',
    icon:'fa-lock', ready:true,
    file: DB_BASE + 'data_hangblock.json', arrayKey:'hangBlock', prefix:'BC03_HangBlock' },
  { id:'bc4', idx:'04', name:'Thời Hạn Hợp Đồng',
    desc:'Theo dõi hạn hợp đồng dịch vụ theo kho (On-Going/NearExpiry/Expired)',
    icon:'fa-file-contract', ready:true,
    file: DB_BASE + 'data_hopdong.json', arrayKey:'hopDong', prefix:'BC04_ThoiHanHopDong' },
  { id:'bc5', idx:'05', name:'Báo Cáo 5', desc:'Chờ dữ liệu', icon:'fa-file-lines', ready:false },
  { id:'bc6', idx:'06', name:'Báo Cáo 6', desc:'Chờ dữ liệu', icon:'fa-file-lines', ready:false },
];

// Nhóm bộ lọc dùng chung cho các báo cáo có cùng cấu trúc cột
const FILTER_GROUPS = [
  { key:'khuVuc',    label:'Khu Vực',    icon:'fa-map-marker-alt' },
  { key:'maKho',     label:'Mã Kho',     icon:'fa-warehouse' },
  { key:'nhomHang',  label:'Nhóm Hàng',  icon:'fa-boxes-stacked' },
  { key:'dvt',       label:'ĐVT',        icon:'fa-ruler' },
  { key:'trangThai', label:'Trạng Thái', icon:'fa-circle-check' },
];

// ---------- State ----------
let CURRENT_REPORT = 'bc2';
const STORE  = {};   // {bc2: payload, bc3: payload}
const FSTATE = {};   // {bc2: {khuVuc:Set, ...}, ...}
const VIEW   = {};   // {bc2: {search, sortCol, sortDir, threshold}, ...}
const BC01_DATES = { manifest: null, current: null };  // {manifest: {dates:[], latest:''}, current: dateKey}
// Lọc theo Tên NPP (C1) — mục chi tiết mã hàng/hóa đơn thay cho "Chi Tiết Theo Kho"
const BC01_NPP = { selectedNpp: '', khoSearch: '', ages: new Set(['lt7', 'b7_14', 'b14_30', 'gt30']) };
const BC01_AGE_DEFS = [
  { key: 'lt7',    label: '&lt;7 ngày',    cls: 'age-lt7' },
  { key: 'b7_14',  label: '7-14 ngày',     cls: 'age-b7-14' },
  { key: 'b14_30', label: '14-30 ngày',    cls: 'age-b14-30' },
  { key: 'gt30',   label: '&gt;30 ngày',   cls: 'age-gt30' },
];
function bc01AgeBucket(days) {
  const d = days || 0;
  if (d < 7) return 'lt7';
  if (d < 14) return 'b7_14';
  if (d < 30) return 'b14_30';
  return 'gt30';
}
let FILTERED = [];   // dòng dữ liệu sau khi lọc của báo cáo đang xem
let OPEN_MENU = null;

const THRESHOLDS = [30, 40, 50, 55, 60, 70, 80, 90, 100];

function view() { return VIEW[CURRENT_REPORT]; }
function store() { return STORE[CURRENT_REPORT]; }
function reportCfg(id) { return REPORTS.find(r => r.id === (id || CURRENT_REPORT)); }
function rowsOf(id) {
  const cfg = reportCfg(id);
  const st = STORE[id || CURRENT_REPORT];
  return (st && cfg && st[cfg.arrayKey]) ? st[cfg.arrayKey] : [];
}
// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', async () => {
  renderReportNav();
  await loadAllData();
  switchReport('bc2');

  // Click ra ngoài -> đóng dropdown bộ lọc
  document.addEventListener('click', e => {
    if (OPEN_MENU && !e.target.closest('.fdrop')) closeAllMenus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllMenus();
  });
});

async function loadAllData() {
  for (const cfg of REPORTS.filter(r => r.ready)) {
    let json = null;
    try {
      const res = await fetch(cfg.file);
      if (res.ok) json = await res.json();
    } catch (err) {
      console.warn(`Không tải được ${cfg.file}:`, err);
    }

    // BC01 multiDate: load manifest, then load latest date's data
    if (cfg.id === 'bc1' && cfg.multiDate && json && json.dates) {
      BC01_DATES.manifest = json;
      BC01_DATES.current = json.latest;
      if (json.latest) {
        let dateFile = json.dates.find(d => d.dateKey === json.latest)?.file;
        if (dateFile) {
          // dateFile is e.g. "data/bc01/hangguic1_20260821.json"
          // We map it to Firebase DB URL
          const filename = dateFile.split('/').pop().replace('.json', '');
          dateFile = DB_BASE + 'bc01_' + filename + '.json';
          try {
            const r2 = await fetch(dateFile);
            if (r2.ok) json = await r2.json();
          } catch (e) { console.warn('Load BC01 date file error:', e); }
        }
      }
    }

    if (!json || (cfg.multiDate && !json.tcosRows)) json = emptyPayload(cfg);
    STORE[cfg.id] = json;

    // Bộ lọc: mặc định chọn tất cả
    FSTATE[cfg.id] = {};
    if (cfg.id === 'bc1') {
      // BC01: filter by tcos from detailRows
      const tcosList = [...new Set((json.detailRows || []).map(r => r.tcos).filter(Boolean))].sort();
      json.filters = { tcos: tcosList };
      FSTATE[cfg.id]['tcos'] = new Set(tcosList);
    } else {
      for (const g of FILTER_GROUPS) {
        FSTATE[cfg.id][g.key] = new Set(json.filters?.[g.key] || []);
      }
    }
    // View state riêng cho từng báo cáo
    VIEW[cfg.id] = {
      search: '', sortCol: null, sortDir: 'asc',
      threshold: 60,
      useThreshold: cfg.id === 'bc2',
    };
  }
}

function emptyPayload(cfg) {
  const p = {
    metadata: { lastUpdatedDate:'—', lastUpdatedTime:'—', reportDate:'—', totalRows:0 },
    filters: { khuVuc:[], maKho:[], nhomHang:[], dvt:[], trangThai:[] },
    _offline: true,
  };
  p[cfg.arrayKey] = [];
  return p;
}

// ================================================================
// SIDEBAR: DANH SÁCH BÁO CÁO
// ================================================================
function renderReportNav() {
  document.getElementById('report-nav').innerHTML = REPORTS.map(r => `
    <button class="rtab ${r.id === CURRENT_REPORT ? 'active' : ''} ${r.ready ? '' : 'soon'}"
            onclick="switchReport('${r.id}')" ${r.ready ? '' : 'disabled'}
            title="${esc(r.name)}">
      <span class="rnum">${r.idx}</span>
      <div class="flex-1 min-w-0">
        <div class="rname truncate">${esc(r.name)}</div>
        <div class="rsub truncate">${esc(r.desc)}</div>
      </div>
      <span class="rdot"></span>
    </button>`).join('');

  const ready = REPORTS.filter(r => r.ready).length;
  document.getElementById('report-count').textContent = `${ready}/${REPORTS.length} sẵn sàng`;
}

function switchReport(rid) {
  const cfg = reportCfg(rid);
  if (!cfg || !cfg.ready) return;
  CURRENT_REPORT = rid;
  closeAllMenus();
  renderReportNav();

  // Tiêu đề + metadata
  const st = store();
  const meta = st?.metadata || { reportDate: st?.reportDate, lastUpdatedDate: st?.generatedAt?.split(' ')[0] || '—', lastUpdatedTime: st?.generatedAt?.split(' ')[1] || '—' };
  document.getElementById('report-index').textContent = cfg.idx;
  document.getElementById('report-title').innerHTML =
    `<i class="fas ${cfg.icon} text-sabeco-gold"></i> ${esc(cfg.name)}`;
  document.getElementById('report-desc').textContent =
    `${cfg.desc}  •  Dữ liệu ngày ${meta.reportDate || '—'}`;
  document.getElementById('btn-export-label').textContent = `Xuất Data Thô (BC${cfg.idx})`;
  document.getElementById('update-date').textContent = meta.lastUpdatedDate || '—';
  document.getElementById('update-time').textContent = meta.lastUpdatedTime || '—';

  renderFilters();
  applyFilters();
  renderReport();
}

function renderReport() {
  if (CURRENT_REPORT === 'bc1') renderBC1();
  else if (CURRENT_REPORT === 'bc2') renderBC2();
  else if (CURRENT_REPORT === 'bc3') renderBC3();
  else if (CURRENT_REPORT === 'bc4') renderBC4();
  // Chip "N dòng hiển thị" cạnh tiêu đề
  const chip = document.getElementById('row-chip');
  if (chip) chip.innerHTML =
    `<i class="fas fa-table-list"></i> ${num(FILTERED.length)} dòng hiển thị`;
}

// ================================================================
// BỘ LỌC (dropdown, nằm trong vùng báo cáo)
// ================================================================
function renderFilters() {
  const st = store(), fs = FSTATE[CURRENT_REPORT];
  const html = FILTER_GROUPS.map(g => {
    const vals = st.filters?.[g.key] || [];
    if (!vals.length) return '';
    const n = fs[g.key].size, all = vals.length;
    const partial = n < all;
    return `
      <div class="fdrop">
        <button class="fbtn ${partial ? 'partial' : ''}" id="fbtn-${g.key}"
                onclick="toggleMenu('${g.key}', event)">
          <i class="fas ${g.icon} text-sabeco-gold"></i>
          <span>${g.label}</span>
          <span class="fcount">${n}/${all}</span>
          <i class="fas fa-chevron-down fcaret"></i>
        </button>
        <div class="fmenu" id="fmenu-${g.key}">
          <div class="fmenu-tools">
            <input class="fmenu-search" placeholder="Tìm ${g.label.toLowerCase()}..."
                   oninput="filterOptions('${g.key}', this.value)">
          </div>
          <div class="fmenu-tools">
            <a class="fmini" onclick="selectAllInGroup('${g.key}')">Chọn tất cả</a>
            <a class="fmini" onclick="deselectAllInGroup('${g.key}')">Bỏ chọn</a>
          </div>
          <div class="fmenu-body" id="fbody-${g.key}">
            ${vals.map(v => `
              <label class="fopt" data-val="${esc(v).toLowerCase()}">
                <input type="checkbox" ${fs[g.key].has(v) ? 'checked' : ''}
                       onchange="toggleFilterValue('${g.key}', this.dataset.raw)"
                       data-raw="${esc(v)}">
                <span title="${esc(v)}">${esc(v)}</span>
              </label>`).join('')}
          </div>
        </div>
      </div>`;
  }).join('');

  const rowCount = rowsOf().length;
  document.getElementById('filter-panel').innerHTML = html +
    `<span class="text-[11px] text-gray-400 ml-1">${rowCount.toLocaleString()} dòng gốc</span>`;
}

function toggleMenu(key, ev) {
  ev.stopPropagation();
  const el = document.getElementById(`fmenu-${key}`);
  const wasOpen = el.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) { el.classList.add('open'); OPEN_MENU = key; }
}

function closeAllMenus() {
  document.querySelectorAll('.fmenu.open').forEach(m => m.classList.remove('open'));
  OPEN_MENU = null;
}

function filterOptions(key, term) {
  const lc = term.trim().toLowerCase();
  document.querySelectorAll(`#fbody-${key} .fopt`).forEach(el => {
    el.style.display = el.dataset.val.includes(lc) ? '' : 'none';
  });
}

function refresh() { applyFilters(); renderReport(); }

function selectAllInGroup(key) {
  FSTATE[CURRENT_REPORT][key] = new Set(store().filters[key] || []);
  syncFilterUI(key); refresh();
}

function deselectAllInGroup(key) {
  FSTATE[CURRENT_REPORT][key].clear();
  syncFilterUI(key); refresh();
}

function toggleFilterValue(key, val) {
  const s = FSTATE[CURRENT_REPORT][key];
  s.has(val) ? s.delete(val) : s.add(val);
  syncFilterUI(key); refresh();
}

// Cập nhật checkbox + số đếm mà KHÔNG render lại (giữ dropdown đang mở)
function syncFilterUI(key) {
  const st = store(), s = FSTATE[CURRENT_REPORT][key];
  document.querySelectorAll(`#fbody-${key} input[type=checkbox]`).forEach(cb => {
    cb.checked = s.has(cb.dataset.raw);
  });
  const all = (st.filters?.[key] || []).length;
  const btn = document.getElementById(`fbtn-${key}`);
  if (btn) {
    const c = btn.querySelector('.fcount');
    if (c) c.textContent = `${s.size}/${all}`;
    btn.classList.toggle('partial', s.size < all);
  }
}

function resetAllFilters() {
  const st = store();
  for (const g of FILTER_GROUPS) {
    FSTATE[CURRENT_REPORT][g.key] = new Set(st.filters?.[g.key] || []);
  }
  const v = view();
  v.search = ''; v.sortCol = null; v.sortDir = 'asc'; v.threshold = 60;
  closeAllMenus();
  renderFilters(); refresh();
}

// ================================================================
// LỌC DỮ LIỆU
// ================================================================
function applyFilters() {
  if (CURRENT_REPORT === 'bc1') { FILTERED = store()?.detailRows || []; return; }
  const v = view(), fs = FSTATE[CURRENT_REPORT];
  let rows = rowsOf();

  for (const g of FILTER_GROUPS) {
    const sel = fs[g.key];
    // Chỉ lọc khi nhóm này thực sự có giá trị trong dữ liệu
    if ((store().filters?.[g.key] || []).length) {
      rows = rows.filter(r => sel.has(r[g.key]));
    }
  }

  if (v.useThreshold) rows = rows.filter(r => r.pctHSD < v.threshold);

  if (v.search) {
    const lc = v.search.toLowerCase();
    rows = rows.filter(r =>
      (r.maKho || '').toLowerCase().includes(lc) ||
      (r.maHang || '').toLowerCase().includes(lc) ||
      (r.tenHang || '').toLowerCase().includes(lc) ||
      (r.soLo || '').toLowerCase().includes(lc) ||
      (r.nguyenNhan || '').toLowerCase().includes(lc) ||
      (r.kho || '').toLowerCase().includes(lc) ||
      (r.hopDong || '').toLowerCase().includes(lc) ||
      (r.tenNCC || '').toLowerCase().includes(lc) ||
      (r.nhacPic || '').toLowerCase().includes(lc));
  }

  const v2 = view();
  if (v2.sortCol) {
    const c = v2.sortCol, dir = v2.sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let x = a[c], y = b[c];
      if (typeof x === 'string') x = x.toLowerCase();
      if (typeof y === 'string') y = y.toLowerCase();
      if (x === undefined || x === null) x = '';
      if (y === undefined || y === null) y = '';
      return x < y ? -dir : x > y ? dir : 0;
    });
  }

  FILTERED = rows;
}

function sortBy(col) {
  const v = view();
  if (v.sortCol === col) v.sortDir = v.sortDir === 'asc' ? 'desc' : 'asc';
  else { v.sortCol = col; v.sortDir = 'asc'; }
  refresh();
}

function setSearch(val) {
  view().search = val.trim();
  applyFilters();
  renderReport();
  // Giữ con trỏ trong ô tìm kiếm sau khi render lại bảng
  const inp = document.getElementById('quick-search');
  if (inp && typeof inp.focus === 'function') {
    inp.focus();
    if (typeof inp.setSelectionRange === 'function') {
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  }
}

function changeThreshold(val) { view().threshold = parseInt(val, 10); refresh(); }
// ================================================================
// HELPER DÙNG CHUNG
// ================================================================
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function num(n) { return (n || 0).toLocaleString('vi-VN'); }

function th(label, col, cls) {
  const v = view();
  const sorted = v.sortCol === col;
  const arrow = !sorted ? 'fa-sort' : (v.sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
  if (!col) return `<th class="${cls || ''}">${label}</th>`;
  return `<th class="sortable ${cls || ''} ${sorted ? 'sorted' : ''}" onclick="sortBy('${col}')">
            ${label} <i class="fas ${arrow} arrow"></i></th>`;
}

function kpi(icon, label, val, color) {
  const map = {
    red:    ['bg-red-50', 'border-red-200', 'text-red-600', 'text-red-700'],
    blue:   ['bg-blue-50', 'border-blue-200', 'text-blue-600', 'text-blue-700'],
    orange: ['bg-orange-50', 'border-orange-200', 'text-orange-600', 'text-orange-700'],
    green:  ['bg-emerald-50', 'border-emerald-200', 'text-emerald-600', 'text-emerald-700'],
    gray:   ['bg-gray-50', 'border-gray-200', 'text-gray-500', 'text-gray-700'],
  };
  const [bg, bd, ic, tx] = map[color] || map.gray;
  return `<div class="kpi ${bg} ${bd}">
    <i class="fas ${icon} ${ic}"></i>
    <span class="klabel">${label}</span>
    <span class="kval ${tx}">${val}</span>
  </div>`;
}

function searchBox(placeholder) {
  return `<input id="quick-search" type="text" placeholder="${placeholder}"
            oninput="setSearch(this.value)" value="${esc(view().search)}"
            class="px-3 py-1.5 border border-gray-300 rounded text-xs w-72 focus:border-sabeco-gold outline-none">`;
}

function offlineBanner() {
  if (!store()?._offline) return '';
  return `<div class="mb-3 px-3 py-2 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-800">
    <i class="fas fa-triangle-exclamation mr-1"></i>
    Đang mở bằng <code>file://</code> nên trình duyệt chặn đọc file JSON.
    Chạy <code class="font-mono font-bold">python -m http.server 8000</code> rồi mở
    <code class="font-mono font-bold">http://localhost:8000</code> để thấy dữ liệu thật.
  </div>`;
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" class="text-center text-gray-400 py-10">
    <i class="fas fa-inbox text-2xl mb-2 block"></i>${msg}</td></tr>`;
}

function pctPill(p) {
  let cls = 'pill-green';
  if (p < 30) cls = 'pill-red';
  else if (p < 45) cls = 'pill-orange';
  else if (p < 55) cls = 'pill-yellow';
  return `<span class="pill ${cls}">${(p || 0).toFixed(1)}%</span>`;
}

// ================================================================
// BC01 — HÀNG GỬI C1
// ================================================================
function renderBC1() {
  const st = store();
  const ov = st?.overall || {};
  const detail = (st?.detailRows || []).filter(r => {
    const fs = FSTATE['bc1'];
    if (fs?.tcos?.size && !fs.tcos.has(r.tcos)) return false;
    const v = VIEW['bc1'];
    if (v?.search) {
      const lc = v.search.toLowerCase();
      if (!((r.tcos||'').toLowerCase().includes(lc) ||
            (r.maKho||'').toLowerCase().includes(lc) ||
            (r.tenKho||'').toLowerCase().includes(lc))) return false;
    }
    return true;
  });
  FILTERED = detail;

  // Tcos filter for sidebar filter panel
  const tcosList = st?.filters?.tcos || [];
  const fs = FSTATE['bc1'];
  const tcosSel = fs?.tcos || new Set();
  const partial = tcosSel.size < tcosList.length;
  const tcosBtnHtml = tcosList.length ? `
    <div class="fdrop">
      <button class="fbtn ${partial ? 'partial' : ''}" id="fbtn-tcos"
              onclick="toggleMenuBC1('tcos', event)">
        <i class="fas fa-sitemap text-sabeco-gold"></i>
        <span>Tcos</span>
        <span class="fcount">${tcosSel.size}/${tcosList.length}</span>
        <i class="fas fa-chevron-down fcaret"></i>
      </button>
      <div class="fmenu" id="fmenu-tcos">
        <div class="fmenu-tools">
          <input class="fmenu-search" placeholder="Tìm tcos..."
                 oninput="filterOptionsBC1('tcos', this.value)">
        </div>
        <div class="fmenu-tools">
          <a class="fmini" onclick="selectAllBC1('tcos')">Chọn tất cả</a>
          <a class="fmini" onclick="deselectAllBC1('tcos')">Bỏ chọn</a>
        </div>
        <div class="fmenu-body" id="fbody-tcos">
          ${tcosList.map(v => `
            <label class="fopt" data-val="${esc(v).toLowerCase()}">
              <input type="checkbox" ${tcosSel.has(v) ? 'checked' : ''}
                     onchange="toggleBC1Filter('tcos', this.dataset.raw)"
                     data-raw="${esc(v)}">
              <span title="${esc(v)}">${esc(v)}</span>
            </label>`).join('')}
        </div>
      </div>
    </div>` : '';

  // Update filter panel
  document.getElementById('filter-panel').innerHTML = tcosBtnHtml +
    `<span class="text-[11px] text-gray-400 ml-1">${(st?.detailRows||[]).length.toLocaleString()} kho có hàng</span>`;

  const m4 = ov.m4 || 0, m5 = ov.m5 || 0;

  const dateOpts = (BC01_DATES.manifest?.dates || []).map(d => 
    `<option value="${d.dateKey}" ${d.dateKey === BC01_DATES.current ? 'selected' : ''}>
      ${d.reportDate} (${num(d.total)} két/thùng)
    </option>`).join('');

  document.getElementById('report-body').innerHTML = `
    <section class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      ${offlineBanner()}

      <!-- Chọn ngày báo cáo -->
      ${dateOpts ? `<div class="mb-3 flex items-center gap-3">
        <label class="text-xs font-bold text-sabeco-green flex items-center gap-1.5">
          <i class="fas fa-calendar-days text-sabeco-gold"></i> Ngày báo cáo:
        </label>
        <select onchange="switchBC01Date(this.value)"
                class="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold text-sabeco-green">
          ${dateOpts}
        </select>
        <span class="text-[11px] text-gray-500">${(BC01_DATES.manifest?.dates || []).length} ngày có sẵn</span>
      </div>` : ''}

      <!-- KPI tổng quan -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        ${kpi('fa-boxes-stacking', 'Tổng Két/Thùng Gửi', num(ov.total || 0), 'blue')}
        ${kpi('fa-clock', 'Ngày TB Gửi', (ov.avgDays||0) + ' ngày', 'green')}
        ${kpi('fa-circle-exclamation', 'HĐ Tồn T04 (cần xử lý)', num(m4), m4>0?'red':'gray')}
        ${kpi('fa-circle-exclamation', 'HĐ Tồn T05 (cần xử lý)', num(m5), m5>0?'orange':'gray')}
        <div class="ml-auto">${searchBox('Tìm tcos, mã kho, tên kho...')}</div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-3 gap-4 mb-5">
        <!-- Combo Chart: Tcos vs Ngày TB + Months -->
        <div class="col-span-2 bg-white rounded-lg border border-gray-200 p-4">
          <div class="text-xs font-bold text-sabeco-green mb-3 flex items-center gap-1.5">
            <i class="fas fa-chart-bar text-sabeco-gold"></i> Chi tiết Tcos — Tổng hàng gửi & Ngày gửi TB
          </div>
          <div style="height:280px"><canvas id="bc01-combo"></canvas></div>
        </div>
        <!-- Donut Chart: Hàng bán vs KM -->
        <div class="bg-white rounded-lg border border-gray-200 p-4">
          <div class="text-xs font-bold text-sabeco-green mb-3 flex items-center gap-1.5">
            <i class="fas fa-chart-pie text-sabeco-gold"></i> Tỷ trọng Hàng bán / Hàng KM
          </div>
          <div style="height:280px"><canvas id="bc01-donut"></canvas></div>
        </div>
      </div>

      <!-- Bảng tổng hợp theo Tcos -->
      <div class="mb-5">
        <div class="text-xs font-bold text-sabeco-green mb-2 flex items-center gap-1.5">
          <i class="fas fa-chart-bar text-sabeco-gold"></i> Tổng Hợp Theo Tcos
        </div>
        <div class="overflow-auto" style="max-height:260px;">
          <table class="tbl">
            <thead><tr>
              <th class="ctr">STT</th>
              ${th('Tcos', 'tcos')}
              ${th('Ngày TB', 'avgDays', 'ctr')}
              ${th('Tháng 04 🔴', 'm4', 'num')}
              ${th('Tháng 05 🔴', 'm5', 'num')}
              ${th('Tháng 06', 'm6', 'num')}
              ${th('Tháng 07', 'm7', 'num')}
              ${th('Tháng 08', 'm8', 'num')}
              ${th('Hàng Bán', 'hangBan', 'num')}
              ${th('Hàng KM', 'hangKm', 'num')}
              ${th('Tổng Tồn', 'total', 'num')}
            </tr></thead>
            <tbody>${renderTcosRows(st?.tcosRows || [])}</tbody>
            <tfoot><tr>
              <td colspan="2" style="text-align:left">TỔNG CỘNG</td>
              <td class="ctr font-mono font-bold">${ov.avgDays||0}</td>
              <td class="num font-bold" style="color:#b91c1c">${num(m4)}</td>
              <td class="num font-bold" style="color:#b91c1c">${num(m5)}</td>
              <td class="num font-bold">${num(ov.m6||0)}</td>
              <td class="num font-bold">${num(ov.m7||0)}</td>
              <td class="num font-bold">${num(ov.m8||0)}</td>
              <td class="num font-bold">${num(ov.hangBan||0)}</td>
              <td class="num font-bold">${num(ov.hangKm||0)}</td>
              <td class="num font-bold" style="background:#f1f5f9">${num(ov.total||0)}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>

      ${renderBC01NppSection(st)}
    </section>`;

  setTimeout(() => renderBC01Charts(), 50);
}

function renderBC01Charts() {
  const st = store();
  const tcos = st?.tcosRows || [];
  const ov = st?.overall || {};
  
  if (!tcos.length) return;

  const labels = tcos.map(r => r.tcos);
  const avgDaysData = tcos.map(r => r.avgDays || 0);
  const m4Data = tcos.map(r => r.m4 || 0);
  const m5Data = tcos.map(r => r.m5 || 0);
  const m6Data = tcos.map(r => r.m6 || 0);
  const m7Data = tcos.map(r => r.m7 || 0);
  const m8Data = tcos.map(r => r.m8 || 0);

  // Destroy old charts if exist
  if (window.bc01ComboChart) { window.bc01ComboChart.destroy(); window.bc01ComboChart = null; }
  if (window.bc01DonutChart) { window.bc01DonutChart.destroy(); window.bc01DonutChart = null; }

  // Register datalabels plugin
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

  // Combo Chart
  const ctx1 = document.getElementById('bc01-combo');
  if (ctx1) {
    window.bc01ComboChart = new Chart(ctx1, {
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Ngày TB gửi',
            data: avgDaysData,
            borderColor: '#0f172a',
            backgroundColor: '#0f172a',
            borderWidth: 2,
            yAxisID: 'y1',
            tension: 0.2,
            pointRadius: 4,
            pointBackgroundColor: '#0f172a',
            order: 0,
            datalabels: {
              display: true,
              align: function(ctx) { return ctx.dataIndex === labels.length-1 ? 'bottom' : 'top'; },
              anchor: 'center',
              offset: function(ctx) { return ctx.dataIndex === labels.length-1 ? 8 : 12; },
              color: '#ffffff',
              font: { weight: 'bold', size: 10 },
              formatter: (v) => v + ' ngày',
              backgroundColor: 'rgba(15,23,42,0.85)',
              borderRadius: 3,
              padding: 3
            }
          },
          { type:'bar', label:'Tháng 04', data: m4Data, backgroundColor:'#991b1b', stack:'Stack0', order:1,
            datalabels: { display: false } },
          { type:'bar', label:'Tháng 05', data: m5Data, backgroundColor:'#dc2626', stack:'Stack0', order:2,
            datalabels: { display: false } },
          { type:'bar', label:'Tháng 06', data: m6Data, backgroundColor:'#fbbf24', stack:'Stack0', order:3,
            datalabels: { display: false } },
          { type:'bar', label:'Tháng 07', data: m7Data, backgroundColor:'#3b82f6', stack:'Stack0', order:4,
            datalabels: { display: false } },
          { type:'bar', label:'Tháng 08', data: m8Data, backgroundColor:'#10b981', stack:'Stack0', order:5,
            datalabels: { display: false } }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toLocaleString() } }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } },
          y: { stacked: true, title: { display: true, text: 'Két/Thùng', font: { size: 10 } },
               ticks: { font: { size: 10 }, callback: (v) => (v/1000).toFixed(0)+'k' } },
          y1: { position: 'right', title: { display: true, text: 'Ngày TB', font: { size: 10 } },
                grid: { drawOnChartArea: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }

  // Donut Chart
  const ctx2 = document.getElementById('bc01-donut');
  if (ctx2) {
    const hBan = ov.hangBan || 0, hKm = ov.hangKm || 0;
    window.bc01DonutChart = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Hàng Bán', 'Hàng KM'],
        datasets: [{
          data: [hBan, hKm],
          backgroundColor: ['#3b82f6', '#f59e0b'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = ((ctx.parsed / (hBan + hKm)) * 100).toFixed(1);
                return ctx.label + ': ' + ctx.parsed.toLocaleString() + ' (' + pct + '%)';
              }
            }
          },
          datalabels: {
            display: true,
            color: '#fff',
            font: { weight: 'bold', size: 13 },
            formatter: (val, ctx) => {
              const tot = hBan + hKm;
              const pct = ((val / tot) * 100).toFixed(1);
              return (val/1000).toFixed(0) + 'k\n(' + pct + '%)';
            }
          }
        }
      }
    });
  }
}

function renderTcosRows(rows) {
  if (!rows.length) return emptyRow(11, 'Không có dữ liệu.');
  const maxOld = Math.max(...rows.map(r => Math.max(r.m4||0, r.m5||0)), 1);
  const maxNew = Math.max(...rows.map(r => Math.max(r.m6||0, r.m7||0, r.m8||0)), 1);
  function heatOld(v) {
    if (!v) return '';
    const a = (0.15 + Math.min(v/maxOld,1)*0.7).toFixed(2);
    return `style="background:rgba(220,38,38,${a}); color:${v/maxOld>0.5?'#fff':'#991b1b'};"`;
  }
  function heatNew(v) {
    if (!v) return '';
    const a = (0.1 + Math.min(v/maxNew,1)*0.45).toFixed(2);
    return `style="background:rgba(59,130,246,${a}); color:${v/maxNew>0.5?'#fff':'#1d4ed8'};"`;
  }
  return rows.map((r, i) => `<tr>
    <td class="c-stt">${i+1}</td>
    <td class="c-region font-bold">${esc(r.tcos)}</td>
    <td class="ctr font-mono">${r.avgDays||0}</td>
    <td class="num"><span class="hm-cell" ${heatOld(r.m4)}>${num(r.m4||0)}</span></td>
    <td class="num"><span class="hm-cell" ${heatOld(r.m5)}>${num(r.m5||0)}</span></td>
    <td class="num"><span class="hm-cell" ${heatNew(r.m6)}>${num(r.m6||0)}</span></td>
    <td class="num"><span class="hm-cell" ${heatNew(r.m7)}>${num(r.m7||0)}</span></td>
    <td class="num"><span class="hm-cell" ${heatNew(r.m8)}>${num(r.m8||0)}</span></td>
    <td class="num">${num(r.hangBan||0)}</td>
    <td class="num">${num(r.hangKm||0)}</td>
    <td class="num font-bold" style="background:#f1f5f9">${num(r.total||0)}</td>
  </tr>`).join('');
}

function renderDetailKhoRows(rows) {
  if (!rows.length) return emptyRow(10, 'Không có kho nào phù hợp.');
  return rows.map((r, i) => {
    const pct = r.pctVsTcos ? (r.pctVsTcos*100).toFixed(1)+'%' : '—';
    const overAge = r.avgAge > r.standard && r.standard > 0;
    return `<tr>
      <td class="c-stt">${i+1}</td>
      <td class="c-region">${esc(r.tcos)}</td>
      <td class="c-item">${esc(r.maKho)}</td>
      <td class="c-name">${esc(r.tenKho)}</td>
      <td class="ctr font-mono text-gray-500">${r.standard||'—'}</td>
      <td class="ctr font-mono font-bold ${overAge?'text-red-600':''}">${r.avgAge||'—'}</td>
      <td class="ctr text-gray-600">${r.soHD||0}</td>
      <td class="c-qty">${num(r.volume)}</td>
      <td class="num text-gray-500">${num(r.totalStockTcos||0)}</td>
      <td class="ctr font-mono text-xs ${r.pctVsTcos>0.5?'text-emerald-700 font-bold':''}">${pct}</td>
    </tr>`;
  }).join('');
}

// ================================================================
// BC01 — Lọc theo Tên NPP (C1): Mã Hàng & Số Lượng Còn Lại
// ================================================================
function bc01NppFilteredRows(st) {
  const all = st?.nppRows || [];
  const khoLc = (BC01_NPP.khoSearch || '').trim().toLowerCase();
  return all.filter(r => {
    if (BC01_NPP.selectedNpp && r.tenC1 !== BC01_NPP.selectedNpp) return false;
    if (khoLc && !(r.tenKho || '').toLowerCase().includes(khoLc)) return false;
    if (!BC01_NPP.ages.has(bc01AgeBucket(r.ageDays))) return false;
    return true;
  });
}

function renderBC01NppSection(st) {
  const nppList = [...new Set((st?.nppRows || []).map(r => r.tenC1).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const rows = bc01NppFilteredRows(st);
  const totalSL = rows.reduce((s, r) => s + (r.slConLai || 0), 0);

  const nppOpts = `<option value="">-- Tất cả NPP --</option>` +
    nppList.map(v => `<option value="${esc(v)}" ${v === BC01_NPP.selectedNpp ? 'selected' : ''}>${esc(v)}</option>`).join('');

  const ageChips = BC01_AGE_DEFS.map(a => `
    <label class="age-chip ${a.cls}">
      <input type="checkbox" ${BC01_NPP.ages.has(a.key) ? 'checked' : ''}
             onchange="toggleBC01Age('${a.key}')">
      <span>${a.label}</span>
    </label>`).join('');

  return `
    <div>
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <div class="text-xs font-bold text-sabeco-green flex items-center gap-1.5 whitespace-nowrap">
          <i class="fas fa-people-arrows text-sabeco-gold"></i>
          Lọc theo Tên NPP (C1) — Mã Hàng &amp; Số Lượng Còn Lại
        </div>
        <div class="flex items-center gap-2">
          <label class="text-[11px] font-bold text-red-600 flex items-center gap-1">
            <i class="fas fa-filter"></i> Chọn NPP:
          </label>
          <select onchange="setBC01Npp(this.value)"
                  class="px-2.5 py-1.5 border-2 border-red-300 rounded text-xs font-semibold text-gray-700 max-w-[260px]">
            ${nppOpts}
          </select>
        </div>
        <input type="text" placeholder="Lọc mã hàng..." value="${esc(BC01_NPP.khoSearch)}"
               oninput="setBC01KhoSearch(this.value)"
               class="px-3 py-1.5 border border-gray-300 rounded text-xs w-52 focus:border-sabeco-gold outline-none">
        <div class="ml-auto flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold text-gray-400 uppercase">Chú thích:</span>
          ${ageChips}
        </div>
      </div>
      <div class="overflow-auto" style="max-height:360px;">
        <table class="tbl">
          <thead><tr>
            <th class="ctr">STT</th>
            <th>Mã Hàng</th>
            <th>Tên Kho</th>
            <th>Tên NPP</th>
            <th>Số Hóa Đơn</th>
            <th class="ctr">Ngày Ra HĐ</th>
            <th class="ctr">Tháng</th>
            <th class="num">Số Lượng Còn Lại</th>
          </tr></thead>
          <tbody>${renderBC01NppRows(rows)}</tbody>
          <tfoot><tr>
            <td colspan="7" style="text-align:left">TỔNG</td>
            <td class="num font-bold">${num(totalSL)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
}

// Trích tháng (MM/YYYY) từ chuỗi "DD/MM/YYYY"
function bc01MonthOf(ngayHD) {
  if (!ngayHD) return '—';
  const parts = String(ngayHD).split('/');
  if (parts.length !== 3) return '—';
  return `${parts[1]}/${parts[2]}`;
}

function renderBC01NppRows(rows) {
  if (!rows.length) return emptyRow(8, 'Không có mã hàng nào phù hợp.');
  return rows.map((r, i) => {
    const bucket = bc01AgeBucket(r.ageDays);
    const clsMap = { lt7:'age-lt7', b7_14:'age-b7-14', b14_30:'age-b14-30', gt30:'age-gt30' };
    return `<tr class="${clsMap[bucket]}">
      <td class="c-stt">${i+1}</td>
      <td class="c-item font-bold">${esc(r.maHang)}</td>
      <td class="c-name">${esc(r.tenKho)}</td>
      <td class="c-name">${esc(r.tenC1)}</td>
      <td class="font-mono text-xs">${esc(r.soHD)}</td>
      <td class="ctr font-mono">${esc(r.ngayHD)}</td>
      <td class="ctr font-mono font-bold">${bc01MonthOf(r.ngayHD)}</td>
      <td class="num font-bold">${num(r.slConLai)}</td>
    </tr>`;
  }).join('');
}

function setBC01Npp(val) { BC01_NPP.selectedNpp = val; renderBC1(); }
function setBC01KhoSearch(val) {
  BC01_NPP.khoSearch = val;
  const st = store();
  const rows = bc01NppFilteredRows(st);
  document.querySelector('#report-body tbody').innerHTML = renderBC01NppRows(rows);
  const totalSL = rows.reduce((s, r) => s + (r.slConLai || 0), 0);
  const tfootCell = document.querySelector('#report-body tfoot td:last-child');
  if (tfootCell) tfootCell.textContent = num(totalSL);
  const inp = document.querySelector('#report-body input[type=text]');
  if (inp) { inp.focus(); if (inp.setSelectionRange) inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function toggleBC01Age(key) {
  BC01_NPP.ages.has(key) ? BC01_NPP.ages.delete(key) : BC01_NPP.ages.add(key);
  renderBC1();
}

// BC01-specific filter helpers
function toggleMenuBC1(key, ev) {
  ev.stopPropagation();
  const el = document.getElementById(`fmenu-${key}`);
  const wasOpen = el.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) { el.classList.add('open'); OPEN_MENU = key; }
}
function filterOptionsBC1(key, term) {
  const lc = term.trim().toLowerCase();
  document.querySelectorAll(`#fbody-${key} .fopt`).forEach(el => {
    el.style.display = el.dataset.val.includes(lc) ? '' : 'none';
  });
}
function selectAllBC1(key) {
  const st = store();
  FSTATE['bc1'][key] = new Set(st.filters?.[key] || []);
  renderBC1();
}
function deselectAllBC1(key) {
  FSTATE['bc1'][key].clear();
  renderBC1();
}
function toggleBC1Filter(key, val) {
  const s = FSTATE['bc1'][key];
  s.has(val) ? s.delete(val) : s.add(val);
  renderBC1();
}

// ================================================================
// BC02 — HÀNG GẦN HẾT HẠN SỬ DỤNG
// ================================================================
function renderBC2() {
  const canhBao = FILTERED.filter(r => r.canhBao === 1).length;
  const totalSL = FILTERED.reduce((s, r) => s + r.soLuong, 0);
  const v = view();

  const thOpts = THRESHOLDS.map(t =>
    `<option value="${t}" ${t === v.threshold ? 'selected' : ''}>&lt; ${t}%</option>`).join('');

  document.getElementById('report-body').innerHTML = `
    <section class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      ${offlineBanner()}
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        ${kpi('fa-triangle-exclamation', `Cảnh báo QĐ49 · mã hàng &lt; ${v.threshold}%`, num(canhBao), 'red')}
        ${kpi('fa-boxes', 'Tồn kho SL cần thủ kho theo dõi', num(totalSL), 'blue')}
        <div class="ml-auto flex items-center gap-2">
          <label class="text-xs font-bold text-gray-600">Ngưỡng % HSD:</label>
          <select onchange="changeThreshold(this.value)"
                  class="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold">${thOpts}</select>
        </div>
        ${searchBox('Tìm mã kho, mã hàng, tên hàng, số lô...')}
      </div>

      <div class="overflow-auto" style="max-height:520px;">
        <table class="tbl">
          <thead><tr>
            <th class="ctr">STT</th>
            ${th('Mã Kho', 'maKho')}
            ${th('Mã Hàng', 'maHang')}
            ${th('Tên Hàng', 'tenHang')}
            ${th('Số Lượng', 'soLuong', 'num')}
            ${th('NSX', 'nsxKey', 'ctr')}
            ${th('HSD', 'hsdKey', 'ctr')}
            ${th('Còn Lại', 'ngayConLai', 'ctr')}
            ${th('% HSD', 'pctHSD', 'ctr')}
            ${th('Khu Vực', 'khuVuc')}
            <th>Tên Kho</th>
            <th class="ctr">ĐVT</th>
            <th class="ctr">Trạng Thái</th>
            <th>Số Lô</th>
            <th>Vị Trí</th>
          </tr></thead>
          <tbody>${renderRowsBC2()}</tbody>
          <tfoot><tr><td colspan="15">
            TỔNG SỐ LƯỢNG CẦN KIỂM TRA THỰC TẾ: <span class="font-mono">${num(totalSL)}</span>
          </td></tr></tfoot>
        </table>
      </div>
    </section>`;
}

function renderRowsBC2() {
  if (!FILTERED.length) return emptyRow(15, 'Không có dữ liệu phù hợp với bộ lọc.');
  return FILTERED.map((r, i) => {
    let tt = 'badge-ok';
    if (r.trangThai === 'QA') tt = 'badge-qa';
    else if (r.trangThai === 'D') tt = 'badge-d';
    return `<tr>
      <td class="c-stt">${i + 1}</td>
      <td class="c-code">${esc(r.maKho)}</td>
      <td class="c-item">${esc(r.maHang)}</td>
      <td class="c-name">${esc(r.tenHang)}</td>
      <td class="c-qty">${num(r.soLuong)}</td>
      <td class="c-date">${esc(r.nsx)}</td>
      <td class="c-date">${esc(r.hsd)}</td>
      <td class="c-days">${num(r.ngayConLai)} ngày</td>
      <td class="ctr">${pctPill(r.pctHSD)}</td>
      <td class="c-region">${esc(r.khuVuc)}</td>
      <td class="c-wh">${esc(r.tenKho)}</td>
      <td class="c-unit">${esc(r.dvt)}</td>
      <td class="ctr"><span class="badge ${tt}">${esc(r.trangThai)}</span></td>
      <td class="c-lot">${esc(r.soLo)}</td>
      <td class="c-pos">${esc(r.viTri)}</td>
    </tr>`;
  }).join('');
}

// ================================================================
// BC03 — HÀNG BLOCK  (status IN ('D','R'))
// ================================================================
function renderBC3() {
  const nD = FILTERED.filter(r => r.trangThai === 'D').length;
  const nR = FILTERED.filter(r => r.trangThai === 'R').length;
  const totalSL = FILTERED.reduce((s, r) => s + r.soLuong, 0);
  const chuaCoKH = FILTERED.filter(r => !r.keHoach || /pending/i.test(r.keHoach)).length;

  document.getElementById('report-body').innerHTML = `
    <section class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      ${offlineBanner()}
      <div class="mb-3 px-3 py-2 rounded bg-sabeco-green-pale border border-sabeco-green/15 text-[11px] text-gray-700">
        <i class="fas fa-circle-info text-sabeco-green mr-1"></i>
        Hàng block = tồn kho có trạng thái <strong>D</strong> (Damaged — hư hỏng) hoặc
        <strong>R</strong> (Rejected — bị từ chối), bị khoá không cho xuất.
        Cột <strong>Nguyên Nhân Block</strong> và <strong>Kế Hoạch Clear</strong> nhập tay trên sheet
        <code class="font-mono">Dashboard</code> của file Excel.
      </div>

      <div class="flex items-center gap-3 mb-4 flex-wrap">
        ${kpi('fa-list-ol', 'Số Dòng Block', num(FILTERED.length), 'gray')}
        ${kpi('fa-boxes', 'Tổng Số Lượng', num(totalSL), 'blue')}
        ${kpi('fa-hammer', 'Hư Hỏng (D)', num(nD), 'red')}
        ${kpi('fa-ban', 'Bị Từ Chối (R)', num(nR), 'orange')}
        ${kpi('fa-hourglass-half', 'Chưa Có Kế Hoạch', num(chuaCoKH), 'green')}
        <div class="ml-auto">${searchBox('Tìm mã kho, mã hàng, số lô, nguyên nhân...')}</div>
      </div>

      <div class="overflow-auto" style="max-height:520px;">
        <table class="tbl">
          <thead><tr>
            <th class="ctr">STT</th>
            ${th('Khu Vực', 'khuVuc')}
            ${th('Mã Kho', 'maKho')}
            <th>Tên Kho</th>
            ${th('Mã Hàng', 'maHang')}
            ${th('Tên Hàng', 'tenHang')}
            ${th('Số Lượng', 'soLuong', 'num')}
            <th class="ctr">ĐVT</th>
            ${th('Nhóm', 'nhomHang', 'ctr')}
            ${th('Trạng Thái', 'trangThai', 'ctr')}
            ${th('Số Lô', 'soLo')}
            ${th('NSX', 'nsxKey', 'ctr')}
            ${th('HSD', 'hsdKey', 'ctr')}
            ${th('% HSD', 'pctHSD', 'ctr')}
            ${th('Ngày Block', 'ngayThayDoiKey', 'ctr')}
            <th>Nguyên Nhân Block</th>
            ${th('Kế Hoạch Clear', 'keHoach', 'ctr')}
          </tr></thead>
          <tbody>${renderRowsBC3()}</tbody>
          <tfoot><tr><td colspan="17">
            TỔNG SỐ LƯỢNG HÀNG BLOCK: <span class="font-mono">${num(totalSL)}</span>
          </td></tr></tfoot>
        </table>
      </div>
    </section>`;
}

function renderRowsBC3() {
  if (!FILTERED.length) return emptyRow(17, 'Không có dữ liệu phù hợp với bộ lọc.');
  return FILTERED.map((r, i) => {
    const ttCls = r.trangThai === 'D' ? 'badge-d' : 'badge-r';
    const nhCls = r.nhomHang === 'BB' ? 'badge-bb' : 'badge-tp';
    // Bao bì (BB) không có HSD -> hiển thị dấu gạch
    const hasHSD = r.nhomHang !== 'BB' && r.pctHSD > 0;
    const pending = !r.keHoach || /pending/i.test(r.keHoach);
    const khCell = !r.keHoach
      ? '<span class="text-gray-400">—</span>'
      : `<span class="badge ${pending ? 'badge-pending' : 'badge-plan'}">${esc(r.keHoach)}</span>`;

    const dash = '<span class="c-empty">—</span>';
    return `<tr>
      <td class="c-stt">${i + 1}</td>
      <td class="c-region">${esc(r.khuVuc)}</td>
      <td class="c-code">${esc(r.maKho)}</td>
      <td class="c-wh">${esc(r.tenKho)}</td>
      <td class="c-item">${esc(r.maHang)}</td>
      <td class="c-name">${esc(r.tenHang)}</td>
      <td class="c-qty">${num(r.soLuong)}</td>
      <td class="c-unit">${esc(r.dvt)}</td>
      <td class="ctr"><span class="badge ${nhCls}" title="${esc(r.nhomHangLabel)}">${esc(r.nhomHang)}</span></td>
      <td class="ctr"><span class="badge ${ttCls}" title="${esc(r.trangThaiLabel)}">${esc(r.trangThai)}</span></td>
      <td class="c-lot">${esc(r.soLo)}</td>
      <td class="c-date">${esc(r.nsx) || dash}</td>
      <td class="c-date">${esc(r.hsd) || dash}</td>
      <td class="ctr">${hasHSD ? pctPill(r.pctHSD) : dash}</td>
      <td class="c-date">${esc(r.ngayThayDoi)}</td>
      <td class="wrap-cell c-note">${esc(r.nguyenNhan) || '<span class="c-empty">Chưa nhập</span>'}</td>
      <td class="ctr">${khCell}</td>
    </tr>`;
  }).join('');
}

// ================================================================
// BC04 — THỜI HẠN HỢP ĐỒNG (On-Going / NearExpiry / Expired)
// ================================================================
function renderBC4() {
  const nOngoing = FILTERED.filter(r => r.trangThai === 'On-Going').length;
  const nNear = FILTERED.filter(r => r.trangThai === 'NearExpiry').length;
  const nExpired = FILTERED.filter(r => r.trangThai === 'Expired').length;
  const nUndef = FILTERED.filter(r => r.trangThai === '-').length;

  document.getElementById('report-body').innerHTML = `
    <section class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      ${offlineBanner()}
      <div class="mb-3 px-3 py-2 rounded bg-sabeco-green-pale border border-sabeco-green/15 text-[11px] text-gray-700">
        <i class="fas fa-circle-info text-sabeco-green mr-1"></i>
        Trạng thái và số ngày còn lại được tính sẵn trong Excel dựa theo ngày hiện tại (TODAY()).
        <strong>NearExpiry</strong> = còn ≤60 ngày, <strong>Expired</strong> = đã quá hạn,
        <strong>"-"</strong> = hợp đồng không xác định thời hạn cố định.
      </div>

      <div class="flex items-center gap-3 mb-4 flex-wrap">
        ${kpi('fa-list-ol', 'Tổng Hợp Đồng', num(FILTERED.length), 'gray')}
        ${kpi('fa-circle-check', 'Còn Hiệu Lực', num(nOngoing), 'green')}
        ${kpi('fa-triangle-exclamation', 'Gần Hết Hạn', num(nNear), 'orange')}
        ${kpi('fa-circle-xmark', 'Đã Hết Hạn', num(nExpired), 'red')}
        ${kpi('fa-question', 'Không Xác Định', num(nUndef), 'gray')}
        <div class="ml-auto">${searchBox('Tìm kho, hợp đồng, tên NCC, người phụ trách...')}</div>
      </div>

      <div class="overflow-auto" style="max-height:520px;">
        <table class="tbl">
          <thead><tr>
            <th class="ctr">STT</th>
            ${th('Khu Vực', 'khuVuc')}
            <th>Kho</th>
            <th>Hợp Đồng Dịch Vụ</th>
            <th>Tên NCC Dịch Vụ</th>
            <th class="ctr">Ngày Bắt Đầu</th>
            <th class="ctr">Ngày Hết Hạn</th>
            <th>Thời Hạn Còn Lại</th>
            ${th('Trạng Thái', 'trangThai', 'ctr')}
            <th>Người Phụ Trách</th>
            <th>Ghi Chú</th>
          </tr></thead>
          <tbody>${renderRowsBC4()}</tbody>
          <tfoot><tr><td colspan="11">
            TỔNG SỐ HỢP ĐỒNG ĐANG THEO DÕI: <span class="font-mono">${num(FILTERED.length)}</span>
          </td></tr></tfoot>
        </table>
      </div>
    </section>`;
}

function renderRowsBC4() {
  if (!FILTERED.length) return emptyRow(11, 'Không có dữ liệu phù hợp với bộ lọc.');
  const dash = '<span class="c-empty">—</span>';
  const badgeMap = { 'On-Going': 'badge-ok', 'NearExpiry': 'badge-r', 'Expired': 'badge-d', '-': 'badge-plan' };
  return FILTERED.map((r, i) => {
    const ngayBd = r.ngayBdMoi || r.ngayBdCu;
    const ngayHh = r.ngayHhMoi || r.ngayHhCu;
    const ttCls = badgeMap[r.trangThai] || 'badge-plan';
    const pic = r.nhacPic ? `${esc(r.nhacPic)}${r.email ? ` <span class="text-gray-400">(${esc(r.email)})</span>` : ''}` : dash;
    return `<tr>
      <td class="c-stt">${i + 1}</td>
      <td class="c-region">${esc(r.khuVuc)}</td>
      <td class="c-wh">${esc(r.kho)}</td>
      <td class="c-name">${esc(r.hopDong)}</td>
      <td class="c-name">${esc(r.tenNCC)}</td>
      <td class="c-date">${esc(ngayBd) || dash}</td>
      <td class="c-date">${esc(ngayHh) || dash}</td>
      <td class="c-days">${esc(r.thoiHan) || dash}</td>
      <td class="ctr"><span class="badge ${ttCls}">${esc(r.trangThaiLabel)}</span></td>
      <td class="wrap-cell c-note">${pic}</td>
      <td class="wrap-cell c-note">${esc(r.ghiChu) || dash}</td>
    </tr>`;
  }).join('');
}

// ================================================================
// EXPORT CSV
// ================================================================
const EXPORT_COLS = {
  bc1: [
    ['Tcos','tcos'], ['Mã Kho','maKho'], ['Tên Kho','tenKho'],
    ['Standard (ngày)','standard'], ['Ngày TB Gửi','avgAge'],
    ['Số HĐ','soHD'], ['Tồn C1 (két/thùng)','volume'],
    ['Tổng Tồn Kho Tcos','totalStockTcos'], ['% C1/Tổng Kho','pctVsTcos'],
  ],
  bc2: [
    ['Khu Vực','khuVuc'], ['Mã Kho','maKho'], ['Tên Kho','tenKho'],
    ['Mã Hàng','maHang'], ['Tên Hàng','tenHang'], ['ĐVT','dvt'],
    ['Nhóm Hàng','nhomHang'], ['Trạng Thái','trangThai'], ['Số Lô','soLo'],
    ['Vị Trí','viTri'], ['NSX','nsx'], ['HSD','hsd'],
    ['Số Lượng','soLuong'], ['Số Lượng PL','soLuongPL'], ['% HSD','pctHSD'],
    ['Ngày Còn Lại','ngayConLai'], ['Số Ngày HSD','ngayHSD'],
    ['Ngưỡng QĐ49','nguong'], ['Cảnh Báo','canhBao'],
  ],
  bc3: [
    ['Khu Vực','khuVuc'], ['Tên Đơn Vị','donVi'], ['Mã Kho','maKho'], ['Tên Kho','tenKho'],
    ['Mã Hàng','maHang'], ['Tên Hàng','tenHang'], ['ĐVT','dvt'],
    ['Nhóm Hàng','nhomHang'], ['Diễn Giải Nhóm','nhomHangLabel'],
    ['Trạng Thái','trangThai'], ['Diễn Giải Trạng Thái','trangThaiLabel'],
    ['Số Lô','soLo'], ['Ngày Block','ngayThayDoi'],
    ['NSX','nsx'], ['HSD','hsd'],
    ['Số Lượng','soLuong'], ['Số Lượng PL','soLuongPL'], ['% HSD','pctHSD'],
    ['Ngày Còn Lại','ngayConLai'], ['Số Ngày HSD','ngayHSD'],
    ['Nguyên Nhân Block','nguyenNhan'], ['Kế Hoạch Clear','keHoach'],
  ],
  bc4: [
    ['Khu Vực','khuVuc'], ['Kho','kho'], ['Hợp Đồng Dịch Vụ','hopDong'],
    ['Tên NCC Dịch Vụ','tenNCC'],
    ['Ngày BĐ (HĐ Cũ)','ngayBdCu'], ['Ngày Gia Hạn PLHĐ (Cũ)','ngayGhCu'], ['Ngày Hết Hạn (HĐ Cũ)','ngayHhCu'],
    ['Ngày BĐ (HĐ Mới)','ngayBdMoi'], ['Ngày Gia Hạn PLHĐ (Mới)','ngayGhMoi'], ['Ngày Hết Hạn (HĐ Mới)','ngayHhMoi'],
    ['Thời Hạn Còn Lại','thoiHan'], ['Trạng Thái','trangThaiLabel'],
    ['Ngày Làm Tờ Trình','ngayToTrinh'], ['Ghi Chú','ghiChu'],
    ['Người Phụ Trách','nhacPic'], ['Email','email'],
  ],
};

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCurrentReport() {
  const cfg = reportCfg();
  const cols = EXPORT_COLS[CURRENT_REPORT];
  if (!cols) { alert('Báo cáo này chưa hỗ trợ xuất dữ liệu.'); return; }
  if (!FILTERED.length) { alert('Không có dữ liệu để xuất.'); return; }

  const lines = [['STT', ...cols.map(c => c[0])].join(',')];
  FILTERED.forEach((r, i) => {
    lines.push([i + 1, ...cols.map(c => csvCell(r[c[1]]))].join(','));
  });

  const stamp = (store().metadata?.reportDate || '').replace(/\//g, '') ||
                new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cfg.prefix}_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Switch BC01 date
async function switchBC01Date(dateKey) {
  BC01_DATES.current = dateKey;
  const entry = BC01_DATES.manifest?.dates.find(d => d.dateKey === dateKey);
  if (!entry) return;
  try {
    const filename = entry.file.split('/').pop().replace('.json', '');
    const dateFile = DB_BASE + 'bc01_' + filename + '.json';
    const res = await fetch(dateFile);
    if (!res.ok) throw new Error('Fetch failed');
    const json = await res.json();
    STORE['bc1'] = json;
    renderBC1();
  } catch (err) {
    console.error('switchBC01Date error:', err);
    alert('Không tải được dữ liệu ngày ' + entry.reportDate);
  }
}

