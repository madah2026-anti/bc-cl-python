// ============================================================
// modules/sales.js – Sales Section Sub-View Navigation & Invoices Module
// ============================================================

import { escapeHtml, debounce } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';
import { onSectionChange, closeMobileSidebar } from '../core/navigation.js';
import { loadCustomers } from './customers.js';
import { openModal, closeModal } from '../utils/modal.js';

let salesDocumentsData = [];

/**
 * Load sales documents from cash table with optional category & search filter
 * @param {string} search 
 * @param {string} cat 
 */
export async function loadSalesDocuments(search = '', cat = 'all') {
  const tableBody = document.getElementById('salesDocumentsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    let url = `/api/sales/documents?cat=${encodeURIComponent(cat)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    salesDocumentsData = json.data || [];
    renderSalesDocumentsTable(salesDocumentsData);
  } catch (err) {
    console.error('Load sales documents error:', err);
    tableBody.innerHTML = '<tr><td colspan="6" class="table-empty">خطأ في تحميل مستندات المبيعات</td></tr>';
  }
}

let lastDocSubKey = 'invoices';

/**
 * Open Document Details in-page sub-view and fetch header + line items
 * @param {string|number} cashSer 
 */
export async function openDocumentDetailsView(cashSer) {
  const overview = document.getElementById('sales-overview');
  if (overview) overview.style.display = 'none';

  document.querySelectorAll('.sales-sub-view').forEach(v => v.style.display = 'none');

  const docSubView = document.getElementById('sales-sub-doc-details');
  if (!docSubView) return;

  docSubView.style.display = '';

  const catBadge = document.getElementById('docViewCatBadge');
  const itemsTableBody = document.getElementById('docViewItemsTableBody');

  // New layout elements
  const elSer = document.getElementById('cash_ser');
  const elDate = document.getElementById('cash_date');
  const elCvName = document.getElementById('cash_cv_name');
  const elCvId = document.getElementById('cash_cv_id');
  const elStockName = document.getElementById('cash_stock_name');
  const elStockId = document.getElementById('cash_stock_id');
  const elAgentName = document.getElementById('cash_agent_name');
  const elAgentId = document.getElementById('cash_agent_id');
  const elPayMethod = document.getElementById('cash_pay_method');
  const elNotes = document.getElementById('cash_notes');
  const elGrossAmount = document.getElementById('cash_gross_amount');
  const elDiscount = document.getElementById('cash_discount');
  const elAmount = document.getElementById('cash_amount');

  if (catBadge) catBadge.textContent = 'جاري التحميل…';
  if (elSer) elSer.textContent = String(cashSer);
  const resetEls = [elDate, elCvName, elCvId, elStockName, elStockId, elAgentName, elAgentId, elPayMethod, elNotes, elGrossAmount, elDiscount, elAmount];
  resetEls.forEach(el => { if (el) el.textContent = '–'; });
  if (itemsTableBody) itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">جاري تحميل اصناف المستند…</td></tr>';

  try {
    const res = await fetch(`/api/sales/document/${cashSer}`);
    if (!res.ok) throw new Error('Document not found');
    const json = await res.json();
    if (!json.success || !json.header) throw new Error(json.error || 'Failed to load document details');

    const header = json.header;
    const items = json.items || [];

    if (catBadge) catBadge.textContent = header.cash_cat_name || 'سند';
    if (elSer) elSer.textContent = String(header.cash_ser || '–');
    if (elDate) elDate.textContent = header.cash_date ? new Date(header.cash_date).toLocaleDateString('ar-SA') : '–';
    if (elCvName) elCvName.textContent = header.cash_cv_name || '–';
    if (elCvId) elCvId.textContent = header.cash_cv_id || '–';
    if (elStockName) elStockName.textContent = header.cash_stock_name || '–';
    if (elStockId) elStockId.textContent = header.cash_stock_id || '–';
    if (elAgentName) elAgentName.textContent = header.cash_agent_name || '–';
    if (elAgentId) elAgentId.textContent = header.cash_agent_id || '–';
    if (elPayMethod) elPayMethod.textContent = header.cash_pay_method || '–';
    if (elNotes) elNotes.textContent = header.cash_notes || '–';

    const amount = Number(header.cash_amount) || 0;
    const discount = Number(header.cash_discount) || 0;
    const grossAmount = amount + discount;

    if (elGrossAmount) elGrossAmount.textContent = grossAmount.toLocaleString('ar-SA');
    if (elDiscount) elDiscount.textContent = discount.toLocaleString('ar-SA');
    if (elAmount) elAmount.textContent = amount.toLocaleString('ar-SA');

    if (itemsTableBody) {
      if (items.length === 0) {
        itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">لا توجد اصناف مسجلة لهذا المستند</td></tr>';
      } else {
        itemsTableBody.innerHTML = items.map(item => {
          const qtyFormatted = item.item_qty != null ? Number(item.item_qty).toLocaleString('ar-SA') : '0';
          const priceFormatted = item.item_price != null ? Number(item.item_price).toLocaleString('ar-SA') : '0';
          const totFormatted = item.cd_tot != null ? Number(item.cd_tot).toLocaleString('ar-SA') : '0';

          return `
            <tr>
              <td><span class="cell-id">${escapeHtml(String(item.item_id || ''))}</span></td>
              <td class="cell-name">${escapeHtml(item.item_name || '–')}</td>
              <td>${escapeHtml(item.item_unit || '–')}</td>
              <td class="font-bold">${escapeHtml(qtyFormatted)}</td>
              <td>${escapeHtml(priceFormatted)}</td>
              <td class="font-bold" style="color: #38bdf8;">${escapeHtml(totFormatted)}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error opening document details view:', err);
    if (itemsTableBody) {
      itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">خطأ في تحميل اصناف المستند</td></tr>';
    }
  }
}

/**
 * Render sales invoices table rows & update counter badges
 * @param {Array} data 
 * @param {number} count 
 */
/**
 * Render sales documents table rows into #salesDocumentsTableBody
 * @param {Array} data 
 */
export function renderSalesDocumentsTable(data) {
  const tableBody = document.getElementById('salesDocumentsTableBody');
  if (!tableBody) return;

  if (!data || data.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" class="table-empty">لا توجد مستندات مسجلة</td></tr>';
    return;
  }

  tableBody.innerHTML = data.map(doc => {
    const formattedDate = doc.cash_date ? new Date(doc.cash_date).toLocaleDateString('ar-SA') : '–';
    const formattedAmount = doc.cash_amount != null ? Number(doc.cash_amount).toLocaleString('ar-SA') : '0';

    return `
      <tr>
        <td><a href="#" class="cell-id doc-link" data-ser="${escapeHtml(String(doc.cash_ser || ''))}" style="color: #38bdf8; text-decoration: underline; font-weight: 600; cursor: pointer;">${escapeHtml(String(doc.cash_ser || ''))}</a></td>
        <td dir="ltr" style="text-align:right">${escapeHtml(formattedDate)}</td>
        <td><span class="badge-cat" style="background: rgba(99, 102, 241, 0.12); color: #818cf8; padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">${escapeHtml(doc.cash_cat_name || '–')}</span></td>
        <td class="cell-name">${escapeHtml(doc.cash_cv_name || '–')}</td>
        <td class="font-bold">${escapeHtml(formattedAmount)}</td>
        <td class="cell-notes" title="${escapeHtml(doc.cash_notes || '')}">${escapeHtml(doc.cash_notes || '–')}</td>
      </tr>
    `;
  }).join('');
}

export function showSalesOverview() {
  const overview = document.getElementById('sales-overview');
  if (overview) overview.style.display = '';

  document.querySelectorAll('.sales-sub-view').forEach(v => v.style.display = 'none');

  const catSelect = document.getElementById('SalesDocCat');
  const searchInput = document.getElementById('salesDocumentSearch');
  const selectedCat = catSelect ? catSelect.value : '5';
  const searchText = searchInput ? searchInput.value.trim() : '';

  loadSalesDocuments(searchText, selectedCat);
}

export function openSalesSubView(subKey) {
  if (subKey !== 'doc-details') {
    lastDocSubKey = subKey;
  }

  const overview = document.getElementById('sales-overview');
  if (overview) overview.style.display = 'none';

  document.querySelectorAll('.sales-sub-view').forEach(v => v.style.display = 'none');

  const subView = document.getElementById('sales-sub-' + subKey);
  if (subView) {
    subView.style.display = '';

    if (subKey === 'customers') {
      loadCustomers();
    }
  }
}

export function initSalesModule() {
  const salesDocCatSelect = document.getElementById('SalesDocCat');
  const salesDocSearchInput = document.getElementById('salesDocumentSearch');

  // Document link click handler delegation (in-page drilldown view)
  document.addEventListener('click', (e) => {
    const docLink = e.target.closest('.doc-link');
    if (docLink) {
      e.preventDefault();
      const ser = docLink.dataset.ser;
      if (ser) openDocumentDetailsView(ser);
    }
  });

  // Reset to overview when section changes to sales
  onSectionChange((sectionId) => {
    if (sectionId === 'sales') {
      showSalesOverview();
    }
  });

  // Listener on #SalesDocCat change event (document delegation)
  document.addEventListener('change', (e) => {
    if (e.target && (e.target.id === 'SalesDocCat' || e.target.name === 'SalesDocCat')) {
      const selectedCat = e.target.value;
      const searchInput = document.getElementById('salesDocumentSearch');
      const search = searchInput ? searchInput.value.trim() : '';
      loadSalesDocuments(search, selectedCat);
    }
  });

  // Direct element listener as fallback
  if (salesDocCatSelect) {
    salesDocCatSelect.addEventListener('change', () => {
      const selectedCat = salesDocCatSelect.value;
      const search = salesDocSearchInput ? salesDocSearchInput.value.trim() : '';
      loadSalesDocuments(search, selectedCat);
    });
  }

  // Search input debounce listener
  if (salesDocSearchInput) {
    salesDocSearchInput.addEventListener('input', debounce(() => {
      const catSelect = document.getElementById('SalesDocCat');
      const selectedCat = catSelect ? catSelect.value : '5';
      loadSalesDocuments(salesDocSearchInput.value.trim(), selectedCat);
    }, 300));
  }

  // Back button handlers
  document.querySelectorAll('.btn-back-sales').forEach(btn => {
    btn.addEventListener('click', () => {
      showSalesOverview();
    });
  });

  const btnBackToSales = document.getElementById('btnBackToSales');
  if (btnBackToSales) {
    btnBackToSales.addEventListener('click', () => showSalesOverview());
  }

  // Back from doc details → return to main overview list
  const btnBackFromDocDetails = document.getElementById('btnBackFromDocDetails');
  if (btnBackFromDocDetails) {
    btnBackFromDocDetails.addEventListener('click', () => {
      showSalesOverview();
    });
  }

  // "إضافة مستند" buttons → open in-page create view
  document.querySelectorAll('.btn-create-sales-doc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateDocView();
    });
  });

  // Initial load if overview is visible
  loadSalesDocuments('', salesDocCatSelect ? salesDocCatSelect.value : '5');

  // ── Create-Doc In-Page View ──────────────────────────────
  initCreateDocView();
}


// ─────────────────────────────────────────────────────────────
//  Searchable Combo Helper
// ─────────────────────────────────────────────────────────────

/**
 * Initialise a searchable combo box.
 * @param {object} opts
 *   inputEl     – text input element
 *   hiddenEl    – hidden id input element
 *   dropdownEl  – dropdown container element
 *   fetchUrl    – async fn(query) → [{id, name}]
 *   onSelect    – optional cb(id, name)
 */
function initCombo({ inputEl, hiddenEl, dropdownEl, fetchUrl, onSelect, portal = false }) {
  if (!inputEl || !dropdownEl) return;

  let debounceTimer = null;
  let allOptions = [];     // full result cache
  let focusIdx = -1;
  let isListeningScroll = false;

  // ── Portal mode: move dropdown to <body> so it's never clipped by overflow ──
  if (portal) {
    document.body.appendChild(dropdownEl);
    Object.assign(dropdownEl.style, {
      position: 'fixed',
      zIndex:   '9999',
      right:    'auto'
    });
  }

  function positionDropdown() {
    if (!portal || !dropdownEl.classList.contains('open')) return;
    const r = inputEl.getBoundingClientRect();

    // If input scrolls off screen, close dropdown
    if (r.bottom < 0 || r.top > window.innerHeight) {
      closeDropdown();
      return;
    }

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Minimum 240px width on mobile so text fits comfortably
    const width = Math.max(r.width, Math.min(320, viewportW - 20));

    // Clamp horizontal position within viewport
    let left = r.left;
    if (left + width > viewportW - 10) {
      left = Math.max(10, viewportW - width - 10);
    }
    if (left < 10) left = 10;

    // Calculate vertical position (flip above input if near bottom of screen)
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

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(re, '<em>$1</em>');
  }

  function renderOptions(data, q) {
    focusIdx = -1;
    if (!data.length) {
      dropdownEl.innerHTML = '<div class="combo-empty">لا توجد نتائج</div>';
    } else {
      dropdownEl.innerHTML = data.map((d, i) =>
        `<div class="combo-option" data-idx="${i}" data-id="${d.id}" data-name="${escapeHtml(d.name)}">
           <span>${highlight(d.name, q)}</span>
           <span class="opt-id">${d.id}</span>
         </div>`
      ).join('');

      dropdownEl.querySelectorAll('.combo-option').forEach(opt => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectOption(opt.dataset.id, opt.dataset.name);
        });
        opt.addEventListener('touchstart', (e) => {
          // Touch device instant response
          selectOption(opt.dataset.id, opt.dataset.name);
        }, { passive: true });
      });
    }
    openDropdown();
  }

  function selectOption(id, name) {
    inputEl.value = name;
    hiddenEl.value = id;
    closeDropdown();
    if (onSelect) onSelect(id, name);
  }

  function moveFocus(dir) {
    const opts = dropdownEl.querySelectorAll('.combo-option');
    if (!opts.length) return;
    if (focusIdx >= 0 && opts[focusIdx]) {
      opts[focusIdx].classList.remove('focused');
    }
    focusIdx = Math.max(0, Math.min(opts.length - 1, focusIdx + dir));
    const target = opts[focusIdx];
    if (target) {
      target.classList.add('focused');
      // Scroll strictly within dropdown container to avoid document window auto-scrolling
      const parent = dropdownEl;
      if (target.offsetTop < parent.scrollTop) {
        parent.scrollTop = target.offsetTop;
      } else if (target.offsetTop + target.offsetHeight > parent.scrollTop + parent.clientHeight) {
        parent.scrollTop = target.offsetTop + target.offsetHeight - parent.clientHeight;
      }
    }
  }

  async function doSearch(q) {
    try {
      const res = await fetch(fetchUrl(q));
      if (!res.ok) return;
      const json = await res.json();
      allOptions = (json.data || []).map(r => ({
        id:   r.cf_id ?? r.item_id,
        name: r.cf_t1 ?? r.item_name,
        unit: r.item_unit,
        price: r.item_sell_price1
      }));
      renderOptions(allOptions, q);
    } catch { /* silent */ }
  }

  inputEl.addEventListener('focus', () => {
    hiddenEl.value = '';
    doSearch(inputEl.value.trim());
  });

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    hiddenEl.value = '';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(q), 250);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (!dropdownEl.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const focused = dropdownEl.querySelector('.combo-option.focused');
      if (focused) selectOption(focused.dataset.id, focused.dataset.name);
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => closeDropdown(), 150);
  });

  return { selectOption, getAllOptions: () => allOptions };
}


// ─────────────────────────────────────────────────────────────
//  Create-Doc In-Page View
// ─────────────────────────────────────────────────────────────

let itemsRowData = [];   // [{item_id, item_name, item_unit, item_price, item_qty, cd_tot}]

export function openCreateDocView() {
  const overview = document.getElementById('sales-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.sales-sub-view').forEach(v => v.style.display = 'none');

  const view = document.getElementById('sales-sub-create-doc');
  if (!view) return;
  view.style.display = '';

  // Reset form
  itemsRowData = [];
  document.getElementById('createDocItemsBody').innerHTML = '';
  document.getElementById('newDocDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('newDocCvSearch').value = '';
  document.getElementById('newDocCvId').value = '';
  document.getElementById('newDocStockSearch').value = '';
  document.getElementById('newDocStockId').value = '';
  document.getElementById('newDocDiscount').value = '0';
  document.getElementById('newDocNotes').value = '';
  document.getElementById('newDocCat').selectedIndex = 0;
  document.getElementById('newDocPayMethod').selectedIndex = 0;
  updateCreateDocTotals();

  // Add one empty row to start
  addItemRow();
}

function initCreateDocView() {
  // Customer combo
  initCombo({
    inputEl:    document.getElementById('newDocCvSearch'),
    hiddenEl:   document.getElementById('newDocCvId'),
    dropdownEl: document.getElementById('customerComboDropdown'),
    fetchUrl:   q => `/api/customers/search?q=${encodeURIComponent(q)}`
  });

  // Warehouse combo
  initCombo({
    inputEl:    document.getElementById('newDocStockSearch'),
    hiddenEl:   document.getElementById('newDocStockId'),
    dropdownEl: document.getElementById('warehouseComboDropdown'),
    fetchUrl:   q => `/api/warehouses/search?q=${encodeURIComponent(q)}`
  });

  // Discount → update totals
  const discountInput = document.getElementById('newDocDiscount');
  if (discountInput) {
    discountInput.addEventListener('input', updateCreateDocTotals);
  }

  // Add item row button
  const btnAddRow = document.getElementById('btnAddItemRow');
  if (btnAddRow) btnAddRow.addEventListener('click', addItemRow);

  // Save button
  const btnSave = document.getElementById('btnSaveNewDoc');
  if (btnSave) btnSave.addEventListener('click', saveNewDocument);
}

let _rowSeq = 0;

function addItemRow() {
  const rowId = ++_rowSeq;
  itemsRowData.push({ rowId, item_id: null, item_name: '', item_unit: '', item_price: 0, item_qty: 1, cd_tot: 0 });

  const tbody = document.getElementById('createDocItemsBody');
  const tr = document.createElement('tr');
  tr.dataset.rowId = rowId;
  tr.innerHTML = `
    <td>
      <div class="combo-wrapper" style="position:relative;">
        <input type="text" class="cell-input item-search-input"
          placeholder="ابحث بالاسم أو الكود…" autocomplete="off"
          data-row="${rowId}">
        <div class="combo-dropdown item-combo-dropdown" id="itemDrop_${rowId}"></div>
      </div>
    </td>
    <td><span class="item-unit-cell" style="color:var(--text-muted);font-size:12px;">–</span></td>
    <td><input type="number" class="cell-input item-qty-input" value="1" min="0.001" step="any" dir="ltr" data-row="${rowId}"></td>
    <td><input type="number" class="cell-input item-price-input" value="0" min="0" step="any" dir="ltr" data-row="${rowId}"></td>
    <td><span class="cell-tot item-tot-cell" id="rowTot_${rowId}">0.00</span></td>
    <td>
      <button type="button" class="btn-del-row" data-row="${rowId}" title="حذف">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Item search combo
  const searchInput = tr.querySelector('.item-search-input');
  const dropdownEl  = tr.querySelector('.item-combo-dropdown');
  const unitCell    = tr.querySelector('.item-unit-cell');
  const priceInput  = tr.querySelector('.item-price-input');
  const qtyInput    = tr.querySelector('.item-qty-input');

  const combo = initCombo({
    inputEl:    searchInput,
    hiddenEl:   { value: null },   // managed via onSelect
    dropdownEl,
    portal:     true,              // portal mode → never clipped by table overflow
    fetchUrl:   q => `/api/items/search?q=${encodeURIComponent(q)}`,
    onSelect:   (id, name) => {
      // Use the cached allOptions from the combo – no extra network round-trip
      const cached = combo.getAllOptions().find(o => String(o.id) === String(id));
      if (cached) {
        unitCell.textContent = cached.unit  || '–';
        priceInput.value     = cached.price || 0;
        updateRow(rowId, {
          item_id:    cached.id,
          item_name:  cached.name,
          item_unit:  cached.unit,
          item_price: cached.price || 0
        });
      }
    }
  });

  // qty / price change
  qtyInput.addEventListener('input', () => updateRow(rowId, { item_qty: parseFloat(qtyInput.value) || 0 }));
  priceInput.addEventListener('input', () => updateRow(rowId, { item_price: parseFloat(priceInput.value) || 0 }));

  // Delete row
  tr.querySelector('.btn-del-row').addEventListener('click', () => {
    itemsRowData = itemsRowData.filter(r => r.rowId !== rowId);
    tr.remove();
    updateCreateDocTotals();
  });
}

function updateRow(rowId, patch) {
  const row = itemsRowData.find(r => r.rowId === rowId);
  if (!row) return;
  Object.assign(row, patch);
  row.cd_tot = (row.item_price || 0) * (row.item_qty || 0);

  const totEl = document.getElementById(`rowTot_${rowId}`);
  if (totEl) totEl.textContent = row.cd_tot.toLocaleString('ar-SA', { minimumFractionDigits: 2 });

  updateCreateDocTotals();
}

function updateCreateDocTotals() {
  const gross    = itemsRowData.reduce((s, r) => s + (r.cd_tot || 0), 0);
  const discount = parseFloat(document.getElementById('newDocDiscount')?.value || 0);
  const net      = Math.max(0, gross - discount);

  const fmt = n => n.toLocaleString('ar-SA', { minimumFractionDigits: 2 });
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
  setEl('newDocGross', gross);
  setEl('newDocDiscountDisplay', discount);
  setEl('newDocNet', net);
}

async function saveNewDocument() {
  const catSelect   = document.getElementById('newDocCat');
  const cash_cat    = parseInt(catSelect?.value || 0);
  const cash_cat_name = catSelect?.options[catSelect.selectedIndex]?.dataset?.name || catSelect?.options[catSelect.selectedIndex]?.text || '';
  const cash_date   = document.getElementById('newDocDate')?.value || '';
  const cash_cv_id  = document.getElementById('newDocCvId')?.value;
  const cash_cv_name= document.getElementById('newDocCvSearch')?.value?.trim() || '';
  const cash_stock_id  = document.getElementById('newDocStockId')?.value || null;
  const cash_stock_name= document.getElementById('newDocStockSearch')?.value?.trim() || '';
  const cash_pay_method= document.getElementById('newDocPayMethod')?.value || '';
  const cash_discount  = parseFloat(document.getElementById('newDocDiscount')?.value || 0);
  const cash_notes     = document.getElementById('newDocNotes')?.value?.trim() || '';

  // Validation
  if (!cash_cat || !cash_date || !cash_cv_id) {
    showToast('يرجى تحديد نوع المستند، التاريخ، والعميل', 'error');
    return;
  }

  const validItems = itemsRowData.filter(r => r.item_id && r.item_qty > 0);
  if (!validItems.length) {
    showToast('يجب إضافة صنف واحد على الأقل بكمية صحيحة', 'error');
    return;
  }

  const btnSave = document.getElementById('btnSaveNewDoc');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'جاري الحفظ…'; }

  try {
    const payload = {
      cash_cat, cash_cat_name, cash_date,
      cash_cv_id: parseInt(cash_cv_id), cash_cv_name,
      cash_stock_id: cash_stock_id ? parseInt(cash_stock_id) : null,
      cash_stock_name, cash_pay_method, cash_discount, cash_notes,
      items: validItems.map(r => ({
        item_id: r.item_id,
        item_price: r.item_price,
        item_qty: r.item_qty,
        cd_tot: r.cd_tot
      }))
    };

    const res = await fetch('/api/sales/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (!res.ok || !json.success) throw new Error(json.error || 'فشل الحفظ');

    showToast(json.message, 'success');

    // Open the newly created document details view
    if (json.cash_ser) {
      setTimeout(() => openDocumentDetailsView(json.cash_ser), 600);
    } else {
      showSalesOverview();
    }
  } catch (err) {
    console.error('Save document error:', err);
    showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
  } finally {
    if (btnSave) { btnSave.disabled = false; btnSave.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> حفظ المستند`; }
  }
}
