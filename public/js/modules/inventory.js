// ============================================================
// modules/inventory.js – Inventory Section (Warehouses, Item Groups, Items)
// ============================================================

import { escapeHtml, debounce } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';
import { openModal, closeModal } from '../utils/modal.js';
import { onSectionChange, closeMobileSidebar } from '../core/navigation.js';
import { loadStats } from '../core/userStats.js';

let warehousesData = [];
let itemGroupsData = [];
let itemsData = [];
let deleteWhTargetId = null;

export function showInventoryOverview() {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = '';
  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');
}

export function openInventorySubView(subKey) {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = 'none';

  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');

  const subView = document.getElementById('inventory-sub-' + subKey);
  if (subView) {
    subView.style.display = '';

    if (subKey === 'warehouses') loadWarehouses();
    else if (subKey === 'items-groups') loadItemGroups();
    else if (subKey === 'items') loadItems();
    else if (subKey === 'adjustments-up') loadAdjustmentsUp();
  }
}

// ── WAREHOUSES CRUD ───────────────────────────────────────

export async function loadWarehouses(search = '') {
  const warehousesTableBody = document.getElementById('warehousesTableBody');
  if (!warehousesTableBody) return;
  warehousesTableBody.innerHTML = '<tr><td colspan="4" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    const res = await fetch('/api/warehouses');
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    warehousesData = json.data || [];
    let filtered = warehousesData;
    if (search) {
      const q = search.toLowerCase();
      filtered = warehousesData.filter(w =>
        (w.cf_id && String(w.cf_id).toLowerCase().includes(q)) ||
        (w.cf_t1 && w.cf_t1.toLowerCase().includes(q)) ||
        (w.cf_t2 && w.cf_t2.toLowerCase().includes(q)) ||
        (w.code && w.code.toLowerCase().includes(q)) ||
        (w.name && w.name.toLowerCase().includes(q))
      );
    }
    renderWarehousesTable(filtered);
  } catch (err) {
    console.error('Load warehouses error:', err);
    warehousesTableBody.innerHTML = '<tr><td colspan="4" class="table-empty">خطأ في تحميل بيانات المستودعات</td></tr>';
  }
}

function renderWarehousesTable(data) {
  const warehousesTableBody = document.getElementById('warehousesTableBody');
  const warehousesCountEl = document.getElementById('warehousesCount');
  const warehouseSearch = document.getElementById('warehouseSearch');

  if (!warehousesTableBody) return;
  if (warehousesCountEl) warehousesCountEl.textContent = data.length.toLocaleString('ar-SA');

  const invSubWhEl = document.getElementById('invSubWarehousesCount');
  if (invSubWhEl && (!warehouseSearch || !warehouseSearch.value.trim())) {
    invSubWhEl.textContent = data.length.toLocaleString('ar-SA');
  }

  if (data.length === 0) {
    warehousesTableBody.innerHTML = '<tr><td colspan="4" class="table-empty">لا يوجد مستودعات مسجلة</td></tr>';
    return;
  }

  let html = '';
  data.forEach(w => {
    const statusBadge = (w.is_active !== false)
      ? '<span class="badge badge-success">نشط</span>'
      : '<span class="badge badge-secondary">غير نشط</span>';

    html += `
      <tr>
        <td><span class="code-badge">${escapeHtml(w.cf_id || w.code || '')}</span></td>
        <td class="font-bold">${escapeHtml(w.cf_t1 || w.name || '')}</td>
        <td>${escapeHtml(w.cf_t2 || w.location || '–')}</td>          
        <td>${statusBadge}</td>
      </tr>
    `;
  });
  warehousesTableBody.innerHTML = html;

  const deleteWhModalOverlay = document.getElementById('deleteWhModalOverlay');
  const deleteWhName = document.getElementById('deleteWhName');

  warehousesTableBody.querySelectorAll('.btn-action-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = warehousesData.find(w => (w.id == btn.dataset.id || w.cf_id == btn.dataset.id));
      if (item) openEditWarehouseModal(item);
    });
  });

  warehousesTableBody.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteWhTargetId = btn.dataset.id;
      if (deleteWhName) deleteWhName.textContent = btn.dataset.name;
      openModal(deleteWhModalOverlay);
    });
  });
}

