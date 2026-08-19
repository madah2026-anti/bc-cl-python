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
  } else if (subKey === 'adjustments-up' || subKey === 'adjustments-down') {
    currentAdjCat = (subKey === 'adjustments-down') ? 43 : 12;
    const adjView = document.getElementById('inventory-sub-adjustments');
    if (adjView) adjView.style.display = '';
    loadAdjustments(currentAdjCat);
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

// ── UNIFIED INVENTORY ADJUSTMENTS (زيادة / تخفيض) CRUD ────────

let currentAdjCat = 12; // 12 for Adjustments Up, 43 for Adjustments Down
let adjustmentsData = [];
let adjItemRows = [];
let _adjRowSeq = 0;
let currentAdjDetails = null;
let editingAdjSer = null;
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

export async function loadAdjustments(cash_cat = currentAdjCat, search = '') {
  currentAdjCat = cash_cat;
  const tableBody = document.getElementById('adjustmentsTableBody');
  const titleEl = document.getElementById('adjListTitle');
  const addBtnText = document.getElementById('btnAddAdjText');

  if (titleEl) titleEl.textContent = (cash_cat === 43) ? 'سجل تسويات التخفيض' : 'سجل تسويات الزيادة';
  if (addBtnText) addBtnText.textContent = (cash_cat === 43) ? 'إضافة تسوية تخفيض' : 'إضافة تسوية زيادة';

  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="4" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    const endpoint = (cash_cat === 43) ? '/api/inventory/adjustments-down' : '/api/inventory/adjustments-up';
    let url = search ? `${endpoint}?search=${encodeURIComponent(search)}` : endpoint;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    adjustmentsData = json.data || [];
    renderAdjustmentsTable(adjustmentsData);
  } catch (err) {
    console.error('Load adjustments error:', err);
    tableBody.innerHTML = '<tr><td colspan="4" class="table-empty">خطأ في تحميل بيانات التسوية</td></tr>';
  }
}

// Backward compatibility alias functions
export function loadAdjustmentsUp(search = '') { return loadAdjustments(12, search); }
export function loadAdjustmentsDown(search = '') { return loadAdjustments(43, search); }

function renderAdjustmentsTable(data) {
  const tableBody = document.getElementById('adjustmentsTableBody');
  const countEl = document.getElementById('adjustmentsCount');
  const invSubCountEl = (currentAdjCat === 43)
    ? document.getElementById('invSubAdjDownCount')
    : document.getElementById('invSubAdjUpCount');
  const searchInput = document.getElementById('adjustmentsSearch');

  if (!tableBody) return;
  if (countEl) countEl.textContent = data.length.toLocaleString('ar-SA');
  if (invSubCountEl && (!searchInput || !searchInput.value.trim())) {
    invSubCountEl.textContent = data.length.toLocaleString('ar-SA');
  }

  if (!data || data.length === 0) {
    const emptyMsg = (currentAdjCat === 43) ? 'لا توجد تسويات تخفيض مسجلة' : 'لا توجد تسويات زيادة مسجلة';
    tableBody.innerHTML = `<tr><td colspan="4" class="table-empty">${emptyMsg}</td></tr>`;
    return;
  }

  const linkColor = (currentAdjCat === 43) ? '#f87171' : '#38bdf8';

  tableBody.innerHTML = data.map(doc => {
    const formattedDate = doc.cash_date ? new Date(doc.cash_date).toLocaleDateString('ar-SA') : '–';

    return `
      <tr>
        <td>
          <a href="#" class="cell-id adj-link" data-ser="${escapeHtml(String(doc.cash_ser || ''))}" style="color: ${linkColor}; text-decoration: underline; font-weight: 600; cursor: pointer;">
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

export async function openAdjustmentDetailsView(cashSer) {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');

  const detailsView = document.getElementById('inventory-sub-adj-details');
  if (!detailsView) return;
  detailsView.style.display = '';

  const isDown = (currentAdjCat === 43);
  const accentColor = isDown ? '#f87171' : '#38bdf8';
  const badgeBg = isDown ? 'rgba(248, 113, 113, 0.15)' : 'rgba(56, 189, 248, 0.15)';

  const elTitle = document.getElementById('adjDetailTitle');
  const elSerBadge = document.getElementById('adjDetailSerBadge');
  const elSer = document.getElementById('adjDetailSer');
  const elDate = document.getElementById('adjDetailDate');
  const elStock = document.getElementById('adjDetailStock');
  const elNotes = document.getElementById('adjDetailNotes');
  const itemsBody = document.getElementById('adjDetailItemsBody');
  const btnEdit = document.getElementById('btnEditAdj');

  if (elTitle) elTitle.textContent = isDown ? 'تفاصيل تسوية التخفيض' : 'تفاصيل تسوية الزيادة';
  if (elSerBadge) {
    elSerBadge.textContent = String(cashSer);
    elSerBadge.style.color = accentColor;
    elSerBadge.style.background = badgeBg;
  }
  if (elSer) {
    elSer.textContent = String(cashSer);
    elSer.style.color = accentColor;
  }
  if (btnEdit) {
    btnEdit.style.color = accentColor;
    btnEdit.style.background = badgeBg;
    btnEdit.style.borderColor = isDown ? 'rgba(248, 113, 113, 0.3)' : 'rgba(56, 189, 248, 0.3)';
  }

  if (elDate) elDate.textContent = '–';
  if (elStock) elStock.textContent = '–';
  if (elNotes) elNotes.textContent = '–';
  if (itemsBody) itemsBody.innerHTML = '<tr><td colspan="5" class="table-loading">جاري تحميل أصناف التسوية…</td></tr>';

  try {
    const endpoint = isDown ? `/api/inventory/adjustment-down/${cashSer}` : `/api/inventory/adjustment/${cashSer}`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Document not found');
    const json = await res.json();
    if (!json.success || !json.header) throw new Error(json.error || 'فشل تحميل بيانات التسوية');

    const header = json.header;
    const items = json.items || [];
    currentAdjDetails = { header, items };

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
              <td class="font-bold" style="color: ${accentColor};">${Number(item.item_qty || 0).toLocaleString('ar-SA')}</td>
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

export async function openCreateAdjustmentView(editData = null) {
  const overview = document.getElementById('inventory-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.inventory-sub-view').forEach(v => v.style.display = 'none');

  const createView = document.getElementById('inventory-sub-create-adj');
  if (!createView) return;
  createView.style.display = '';

  adjItemRows = [];
  document.getElementById('adjItemsBody').innerHTML = '';

  const isDown = (currentAdjCat === 43);
  const accentColor = isDown ? '#f87171' : '#38bdf8';
  const badgeBg = isDown ? 'rgba(248, 113, 113, 0.12)' : 'rgba(56, 189, 248, 0.12)';
  const docTypeName = isDown ? 'تسوية تخفيض' : 'تسوية زيادة';

  const titleEl = document.getElementById('adjCreateTitle');
  const badgeEl = document.getElementById('adjNextSerBadge');
  if (badgeEl) {
    badgeEl.style.color = accentColor;
    badgeEl.style.background = badgeBg;
  }

  if (editData && editData.header) {
    const h = editData.header;
    editingAdjSer = h.cash_ser;
    if (titleEl) {
      titleEl.innerHTML = `تعديل ${docTypeName} رقم #${h.cash_ser}`;
    }
    if (badgeEl) badgeEl.textContent = `# ${h.cash_ser}`;

    document.getElementById('adjDate').value = h.cash_date ? String(h.cash_date).split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('adjStockSearch').value = h.cash_stock_name || '';
    document.getElementById('adjStockId').value = h.cash_stock_id || '';
    document.getElementById('adjNotes').value = h.cash_notes || '';

    if (editData.items && editData.items.length) {
      editData.items.forEach(item => {
        addAdjItemRow({
          item_id: item.item_id,
          item_name: item.item_name,
          item_unit: item.item_unit,
          item_qty: Number(item.item_qty) || 1
        });
      });
    } else {
      addAdjItemRow();
    }
  } else {
    editingAdjSer = null;
    if (titleEl) {
      titleEl.textContent = `إضافة ${docTypeName} جديدة`;
    }
    document.getElementById('adjDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('adjStockSearch').value = '';
    document.getElementById('adjStockId').value = '';
    document.getElementById('adjNotes').value = '';

    if (badgeEl) badgeEl.textContent = 'جاري التحميل…';

    try {
      const endpoint = isDown ? '/api/inventory/adjustments-down/next-ser' : '/api/inventory/adjustments-up/next-ser';
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.success && badgeEl) {
        badgeEl.textContent = `# ${json.next_ser}`;
      }
    } catch (_) {
      if (badgeEl) badgeEl.textContent = 'تلقائي';
    }

    addAdjItemRow();
  }
}

function addAdjItemRow(initialVal = null) {
  if (initialVal instanceof Event) initialVal = null;
  const isNewItem = !initialVal;

  const rowId = ++_adjRowSeq;
  adjItemRows.push({
    rowId,
    item_id: initialVal ? initialVal.item_id : null,
    item_name: initialVal ? initialVal.item_name : '',
    item_unit: initialVal ? initialVal.item_unit : '',
    item_qty: initialVal ? (initialVal.item_qty || 1) : 1
  });

  const tbody = document.getElementById('adjItemsBody');
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
        <div class="combo-dropdown item-combo-dropdown" id="adjItemDrop_${rowId}"></div>
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
      const row = adjItemRows.find(r => r.rowId === rowId);
      if (row) {
        row.item_id = id;
        row.item_name = name;
        row.item_unit = unit;
      }
    }
  });

  qtyInput.addEventListener('input', () => {
    const row = adjItemRows.find(r => r.rowId === rowId);
    if (row) row.item_qty = parseFloat(qtyInput.value) || 0;
  });

  tr.querySelector('.btn-del-row').addEventListener('click', () => {
    adjItemRows = adjItemRows.filter(r => r.rowId !== rowId);
    tr.remove();
    updateAdjRowNumbers();
  });

  if (isNewItem && searchInput) {
    setTimeout(() => {
      searchInput.focus();
    }, 50);
  }
}