function openEditWarehouseModal(w) {
  const whEditId = document.getElementById('whEditId');
  const warehouseModalTitle = document.getElementById('warehouseModalTitle');
  const warehouseModalOverlay = document.getElementById('warehouseModalOverlay');

  if (whEditId) whEditId.value = w.id;
  if (warehouseModalTitle) warehouseModalTitle.textContent = 'تعديل بيانات المستودع';
  document.getElementById('whCode').value = w.code || '';
  document.getElementById('whName').value = w.name || '';
  document.getElementById('whLocation').value = w.location || '';
  document.getElementById('whManager').value = w.manager_name || '';
  document.getElementById('whPhone').value = w.phone || '';
  const isActiveCheck = document.getElementById('whIsActive');
  if (isActiveCheck) isActiveCheck.checked = !!w.is_active;

  openModal(warehouseModalOverlay);
}

// ── ITEM GROUPS LOADER ───────────────────────────────────

export async function loadItemGroups(search = '') {
  const itemGroupsTableBody = document.getElementById('itemGroupsTableBody');
  const itemGroupsCountEl = document.getElementById('itemGroupsCount');
  const itemGroupSearch = document.getElementById('itemGroupSearch');

  if (!itemGroupsTableBody) return;
  itemGroupsTableBody.innerHTML = '<tr><td colspan="5" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    const res = await fetch('/api/item-groups');
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    itemGroupsData = json.data || [];
    let filtered = itemGroupsData;
    if (search) {
      const q = search.toLowerCase();
      filtered = itemGroupsData.filter(g =>
        (g.code && g.code.toLowerCase().includes(q)) ||
        (g.group_name && g.group_name.toLowerCase().includes(q)) ||
        (g.name_ar && g.name_ar.toLowerCase().includes(q)) ||
        (g.name_en && g.name_en.toLowerCase().includes(q))
      );
    }

    if (itemGroupsCountEl) itemGroupsCountEl.textContent = filtered.length.toLocaleString('ar-SA');
    const invSubGrpEl = document.getElementById('invSubGroupsCount');
    if (invSubGrpEl && (!itemGroupSearch || !itemGroupSearch.value.trim())) {
      invSubGrpEl.textContent = itemGroupsData.length.toLocaleString('ar-SA');
    }

    if (filtered.length === 0) {
      itemGroupsTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">لا يوجد مجموعات أصناف مسجلة</td></tr>';
      return;
    }

    let html = '';
    filtered.forEach(g => {
      const statusBadge = g.is_active !== false
        ? '<span class="badge badge-success">مفعل</span>'
        : '<span class="badge badge-secondary">غير مفعل</span>';
      html += `
        <tr>
          <td><span class="code-badge">${escapeHtml(g.code || g.group_id || '')}</span></td>
          <td class="font-bold">${escapeHtml(g.name_ar || g.group_name || '')}</td>
          <td dir="ltr" style="text-align:right;">${escapeHtml(g.name_en || '–')}</td>
          <td>${escapeHtml(g.description || '–')}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });
    itemGroupsTableBody.innerHTML = html;
  } catch (err) {
    itemGroupsTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">خطأ في تحميل مجموعات الأصناف</td></tr>';
  }
}

// ── ITEMS LOADER ─────────────────────────────────────────

export async function loadItems(search = '', filterGroup = '') {
  const itemsTableBody = document.getElementById('itemsTableBody');
  const itemsCountEl = document.getElementById('itemsCount');
  const itemsSearch = document.getElementById('itemsSearch');
  const itemsGroupFilter = document.getElementById('itemsGroupFilter');

  if (!itemsTableBody) return;
  itemsTableBody.innerHTML = '<tr><td colspan="7" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    const res = await fetch('/api/items');
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    itemsData = json.data || [];

    // Populate group filter dropdown on first load (or when empty)
    if (itemsGroupFilter && itemsGroupFilter.options.length <= 1) {
      try {
        const grpRes = await fetch('/api/item-groups');
        const grpJson = grpRes.ok ? await grpRes.json() : null;
        if (grpJson?.success && grpJson.data?.length) {
          grpJson.data.forEach(g => {
            const label = g.name_ar || g.group_name || g.name_en || String(g.id || '');
            if (!label) return;
            const opt = document.createElement('option');
            opt.value = label;
            opt.textContent = label;
            itemsGroupFilter.appendChild(opt);
          });
        }
      } catch (_) { /* silently ignore */ }
    }

    let filtered = itemsData;

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(i =>
        (i.item_id && String(i.item_id).includes(q)) ||
        (i.item_name && i.item_name.toLowerCase().includes(q)) ||
        (i.item_product && i.item_product.toLowerCase().includes(q))
      );
    }

    if (filterGroup) {
      filtered = filtered.filter(i =>
        i.item_product && i.item_product === filterGroup
      );
    }

    if (itemsCountEl) itemsCountEl.textContent = filtered.length.toLocaleString('ar-SA');
    const invSubItemEl = document.getElementById('invSubItemsCount');
    if (invSubItemEl && (!itemsSearch || !itemsSearch.value.trim())) {
      invSubItemEl.textContent = itemsData.length.toLocaleString('ar-SA');
    }

    if (filtered.length === 0) {
      itemsTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">لا يوجد أصناف مسجلة</td></tr>';
      return;
    }

    let html = '';
    filtered.forEach(i => {
      const statusBadge = i.is_active !== false
        ? '<span class="badge badge-success">نشط</span>'
        : '<span class="badge badge-secondary">غير نشط</span>';
      html += `
        <tr>
          <td><span class="code-badge">${escapeHtml(String(i.item_id || ''))}</span></td>
          <td class="font-bold">${escapeHtml(i.item_name || '')}</td>
          <td>${escapeHtml(i.item_product || '–')}</td>
          <td>${escapeHtml(i.item_unit || i.unit || 'حبة')}</td>
          <td>${Number(i.item_buy_price || i.purchase_price || 0).toLocaleString('ar-SA')} ر.س</td>
          <td>${Number(i.item_sell_price1 || i.selling_price || 0).toLocaleString('ar-SA')} ر.س</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });
    itemsTableBody.innerHTML = html;
  } catch (err) {
    itemsTableBody.innerHTML = '<tr><td colspan="7" class="table-empty">خطأ في تحميل الأصناف</td></tr>';
  }
}

// ── ADJUSTMENTS UP (تسوية زيادة) CRUD & SEARCH ─────────────────

let adjustmentsUpData = [];
let adjUpItemRows = [];
let _adjUpRowSeq = 0;
let masterWarehousesCache = null;
let masterItemsCache = null;

async function filterWarehousesCache(q) {
  if (!masterWarehousesCache) {
    try {
      const res = await fetch('/api/warehouses/search?q=&limit=1000');
      const json = await res.json();
      if (json.success) masterWarehousesCache = json.data || [];
    } catch (_) {}
  }
  const cleanQ = (q || '').trim().toLowerCase();
  const data = masterWarehousesCache || [];
  if (!cleanQ) return data.slice(0, 80);
  return data.filter(w =>
    (w.cf_t1 && w.cf_t1.toLowerCase().includes(cleanQ)) ||
    String(w.cf_id).includes(cleanQ)
  ).slice(0, 80);
}

async function filterItemsCache(q) {
  if (!masterItemsCache) {
    try {
      const res = await fetch('/api/items/search?q=&limit=10000');
      const json = await res.json();
      if (json.success) masterItemsCache = json.data || [];
    } catch (_) {}
  }
  const cleanQ = (q || '').trim().toLowerCase();
  const data = masterItemsCache || [];
  if (!cleanQ) return data.slice(0, 80);
  return data.filter(i =>
    (i.item_name && i.item_name.toLowerCase().includes(cleanQ)) ||
    String(i.item_id).includes(cleanQ)
  ).slice(0, 80);
}