function updateAdjRowNumbers() {
  const tbody = document.getElementById('adjItemsBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, idx) => {
    const numCell = r.querySelector('.row-num-cell');
    if (numCell) numCell.textContent = idx + 1;
  });
}

async function saveAdjustment() {
  const cash_date = document.getElementById('adjDate')?.value;
  const cash_stock_id = document.getElementById('adjStockId')?.value;
  const cash_stock_name = document.getElementById('adjStockSearch')?.value?.trim();
  const cash_notes = document.getElementById('adjNotes')?.value?.trim();

  if (!cash_date) {
    showToast('يرجى تحديد تاريخ المستند', 'danger');
    return;
  }

  const validItems = adjItemRows.filter(r => r.item_id && r.item_qty > 0);
  if (validItems.length === 0) {
    showToast('يرجى اختيار صنف واحد على الأقل وتحديد كميته', 'danger');
    return;
  }

  const isDown = (currentAdjCat === 43);
  const docTypeName = isDown ? 'تسوية التخفيض' : 'تسوية الزيادة';

  const payload = {
    cash_cat: currentAdjCat,
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
    const baseEndpoint = isDown ? '/api/inventory/adjustment-down' : '/api/inventory/adjustment';
    const url = editingAdjSer ? `${baseEndpoint}/${editingAdjSer}` : baseEndpoint;
    const method = editingAdjSer ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) {
      showToast(json.error || `فشل حفظ ${docTypeName}`, 'danger');
      return;
    }

    showToast(json.message || `تم حفظ ${docTypeName} بنجاح`, 'success');
    const subKey = isDown ? 'adjustments-down' : 'adjustments-up';
    openInventorySubView(subKey);
  } catch (err) {
    console.error('Save adjustment error:', err);
    showToast(`حدث خطأ أثناء حفظ ${docTypeName}`, 'danger');
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

  // Adjustments Search input listener
  const adjustmentsSearch = document.getElementById('adjustmentsSearch');
  if (adjustmentsSearch) {
    adjustmentsSearch.addEventListener('input', debounce(() => {
      loadAdjustments(currentAdjCat, adjustmentsSearch.value.trim());
    }, 300));
  }

  // Adjustments Add New button
  const btnAddAdjustment = document.getElementById('btnAddAdjustment');
  if (btnAddAdjustment) {
    btnAddAdjustment.addEventListener('click', () => {
      openCreateAdjustmentView();
    });
  }

  // Adjustments document link delegation
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.adj-link');
    if (link) {
      e.preventDefault();
      const ser = link.dataset.ser;
      if (ser) openAdjustmentDetailsView(ser);
    }
  });

  // Adjustments edit button
  const btnEditAdj = document.getElementById('btnEditAdj');
  if (btnEditAdj) {
    btnEditAdj.addEventListener('click', () => {
      if (currentAdjDetails) {
        openCreateAdjustmentView(currentAdjDetails);
      }
    });
  }

  // Back from Create / Details of Adjustments
  document.querySelectorAll('.btn-back-adj').forEach(btn => {
    btn.addEventListener('click', () => {
      const subKey = (currentAdjCat === 43) ? 'adjustments-down' : 'adjustments-up';
      openInventorySubView(subKey);
    });
  });

  // Stock Search combo in Create Adjustment
  const stockSearchInput = document.getElementById('adjStockSearch');
  const stockHiddenId = document.getElementById('adjStockId');
  const stockDropdown = document.getElementById('adjStockDropdown');
  if (stockSearchInput && stockDropdown) {
    initCombo({
      inputEl: stockSearchInput,
      hiddenEl: stockHiddenId,
      dropdownEl: stockDropdown,
      getLocalData: filterWarehousesCache
    });
  }

  // Add Item Row button in Create Adjustment
  const btnAddAdjRow = document.getElementById('btnAddAdjRow');
  if (btnAddAdjRow) {
    btnAddAdjRow.addEventListener('click', addAdjItemRow);
  }

  // Save button in Create Adjustment
  const btnSaveAdj = document.getElementById('btnSaveAdj');
  if (btnSaveAdj) {
    btnSaveAdj.addEventListener('click', saveAdjustment);
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