function initCombo({ inputEl, hiddenEl, dropdownEl, getLocalData, onSelect, portal = false }) {
  if (!inputEl || !dropdownEl) return;

  let debounceTimer = null;
  let allOptions = [];
  let isListeningScroll = false;

  if (portal) {
    document.body.appendChild(dropdownEl);
    Object.assign(dropdownEl.style, {
      position: 'fixed',
      zIndex: '9999',
      right: 'auto'
    });
  }

  function positionDropdown() {
    if (!portal || !dropdownEl.classList.contains('open')) return;
    const r = inputEl.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) {
      closeDropdown();
      return;
    }
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const width = Math.max(r.width, Math.min(320, viewportW - 20));
    let left = r.left;
    if (left + width > viewportW - 10) left = Math.max(10, viewportW - width - 10);
    if (left < 10) left = 10;
    const expectedH = Math.min(220, dropdownEl.scrollHeight || 180);
    let top = r.bottom + 4;
    if (top + expectedH > viewportH - 10 && r.top > expectedH + 10) {
      top = r.top - expectedH - 4;
    }
    Object.assign(dropdownEl.style, {
      top: top + 'px',
      left: left + 'px',
      width: width + 'px',
      maxHeight: '220px'
    });
  }

  function attachScrollListeners() {
    if (!isListeningScroll && portal) {
      window.addEventListener('scroll', positionDropdown, { passive: true, capture: true });
      window.addEventListener('resize', positionDropdown, { passive: true });
      isListeningScroll = true;
    }
  }

  function detachScrollListeners() {
    if (isListeningScroll && portal) {
      window.removeEventListener('scroll', positionDropdown, { capture: true });
      window.removeEventListener('resize', positionDropdown);
      isListeningScroll = false;
    }
  }

  function openDropdown() {
    positionDropdown();
    dropdownEl.classList.add('open');
    attachScrollListeners();
  }

  function closeDropdown() {
    dropdownEl.classList.remove('open');
    detachScrollListeners();
  }

  function renderOptions(data, q) {
    if (!data.length) {
      dropdownEl.innerHTML = '<div class="combo-empty">لا توجد نتائج</div>';
    } else {
      dropdownEl.innerHTML = data.map((d, i) =>
        `<div class="combo-option" data-idx="${i}" data-id="${d.id}" data-name="${escapeHtml(d.name)}">
           <span>${escapeHtml(d.name)}</span>
           <span class="opt-id">${d.id}</span>
         </div>`
      ).join('');

      dropdownEl.querySelectorAll('.combo-option').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectOption(opt.dataset.id, opt.dataset.name);
        });
      });
    }
    openDropdown();
  }

  function selectOption(id, name) {
    inputEl.value = name;
    if (hiddenEl && typeof hiddenEl === 'object') hiddenEl.value = id;
    closeDropdown();
    if (onSelect) onSelect(id, name);
  }

  async function doSearch(q) {
    try {
      const rawData = await getLocalData(q);
      allOptions = rawData.map(r => ({
        id: r.cf_id ?? r.item_id,
        name: r.cf_t1 ?? r.item_name,
        unit: r.item_unit
      }));
      renderOptions(allOptions, q);
    } catch { /* silent */ }
  }

  inputEl.addEventListener('focus', () => {
    if (hiddenEl && typeof hiddenEl === 'object') hiddenEl.value = '';
    doSearch(inputEl.value.trim());
  });

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    if (hiddenEl && typeof hiddenEl === 'object') hiddenEl.value = '';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(q), 250);
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => closeDropdown(), 150);
  });

  return { selectOption, getAllOptions: () => allOptions };
}

export async function loadAdjustmentsUp(search = '') {
  const tableBody = document.getElementById('adjustmentsUpTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="4" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    let url = '/api/inventory/adjustments-up';
    if (search) url += `?search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    adjustmentsUpData = json.data || [];
    renderAdjustmentsUpTable(adjustmentsUpData);
  } catch (err) {
    console.error('Load adjustments up error:', err);
    tableBody.innerHTML = '<tr><td colspan="4" class="table-empty">خطأ في تحميل تسويات الزيادة</td></tr>';
  }
}

function renderAdjustmentsUpTable(data) {
  const tableBody = document.getElementById('adjustmentsUpTableBody');
  const countEl = document.getElementById('adjustmentsUpCount');
  const invSubAdjUpCountEl = document.getElementById('invSubAdjUpCount');
  const searchInput = document.getElementById('adjustmentsUpSearch');

  if (!tableBody) return;
  if (countEl) countEl.textContent = data.length.toLocaleString('ar-SA');
  if (invSubAdjUpCountEl && (!searchInput || !searchInput.value.trim())) {
    invSubAdjUpCountEl.textContent = data.length.toLocaleString('ar-SA');
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="4" class="table-empty">لا توجد تسويات زيادة مسجلة</td></tr>';
    return;
  }

  tableBody.innerHTML = data.map(doc => {
    const formattedDate = doc.cash_date ? new Date(doc.cash_date).toLocaleDateString('ar-SA') : '–';

    return `
      <tr>
        <td>
          <a href="#" class="cell-id adj-up-link" data-ser="${escapeHtml(String(doc.cash_ser || ''))}" style="color: #38bdf8; text-decoration: underline; font-weight: 600; cursor: pointer;">
            ${escapeHtml(String(doc.cash_ser || ''))}
          </a>
        </td>
        <td dir="ltr" style="text-align:right">${escapeHtml(formattedDate)}</td>
        <td class="font-bold">${escapeHtml(doc.cash_stock_name || '–')}</td>
        <td class="cell-notes" title="${escapeHtml(doc.cash_notes || '')}">${escapeHtml(doc.cash_notes || '–')}</td>
      </tr>
    `;
  }).join('');
}

export async function openAdjustmentUpDetailsView(cashSer) {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');

  const detailsView = document.getElementById('inventory-sub-adj-up-details');
  if (!detailsView) return;
  detailsView.style.display = '';

  const elSerBadge = document.getElementById('adjUpDetailSerBadge');
  const elSer = document.getElementById('adjUpDetailSer');
  const elDate = document.getElementById('adjUpDetailDate');
  const elStock = document.getElementById('adjUpDetailStock');
  const elNotes = document.getElementById('adjUpDetailNotes');
  const itemsBody = document.getElementById('adjUpDetailItemsBody');

  if (elSerBadge) elSerBadge.textContent = String(cashSer);
  if (elSer) elSer.textContent = String(cashSer);
  if (elDate) elDate.textContent = '–';
  if (elStock) elStock.textContent = '–';
  if (elNotes) elNotes.textContent = '–';
  if (itemsBody) itemsBody.innerHTML = '<tr><td colspan="5" class="table-loading">جاري تحميل أصناف التسوية…</td></tr>';

  try {
    const res = await fetch(`/api/inventory/adjustment/${cashSer}`);
    if (!res.ok) throw new Error('Document not found');
    const json = await res.json();
    if (!json.success || !json.header) throw new Error(json.error || 'فشل تحميل بيانات التسوية');

    const header = json.header;
    const items = json.items || [];
    currentAdjUpDetails = { header, items };

    if (elSer) elSer.textContent = String(header.cash_ser || '–');
    if (elDate) elDate.textContent = header.cash_date ? new Date(header.cash_date).toLocaleDateString('ar-SA') : '–';
    if (elStock) elStock.textContent = header.cash_stock_name || '–';
    if (elNotes) elNotes.textContent = header.cash_notes || '–';

    if (itemsBody) {
      if (items.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="5" class="table-empty">لا توجد أصناف مسجلة لهذه التسوية</td></tr>';
      } else {
        itemsBody.innerHTML = items.map((item, idx) => {
          const rowNo = item.row_no || (idx + 1);
          return `
            <tr>
              <td><span class="cell-id" style="color: var(--text-muted); font-weight: 500;">${rowNo}</span></td>
              <td><span class="cell-id">${escapeHtml(String(item.item_id || ''))}</span></td>
              <td class="font-bold">${escapeHtml(item.item_name || '–')}</td>
              <td>${escapeHtml(item.item_unit || '–')}</td>
              <td class="font-bold" style="color: #38bdf8;">${Number(item.item_qty || 0).toLocaleString('ar-SA')}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error opening adjustment details:', err);
    if (itemsBody) itemsBody.innerHTML = '<tr><td colspan="5" class="table-empty">خطأ في تحميل تفاصيل التسوية</td></tr>';
  }
}

let currentAdjUpDetails = null;
let editingAdjUpSer = null;

export async function openCreateAdjustmentUpView(editData = null) {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');

  const createView = document.getElementById('inventory-sub-create-adj-up');
  if (!createView) return;
  createView.style.display = '';

  adjUpItemRows = [];
  document.getElementById('adjUpItemsBody').innerHTML = '';

  const headerTitle = createView.querySelector('.card-header h3');

  if (editData && editData.header) {
    const h = editData.header;
    editingAdjUpSer = h.cash_ser;
    if (headerTitle) {
      headerTitle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> تعديل تسوية زيادة رقم #${h.cash_ser}`;
    }
    const badgeEl = document.getElementById('adjUpNextSerBadge');
    if (badgeEl) badgeEl.textContent = `# ${h.cash_ser}`;

    document.getElementById('adjUpDate').value = h.cash_date ? String(h.cash_date).split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('adjUpStockSearch').value = h.cash_stock_name || '';
    document.getElementById('adjUpStockId').value = h.cash_stock_id || '';
    document.getElementById('adjUpNotes').value = h.cash_notes || '';

    if (editData.items && editData.items.length) {
      editData.items.forEach(item => {
        addAdjUpItemRow({
          item_id: item.item_id,
          item_name: item.item_name,
          item_unit: item.item_unit,
          item_qty: Number(item.item_qty) || 1
        });
      });
    } else {
      addAdjUpItemRow();
    }
  } else {
    editingAdjUpSer = null;
    if (headerTitle) {
      headerTitle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> إضافة تسوية زيادة جديدة`;
    }
    document.getElementById('adjUpDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('adjUpStockSearch').value = '';
    document.getElementById('adjUpStockId').value = '';
    document.getElementById('adjUpNotes').value = '';

    const badgeEl = document.getElementById('adjUpNextSerBadge');
    if (badgeEl) badgeEl.textContent = 'جاري التحميل…';

    try {
      const res = await fetch('/api/inventory/adjustments-up/next-ser');
      const json = await res.json();
      if (json.success && badgeEl) {
        badgeEl.textContent = `# ${json.next_ser}`;
      }
    } catch (_) {
      if (badgeEl) badgeEl.textContent = 'تلقائي';
    }

    addAdjUpItemRow();
  }
}

function addAdjUpItemRow(initialVal = null) {
  if (initialVal instanceof Event) initialVal = null;
  const isNewItem = !initialVal;

  const rowId = ++_adjUpRowSeq;
  adjUpItemRows.push({
    rowId,
    item_id: initialVal ? initialVal.item_id : null,
    item_name: initialVal ? initialVal.item_name : '',
    item_unit: initialVal ? initialVal.item_unit : '',
    item_qty: initialVal ? (initialVal.item_qty || 1) : 1
  });

  const tbody = document.getElementById('adjUpItemsBody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.dataset.rowId = rowId;
  const currentCount = tbody ? tbody.querySelectorAll('tr').length + 1 : 1;
  const initQty = initialVal ? initialVal.item_qty : 1;

  tr.innerHTML = `
    <td class="row-num-cell" style="color:var(--text-muted);font-size:12px;text-align:center;font-weight:500;">${currentCount}</td>
    <td>
      <div class="combo-wrapper" style="position:relative;">
        <input type="text" class="cell-input item-search-input form-input"
          placeholder="ابحث باسم الصنف أو الكود…" autocomplete="off"
          data-row="${rowId}" value="${escapeHtml(initialVal?.item_name || '')}">
        <div class="combo-dropdown item-combo-dropdown" id="adjUpItemDrop_${rowId}"></div>
      </div>
    </td>
    <td><span class="item-unit-cell" style="color:var(--text-muted);font-size:0.9rem;">${escapeHtml(initialVal?.item_unit || '–')}</span></td>
    <td><input type="number" class="cell-input item-qty-input form-input" value="${initQty}" min="0.001" step="any" dir="ltr" data-row="${rowId}"></td>
    <td>
      <button type="button" class="btn-del-row" data-row="${rowId}" title="حذف" style="background:none; border:none; color:#f87171; font-size:1.2rem; cursor:pointer;">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  const searchInput = tr.querySelector('.item-search-input');
  const dropdownEl = tr.querySelector('.item-combo-dropdown');
  const unitCell = tr.querySelector('.item-unit-cell');
  const qtyInput = tr.querySelector('.item-qty-input');

  const combo = initCombo({
    inputEl: searchInput,
    hiddenEl: { value: null },
    dropdownEl,
    portal: true,
    getLocalData: filterItemsCache,
    onSelect: (id, name) => {
      const cached = combo.getAllOptions().find(o => String(o.id) === String(id));
      const unit = cached ? (cached.unit || '–') : '–';
      unitCell.textContent = unit;
      const row = adjUpItemRows.find(r => r.rowId === rowId);
      if (row) {
        row.item_id = id;
        row.item_name = name;
        row.item_unit = unit;
      }
    }
  });

  qtyInput.addEventListener('input', () => {
    const row = adjUpItemRows.find(r => r.rowId === rowId);
    if (row) row.item_qty = parseFloat(qtyInput.value) || 0;
  });

  tr.querySelector('.btn-del-row').addEventListener('click', () => {
    adjUpItemRows = adjUpItemRows.filter(r => r.rowId !== rowId);
    tr.remove();
    updateAdjUpRowNumbers();
  });

  if (isNewItem && searchInput) {
    setTimeout(() => {
      searchInput.focus();
    }, 50);
  }
}

function updateAdjUpRowNumbers() {
  const tbody = document.getElementById('adjUpItemsBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, idx) => {
    const numCell = r.querySelector('.row-num-cell');
    if (numCell) numCell.textContent = idx + 1;
  });
}

async function saveAdjustmentUp() {
  const cash_date = document.getElementById('adjUpDate')?.value;
  const cash_stock_id = document.getElementById('adjUpStockId')?.value;
  const cash_stock_name = document.getElementById('adjUpStockSearch')?.value?.trim();
  const cash_notes = document.getElementById('adjUpNotes')?.value?.trim();

  if (!cash_date) {
    showToast('يرجى تحديد تاريخ المستند', 'danger');
    return;
  }

  const validItems = adjUpItemRows.filter(r => r.item_id && r.item_qty > 0);
  if (validItems.length === 0) {
    showToast('يرجى اختيار صنف واحد على الأقل وتحديد كميته', 'danger');
    return;
  }

  const payload = {
    cash_date,
    cash_stock_id: cash_stock_id || null,
    cash_stock_name: cash_stock_name || '',
    cash_notes: cash_notes || '',
    items: validItems.map((i, idx) => ({
      row_no: idx + 1,
      item_id: i.item_id,
      item_name: i.item_name,
      item_unit: i.item_unit,
      item_qty: i.item_qty
    }))
  };

  try {
    const url = editingAdjUpSer ? `/api/inventory/adjustment/${editingAdjUpSer}` : '/api/inventory/adjustment';
    const method = editingAdjUpSer ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) {
      showToast(json.error || 'فشل حفظ تسوية الزيادة', 'danger');
      return;
    }

    showToast(json.message || 'تم حفظ تسوية الزيادة بنجاح', 'success');
    openInventorySubView('adjustments-up');
  } catch (err) {
    console.error('Save adjustment up error:', err);
    showToast('حدث خطأ أثناء حفظ تسوية الزيادة', 'danger');
  }
}

// ── INITIALIZE INVENTORY MODULE ──────────────────────────

export function initInventoryModule() {
  const warehouseSearch = document.getElementById('warehouseSearch');
  const itemGroupSearch = document.getElementById('itemGroupSearch');
  const itemsSearch = document.getElementById('itemsSearch');
  const btnAddWarehouse = document.getElementById('btnAddWarehouse');

  const warehouseModalOverlay = document.getElementById('warehouseModalOverlay');
  const warehouseModalTitle = document.getElementById('warehouseModalTitle');
  const warehouseForm = document.getElementById('warehouseForm');
  const whEditId = document.getElementById('whEditId');
  const warehouseModalClose = document.getElementById('warehouseModalClose');
  const warehouseModalCancel = document.getElementById('warehouseModalCancel');

  const deleteWhModalOverlay = document.getElementById('deleteWhModalOverlay');
  const deleteWhCancelBtn = document.getElementById('deleteWhCancelBtn');
  const deleteWhConfirmBtn = document.getElementById('deleteWhConfirmBtn');

  // Reset to overview on section change
  onSectionChange((sectionId) => {
    if (sectionId === 'inventory') {
      showInventoryOverview();
    }
  });

  // Inventory overview card grid clicks
  document.querySelectorAll('.sub-link-card[data-inventory-sub]').forEach(card => {
    card.addEventListener('click', () => {
      const subKey = card.dataset.inventorySub;
      openInventorySubView(subKey);
    });
  });

  // Back to inventory buttons
  document.querySelectorAll('.btn-back-inventory').forEach(btn => {
    btn.addEventListener('click', () => {
      showInventoryOverview();
    });
  });

  // Adjustments Up Search input listener
  const adjustmentsUpSearch = document.getElementById('adjustmentsUpSearch');
  if (adjustmentsUpSearch) {
    adjustmentsUpSearch.addEventListener('input', debounce(() => {
      loadAdjustmentsUp(adjustmentsUpSearch.value.trim());
    }, 300));
  }

  // Adjustments Up Add New button
  const btnAddAdjustmentUp = document.getElementById('btnAddAdjustmentUp');
  if (btnAddAdjustmentUp) {
    btnAddAdjustmentUp.addEventListener('click', () => {
      openCreateAdjustmentUpView();
    });
  }

  // Adjustments Up document link delegation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.adj-up-link');
    if (link) {
      e.preventDefault();
      const ser = link.dataset.ser;
      if (ser) openAdjustmentUpDetailsView(ser);
    }
  });

  // Adjustments Up edit button
  const btnEditAdjUp = document.getElementById('btnEditAdjUp');
  if (btnEditAdjUp) {
    btnEditAdjUp.addEventListener('click', () => {
      if (currentAdjUpDetails) {
        openCreateAdjustmentUpView(currentAdjUpDetails);
      }
    });
  }

  // Back from Create / Details of Adjustments Up
  document.querySelectorAll('.btn-back-adj-up').forEach(btn => {
    btn.addEventListener('click', () => {
      openInventorySubView('adjustments-up');
    });
  });

  // Stock Search combo in Create Adjustment Up
  const stockSearchInput = document.getElementById('adjUpStockSearch');
  const stockHiddenId = document.getElementById('adjUpStockId');
  const stockDropdown = document.getElementById('adjUpStockDropdown');
  if (stockSearchInput && stockDropdown) {
    initCombo({
      inputEl: stockSearchInput,
      hiddenEl: stockHiddenId,
      dropdownEl: stockDropdown,
      getLocalData: filterWarehousesCache
    });
  }

  // Add Item Row button in Create Adjustment Up
  const btnAddAdjUpRow = document.getElementById('btnAddAdjUpRow');
  if (btnAddAdjUpRow) {
    btnAddAdjUpRow.addEventListener('click', addAdjUpItemRow);
  }

  // Save button in Create Adjustment Up
  const btnSaveAdjUp = document.getElementById('btnSaveAdjUp');
  if (btnSaveAdjUp) {
    btnSaveAdjUp.addEventListener('click', saveAdjustmentUp);
  }

  // Search input listeners
  if (warehouseSearch) {
    warehouseSearch.addEventListener('input', debounce(() => {
      loadWarehouses(warehouseSearch.value.trim());
    }, 300));
  }

  if (itemGroupSearch) {
    itemGroupSearch.addEventListener('input', debounce(() => {
      loadItemGroups(itemGroupSearch.value.trim());
    }, 300));
  }

  if (itemsSearch) {
    const applyItemsFilter = debounce(() => {
      const groupFilter = document.getElementById('itemsGroupFilter');
      loadItems(itemsSearch.value.trim(), groupFilter ? groupFilter.value : '');
    }, 300);
    itemsSearch.addEventListener('input', applyItemsFilter);
  }

  const itemsGroupFilter = document.getElementById('itemsGroupFilter');
  if (itemsGroupFilter) {
    itemsGroupFilter.addEventListener('change', () => {
      const searchVal = itemsSearch ? itemsSearch.value.trim() : '';
      loadItems(searchVal, itemsGroupFilter.value);
    });
  }

  // Add Warehouse button
  if (btnAddWarehouse) {
    btnAddWarehouse.addEventListener('click', () => {
      if (whEditId) whEditId.value = '';
      if (warehouseModalTitle) warehouseModalTitle.textContent = 'إضافة مستودع جديد';
      if (warehouseForm) warehouseForm.reset();
      const isActiveCheck = document.getElementById('whIsActive');
      if (isActiveCheck) isActiveCheck.checked = true;
      openModal(warehouseModalOverlay);
    });
  }

  // Warehouse Save Form handler
  if (warehouseForm) {
    warehouseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = whEditId ? whEditId.value : '';
      const payload = {
        code: document.getElementById('whCode').value.trim(),
        name: document.getElementById('whName').value.trim(),
        location: document.getElementById('whLocation').value.trim(),
        manager_name: document.getElementById('whManager').value.trim(),
        phone: document.getElementById('whPhone').value.trim(),
        is_active: document.getElementById('whIsActive').checked,
      };

      try {
        const url = id ? `/api/warehouses/${id}` : '/api/warehouses';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'فشلت العملية', 'danger');
          return;
        }

        showToast(json.message || 'تم الحفظ بنجاح', 'success');
        closeModal(warehouseModalOverlay);
        loadWarehouses(warehouseSearch ? warehouseSearch.value.trim() : '');
        loadStats();
      } catch (err) {
        showToast('حدث خطأ في الشبكة', 'danger');
      }
    });
  }

  // Delete Warehouse confirm
  if (deleteWhConfirmBtn) {
    deleteWhConfirmBtn.addEventListener('click', async () => {
      if (!deleteWhTargetId) return;
      try {
        const res = await fetch(`/api/warehouses/${deleteWhTargetId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!json.success) {
          showToast(json.error || 'فشل الحذف', 'danger');
          return;
        }
        showToast(json.message || 'تم الحذف بنجاح', 'success');
        closeModal(deleteWhModalOverlay);
        deleteWhTargetId = null;
        loadWarehouses(warehouseSearch ? warehouseSearch.value.trim() : '');
        loadStats();
      } catch (err) {
        showToast('حدث خطأ في الشبكة أثناء الحذف', 'danger');
      }
    });
  }

  // Modal cancel & close listeners
  [warehouseModalClose, warehouseModalCancel].forEach(b => {
    if (b) b.addEventListener('click', () => closeModal(warehouseModalOverlay));
  });
  if (deleteWhCancelBtn) {
    deleteWhCancelBtn.addEventListener('click', () => closeModal(deleteWhModalOverlay));
  }
}

