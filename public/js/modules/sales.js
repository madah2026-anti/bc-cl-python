// ============================================================
// modules/sales.js – Sales Section Sub-View Navigation & Invoices Module
// ============================================================

import { escapeHtml, debounce } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';
import { onSectionChange, closeMobileSidebar } from '../core/navigation.js';
import { loadCustomers } from './customers.js';
import { openModal, closeModal } from '../utils/modal.js';

let salesDocumentsData = [];
let currentSalesDocDetails = null;

function formatDateSafe(val) {
  if (!val) return '–';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toISOString().split('T')[0];
  } catch (_) {
    return String(val);
  }
}

function formatNum(val) {
  const n = Number(val);
  if (isNaN(n)) return '0';
  try {
    return n.toLocaleString('ar-SA');
  } catch (_) {
    return n.toLocaleString();
  }
}

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
    let url = `/api/documents?cat=${encodeURIComponent(cat)}`;
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
  if (itemsTableBody) itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-loading">جاري تحميل أصناف المستند…</td></tr>';

  try {
    const res = await fetch(`/api/document/${cashSer}`);
    if (!res.ok) throw new Error('Document not found');
    const json = await res.json();
    if (!json.success || !json.header) throw new Error(json.error || 'Failed to load document details');

    const header = json.header;
    const items = json.items || [];
    currentSalesDocDetails = { header, items };

    if (catBadge) catBadge.textContent = header.cash_cat_name || 'سند';
    if (elSer) elSer.textContent = String(header.cash_ser || '–');
    if (elDate) elDate.textContent = formatDateSafe(header.cash_date);
    if (elCvName) elCvName.textContent = header.cash_cv_name || '–';
    if (elCvId) elCvId.textContent = header.cash_cv_id ? String(header.cash_cv_id) : '–';
    if (elStockName) elStockName.textContent = header.cash_stock_name || '–';
    if (elStockId) elStockId.textContent = header.cash_stock_id ? String(header.cash_stock_id) : '–';
    if (elAgentName) elAgentName.textContent = header.cash_agent_name || '–';
    if (elAgentId) elAgentId.textContent = header.cash_agent_id ? String(header.cash_agent_id) : '–';
    if (elPayMethod) elPayMethod.textContent = header.cash_pay_method || '–';
    if (elNotes) elNotes.textContent = header.cash_notes || '–';

    const amount = Number(header.cash_amount) || 0;
    const discount = Number(header.cash_discount) || 0;
    const grossAmount = amount + discount;

    if (elGrossAmount) elGrossAmount.textContent = formatNum(grossAmount);
    if (elDiscount) elDiscount.textContent = formatNum(discount);
    if (elAmount) elAmount.textContent = formatNum(amount);

    // Update Post & Edit button state based on cash_posted
    const isPosted = (Number(header.cash_posted) || 0) >= 7;
    const btnPost = document.getElementById('btnPostSalesDoc');
    const btnEdit = document.getElementById('btnEditSalesDoc');

    if (btnPost) {
      if (isPosted) {
        btnPost.disabled = true;
        btnPost.style.opacity = '0.5';
        btnPost.style.cursor = 'not-allowed';
        btnPost.title = 'المستند مرحل بالفعل';
      } else {
        btnPost.disabled = false;
        btnPost.style.opacity = '1';
        btnPost.style.cursor = 'pointer';
        btnPost.title = 'ترحيل المستند';
      }
    }

    if (btnEdit) {
      if (isPosted) {
        btnEdit.style.opacity = '0.5';
        btnEdit.title = 'المستند مرحل ولا يمكن تعديله';
      } else {
        btnEdit.style.opacity = '1';
        btnEdit.title = 'تعديل المستند';
      }
    }

    if (itemsTableBody) {
      if (items.length === 0) {
        itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">لا توجد أصناف مسجلة لهذا المستند</td></tr>';
      } else {
        itemsTableBody.innerHTML = items.map((item, idx) => {
          const rowNo = item.row_no || (idx + 1);
          const qtyFormatted = item.item_qty != null ? formatNum(item.item_qty) : '0';
          const priceFormatted = item.item_price != null ? formatNum(item.item_price) : '0';
          const totFormatted = item.cd_tot != null ? formatNum(item.cd_tot) : '0';

          return `
            <tr>
              <td><span class="cell-id" style="color: var(--text-muted); font-weight: 500;">${rowNo}</span></td>
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
    if (catBadge) catBadge.textContent = 'خطأ';
    if (itemsTableBody) {
      itemsTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">خطأ في تحميل أصناف المستند</td></tr>';
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
    const formattedDate = formatDateSafe(doc.cash_date);
    const formattedAmount = doc.cash_amount != null ? formatNum(doc.cash_amount) : '0';

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

  // Listener on #SalesDocCat change event
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

  // "إضافة مستند" buttons → open in-page create view
  document.querySelectorAll('.btn-create-sales-doc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCreateDocView();
    });
  });

  // Edit button in details view
  const btnEditSalesDoc = document.getElementById('btnEditSalesDoc');
  if (btnEditSalesDoc) {
    btnEditSalesDoc.addEventListener('click', () => {
      if (currentSalesDocDetails) {
        openCreateDocView(currentSalesDocDetails);
      }
    });
  }

  // Delete button in details view
  const btnDeleteSalesDoc = document.getElementById('btnDeleteSalesDoc');
  if (btnDeleteSalesDoc) {
    btnDeleteSalesDoc.addEventListener('click', async () => {
      if (!currentSalesDocDetails || !currentSalesDocDetails.header) return;
      const ser = currentSalesDocDetails.header.cash_ser;

      const confirmed = confirm(`هل أنت متاكد من حذف المستند رقم (${ser})؟`);
      if (!confirmed) return;

      btnDeleteSalesDoc.disabled = true;
      try {
        const res = await fetch(`/api/document/${ser}`, { method: 'DELETE' });
        const json = await res.json();

        if (!res.ok || !json.success) {
          showToast(json.error || 'حدث خطأ أثناء حذف المستند', 'error');
          return;
        }

        showToast(json.message || 'تم حذف المستند بنجاح', 'success');

        showSalesOverview();
        const catSel = document.getElementById('salesDocCatSelect');
        const searchInput = document.getElementById('salesDocSearchInput');
        loadSalesDocuments(searchInput ? searchInput.value.trim() : '', catSel ? catSel.value : '5');
      } catch (err) {
        console.error('Delete doc error:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
      } finally {
        btnDeleteSalesDoc.disabled = false;
      }
    });
  }

  // Post button in details view
  const btnPostSalesDoc = document.getElementById('btnPostSalesDoc');
  if (btnPostSalesDoc) {
    btnPostSalesDoc.addEventListener('click', async () => {
      if (!currentSalesDocDetails || !currentSalesDocDetails.header) return;
      const ser = currentSalesDocDetails.header.cash_ser;

      const confirmed = confirm(`هل أنت متاكد من ترحيل المستند رقم (${ser})؟`);
      if (!confirmed) return;

      btnPostSalesDoc.disabled = true;
      try {
        const res = await fetch(`/api/document/post/${ser}`, { method: 'POST' });
        const json = await res.json();

        if (!res.ok || !json.success) {
          showToast(json.error || 'حدث خطأ أثناء ترحيل المستند', 'error');
          return;
        }

        showToast(json.message || 'تم ترحيل المستند بنجاح', 'success');

        openDocumentDetailsView(ser);
        const catSel = document.getElementById('salesDocCatSelect');
        const searchInput = document.getElementById('salesDocSearchInput');
        loadSalesDocuments(searchInput ? searchInput.value.trim() : '', catSel ? catSel.value : '5');
      } catch (err) {
        console.error('Post doc error:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
      } finally {
        btnPostSalesDoc.disabled = false;
      }
    });
  }

  // Print button in details view
  const btnPrintSalesDoc = document.getElementById('btnPrintSalesDoc');
  if (btnPrintSalesDoc) {
    btnPrintSalesDoc.addEventListener('click', () => {
      if (currentSalesDocDetails && currentSalesDocDetails.header) {
        generateSalesDocumentPDF(currentSalesDocDetails);
      } else {
        showToast('لا توجد بيانات مستند للطباعة', 'error');
      }
    });
  }

  // Initial load if overview is visible
  loadSalesDocuments('', salesDocCatSelect ? salesDocCatSelect.value : '5');

  // ── Create-Doc In-Page View ──────────────────────────────
  preloadMasterData();
  initCreateDocView();
}


// ── Master Datasets Memory Cache ──────────────────────────────
let masterCustomers = null;
let masterItems = null;
let masterWarehouses = null;
let isPreloadingMasterData = false;

export async function preloadMasterData() {
  if (isPreloadingMasterData) return;
  isPreloadingMasterData = true;

  const fetchPromises = [];

  if (!masterCustomers) {
    fetchPromises.push(
      fetch('/api/customers/search?q=&limit=10000')
        .then(res => res.json())
        .then(json => { if (json.success) masterCustomers = json.data || []; })
        .catch(err => console.error('Error preloading customers cache:', err))
    );
  }

  if (!masterItems) {
    fetchPromises.push(
      fetch('/api/items/search?q=&limit=10000')
        .then(res => res.json())
        .then(json => { if (json.success) masterItems = json.data || []; })
        .catch(err => console.error('Error preloading items cache:', err))
    );
  }

  if (!masterWarehouses) {
    fetchPromises.push(
      fetch('/api/warehouses/search?q=&limit=10000')
        .then(res => res.json())
        .then(json => { if (json.success) masterWarehouses = json.data || []; })
        .catch(err => console.error('Error preloading warehouses cache:', err))
    );
  }

  await Promise.all(fetchPromises);
  isPreloadingMasterData = false;
}

export function clearMasterDataCache(type = 'all') {
  if (type === 'all' || type === 'customers') masterCustomers = null;
  if (type === 'all' || type === 'items') masterItems = null;
  if (type === 'all' || type === 'warehouses') masterWarehouses = null;
}

async function filterCustomersCache(q) {
  if (!masterCustomers) await preloadMasterData();
  const cleanQ = (q || '').trim().toLowerCase();
  const data = masterCustomers || [];
  if (!cleanQ) return data.slice(0, 80);
  return data.filter(c =>
    (c.cf_t1 && c.cf_t1.toLowerCase().includes(cleanQ)) ||
    String(c.cf_id).includes(cleanQ)
  ).slice(0, 80);
}

async function filterWarehousesCache(q) {
  if (!masterWarehouses) await preloadMasterData();
  const cat = document.getElementById('newDocCat')?.dataset?.value || document.getElementById('SalesDocCat')?.value || '';
  const cleanQ = (q || '').trim().toLowerCase();

  let list = masterWarehouses || [];
  if (cat) {
    list = list.filter(w => {
      if (!w.cf_t5) return false;
      const parts = String(w.cf_t5).split(',').map(s => s.trim()).filter(Boolean);
      return parts.includes(String(cat));
    });
  }

  if (!cleanQ) return list.slice(0, 80);
  return list.filter(w =>
    (w.cf_t1 && w.cf_t1.toLowerCase().includes(cleanQ)) ||
    String(w.cf_id).includes(cleanQ)
  ).slice(0, 80);
}

async function filterItemsCache(q) {
  if (!masterItems) await preloadMasterData();
  const cleanQ = (q || '').trim().toLowerCase();
  const data = masterItems || [];
  if (!cleanQ) return data.slice(0, 80);
  return data.filter(i =>
    (i.item_name && i.item_name.toLowerCase().includes(cleanQ)) ||
    String(i.item_id).includes(cleanQ)
  ).slice(0, 80);
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
 *   getLocalData – optional async fn(query) → [{cf_id/item_id, cf_t1/item_name}]
 *   onSelect    – optional cb(id, name)
 */
function initCombo({ inputEl, hiddenEl, dropdownEl, fetchUrl, getLocalData, onSelect, portal = false }) {
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
      zIndex: '9999',
      right: 'auto'
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
          const idx = parseInt(opt.dataset.idx);
          const item = allOptions[idx];
          selectOption(opt.dataset.id, opt.dataset.name, item ? item.raw : null);
        });
        opt.addEventListener('touchstart', (e) => {
          const idx = parseInt(opt.dataset.idx);
          const item = allOptions[idx];
          selectOption(opt.dataset.id, opt.dataset.name, item ? item.raw : null);
        }, { passive: true });
      });
    }
    openDropdown();
  }

  function selectOption(id, name, raw) {
    inputEl.value = name;
    hiddenEl.value = id;
    closeDropdown();
    if (onSelect) onSelect(id, name, raw);
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
      let rawData = [];
      if (getLocalData) {
        rawData = await getLocalData(q);
      } else if (fetchUrl) {
        const res = await fetch(fetchUrl(q));
        if (!res.ok) return;
        const json = await res.json();
        rawData = json.data || [];
      }
      allOptions = rawData.map(r => ({
        id: r.cf_id ?? r.item_id,
        name: r.cf_t1 ?? r.item_name,
        unit: r.item_unit,
        price: r.item_sell_price1,
        raw: r
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
    if (getLocalData) {
      doSearch(q);
    } else {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSearch(q), 250);
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (!dropdownEl.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const focused = dropdownEl.querySelector('.combo-option.focused');
      if (focused) {
        const idx = parseInt(focused.dataset.idx);
        const item = allOptions[idx];
        selectOption(focused.dataset.id, focused.dataset.name, item ? item.raw : null);
      }
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

// ── Warehouse Stock Cache ─────────────────────────────────────
// Maps stock_id → [{item_id, item_name, item_unit, item_sell_price1, cur_qty}]
let warehouseStockCache = {};   // populated on warehouse selection
let activeStockId = null;       // currently selected warehouse stock_id

/**
 * Fetch available stock for a warehouse from the server and cache it.
 * When ser is provided (edit mode) the server adds back existing doc quantities.
 * @param {number|string} stockId
 * @param {string|null} ser  – cash_ser when editing an existing document
 */
async function loadStockForWarehouse(stockId, ser = null) {
  if (!stockId) {
    activeStockId = null;
    return;
  }
  const id = parseInt(stockId);
  activeStockId = id;

  let url = `/api/stock/available?stock_id=${id}`;
  if (ser) url += `&ser=${encodeURIComponent(ser)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const json = await res.json();
    if (json.success) {
      warehouseStockCache[id] = json.data || [];
      // Re-validate all existing rows after stock reload
      document.querySelectorAll('.item-qty-input').forEach(input => {
        const rowId = parseInt(input.dataset.row);
        if (rowId) validateRowQty(rowId);
      });
    }
  } catch (err) {
    console.error('loadStockForWarehouse error:', err);
  }
}

/**
 * Filter items that have positive stock in the active warehouse.
 * Falls back to all items if no warehouse is selected or stock not yet loaded.
 * @param {string} q – search query
 */
async function filterItemsWithStock(q) {
  const stockList = activeStockId != null ? (warehouseStockCache[activeStockId] || null) : null;

  if (!stockList) {
    // No warehouse selected or stock not loaded yet – fall back to full item list
    return filterItemsCache(q);
  }

  const cleanQ = (q || '').trim().toLowerCase();

  // stockList items already have item_name, item_unit, item_sell_price1
  // Map them to the same shape filterItemsCache produces
  const mapped = stockList.map(s => ({
    item_id: s.item_id,
    item_name: s.item_name,
    item_unit: s.item_unit,
    item_sell_price1: s.item_sell_price1,

    cur_qty: s.cur_qty
  }));

  if (!cleanQ) return mapped.slice(0, 80);
  return mapped.filter(i =>
    (i.item_name && i.item_name.toLowerCase().includes(cleanQ)) ||
    String(i.item_id).includes(cleanQ)
  ).slice(0, 80);
}

/**
 * Validate the qty input for a given row against the warehouse stock.
 * Adds a visual indicator if quantity exceeds available stock.
 * @param {number} rowId
 */
function validateRowQty(rowId) {
  const row = itemsRowData.find(r => r.rowId === rowId);
  if (!row) return true;

  const qtyInput = document.querySelector(`.item-qty-input[data-row="${rowId}"]`);
  if (!qtyInput) return true;

  if (!activeStockId || !warehouseStockCache[activeStockId]) {
    qtyInput.classList.remove('qty-exceeded');
    qtyInput.removeAttribute('title');
    return true;
  }

  const stockItem = warehouseStockCache[activeStockId].find(s => String(s.item_id) === String(row.item_id));
  if (!stockItem) {
    // Item not in stock for this warehouse
    if (row.item_id) {
      qtyInput.classList.add('qty-exceeded');
      qtyInput.title = 'هذا الصنف غير متوفر في المستودع المحدد';
      return false;
    }
    qtyInput.classList.remove('qty-exceeded');
    qtyInput.removeAttribute('title');
    return true;
  }

  const available = stockItem.cur_qty;
  const requested = row.item_qty || 0;

  if (requested > available) {
    qtyInput.classList.add('qty-exceeded');
    qtyInput.title = `الكمية المطلوبة (${requested}) تتجاوز المتاح (${available.toLocaleString('ar-SA')})`;
    return false;
  }

  qtyInput.classList.remove('qty-exceeded');
  qtyInput.removeAttribute('title');
  return true;
}

/**
 * Calculate discount percentage based on cash_cat and cash_date
 * @param {string|number} cashCat 
 * @param {string} cashDate 
 * @returns {number} discount percentage (e.g., 20 for 20%)
 */
export function getDiscountPercentage(cashCat, cashDate) {
  const cat = parseInt(cashCat || 0, 10);

  // Category 55 (مبيعات قطعي) gets 0% discount
  if (cat === 55) {
    console.log('Discount percentage for category 55:', 0);
    return 0;
  }

  // All other categories (including default/unspecified) get 20% discount
  let percent = 20;

  if (cashDate) {
    const d = new Date(cashDate);
    // Can apply additional date-based discount rules here if needed
  }

  console.log(`Discount percentage for category ${cat}:`, percent);
  return percent;
}

if (typeof window !== 'undefined') {
  window.getDiscountPercentage = getDiscountPercentage;
}

function updateDiscountFromRules() {
  const newDocCatEl = document.getElementById('newDocCat');
  const salesDocCatSelect = document.getElementById('SalesDocCat');

  let cash_cat = newDocCatEl?.dataset?.value;
  if (!cash_cat || cash_cat === '0' || cash_cat === 'undefined') {
    cash_cat = salesDocCatSelect?.value || '5';
  }

  const cash_date = document.getElementById('newDocDate')?.value || '';

  const percent = getDiscountPercentage(cash_cat, cash_date);
  const discountInput = document.getElementById('newDocDiscountPercentInput') || document.getElementById('newDocDiscount');
  if (discountInput) {
    discountInput.value = percent;
  }
  updateCreateDocTotals();
}

let currentSalesDocDetails = null;
let editingSalesSer = null;

export function openCreateDocView(editData = null) {
  const overview = document.getElementById('sales-overview');
  if (overview) overview.style.display = 'none';
  document.querySelectorAll('.sales-sub-view').forEach(v => v.style.display = 'none');

  const view = document.getElementById('sales-sub-create-doc');
  if (!view) return;
  view.style.display = '';

  preloadMasterData();
  itemsRowData = [];
  document.getElementById('createDocItemsBody').innerHTML = '';

  // Reset warehouse stock state for the new doc session
  warehouseStockCache = {};
  activeStockId = null;

  const headerTitle = view.querySelector('.card-header h3');

  if (editData && editData.header) {
    const h = editData.header;
    editingSalesSer = h.cash_ser;
    if (headerTitle) {
      headerTitle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> تعديل المستند رقم #${h.cash_ser}`;
    }
    document.getElementById('newDocDate').value = h.cash_date ? String(h.cash_date).split('T')[0] : new Date().toISOString().split('T')[0];
    document.getElementById('newDocCvSearch').value = h.cash_cv_name || '';
    document.getElementById('newDocCvId').value = h.cash_cv_id || '';
    document.getElementById('newDocStockSearch').value = h.cash_stock_name || '';
    document.getElementById('newDocStockId').value = h.cash_stock_id || '';
    document.getElementById('newDocNotes').value = h.cash_notes || '';
    document.getElementById('newDocPayMethod').value = h.cash_pay_method || '';

    if (h.cash_agent_id || h.cash_agent_name) {
      setAgentInfo(h.cash_agent_id, h.cash_agent_name);
    } else if (h.cash_cv_id) {
      handleCustomerSelection(h.cash_cv_id);
    } else {
      setAgentInfo(null);
    }

    const newDocCatEl = document.getElementById('newDocCat');
    if (newDocCatEl) {
      newDocCatEl.textContent = h.cash_cat_name || '–';
      newDocCatEl.dataset.value = h.cash_cat;
    }

    const discountInput = document.getElementById('newDocDiscountPercentInput') || document.getElementById('newDocDiscount');
    if (discountInput) {
      const gross = (editData.items || []).reduce((s, r) => s + (Number(r.cd_tot) || ((Number(r.item_price) || 0) * (Number(r.item_qty) || 0))), 0);
      const discAmt = Number(h.cash_discount) || 0;
      const pct = gross > 0 ? (discAmt / gross * 100) : getDiscountPercentage(h.cash_cat, h.cash_date);
      discountInput.value = Math.round(pct * 100) / 100;
    }

    if (editData.items && editData.items.length) {
      editData.items.forEach(item => {
        addItemRow({
          item_id: item.item_id,
          item_name: item.item_name,
          item_unit: item.item_unit,
          item_price: Number(item.item_price) || 0,
          item_qty: Number(item.item_qty) || 1,
          cd_tot: Number(item.cd_tot) || 0
        });
      });
    } else {
      addItemRow();
    }

    // Load warehouse stock (with edit-mode effective qty) after items are rendered
    if (h.cash_stock_id) {
      loadStockForWarehouse(h.cash_stock_id, h.cash_ser);
    }
  } else {
    editingSalesSer = null;
    if (headerTitle) {
      headerTitle.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> إنشاء مستند جديد`;
    }
    document.getElementById('newDocDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('newDocCvSearch').value = '';
    document.getElementById('newDocCvId').value = '';
    document.getElementById('newDocStockSearch').value = '';
    document.getElementById('newDocStockId').value = '';
    document.getElementById('newDocNotes').value = '';
    setAgentInfo(null);
    const salesDocCatSelect = document.getElementById('SalesDocCat');
    const newDocCatEl = document.getElementById('newDocCat');
    if (newDocCatEl && salesDocCatSelect) {
      const selectedOpt = salesDocCatSelect.options[salesDocCatSelect.selectedIndex];
      newDocCatEl.textContent = selectedOpt ? selectedOpt.text : '–';
      newDocCatEl.dataset.value = salesDocCatSelect.value;
    }
    document.getElementById('newDocPayMethod').selectedIndex = 0;
    updateDiscountFromRules();
    addItemRow();
  }
}

const agentCache = {};

async function fetchAgentName(agentId) {
  if (!agentId) return null;
  if (agentCache[agentId]) return agentCache[agentId];
  try {
    const res = await fetch(`/api/agent/${agentId}`);
    const json = await res.json();
    if (json.success && json.data && json.data.agent_name) {
      agentCache[agentId] = json.data.agent_name;
      return json.data.agent_name;
    }
  } catch (err) {
    console.error('Error fetching agent name:', err);
  }
  return null;
}

async function setAgentInfo(agentId, agentName = null) {
  const elName = document.getElementById('newDocAgentName');
  const elId = document.getElementById('newDocAgentId');
  const elValId = document.getElementById('newDocAgentIdVal');
  const elValName = document.getElementById('newDocAgentNameVal');

  if (!agentId) {
    if (elName) elName.textContent = '–';
    if (elId) elId.textContent = '–';
    if (elValId) elValId.value = '';
    if (elValName) elValName.value = '';
    return;
  }

  if (elId) elId.textContent = agentId;
  if (elValId) elValId.value = agentId;

  if (agentName) {
    agentCache[agentId] = agentName;
    if (elName) elName.textContent = agentName;
    if (elValName) elValName.value = agentName;
    return;
  }

  const fetchedName = await fetchAgentName(agentId);
  const finalName = fetchedName || '–';
  if (elName) elName.textContent = finalName;
  if (elValName) elValName.value = fetchedName || '';
}

async function handleCustomerSelection(customerId, customerRaw = null) {
  if (!customerId) {
    await setAgentInfo(null);
    return;
  }
  let agentId = customerRaw ? customerRaw.cf_n1 : null;
  if (agentId == null) {
    if (!masterCustomers) await preloadMasterData();
    const cust = (masterCustomers || []).find(c => String(c.cf_id) === String(customerId));
    if (cust) agentId = cust.cf_n1;
  }
  await setAgentInfo(agentId);
}

function initCreateDocView() {
  // Customer combo
  initCombo({
    inputEl: document.getElementById('newDocCvSearch'),
    hiddenEl: document.getElementById('newDocCvId'),
    dropdownEl: document.getElementById('customerComboDropdown'),
    getLocalData: filterCustomersCache,
    onSelect: (id, name, raw) => {
      handleCustomerSelection(id, raw);
    }
  });

  // Warehouse combo
  initCombo({
    inputEl: document.getElementById('newDocStockSearch'),
    hiddenEl: document.getElementById('newDocStockId'),
    dropdownEl: document.getElementById('warehouseComboDropdown'),
    getLocalData: filterWarehousesCache,
    onSelect: (id) => {
      // Reset stock cache for the new warehouse and load fresh data
      warehouseStockCache = {};
      activeStockId = null;
      loadStockForWarehouse(id, editingSalesSer);
    }
  });

  // Date change -> update discount from rules & totals
  const dateInput = document.getElementById('newDocDate');
  if (dateInput) {
    dateInput.addEventListener('change', updateDiscountFromRules);
    dateInput.addEventListener('input', updateDiscountFromRules);
  }

  // Discount percent change -> update totals
  const discInput = document.getElementById('newDocDiscountPercentInput');
  if (discInput) {
    discInput.addEventListener('input', updateCreateDocTotals);
    discInput.addEventListener('change', updateCreateDocTotals);
  }

  // SalesDocCat change -> update discount from rules
  const salesDocCatSelect = document.getElementById('SalesDocCat');
  if (salesDocCatSelect) {
    salesDocCatSelect.addEventListener('change', () => {
      const newDocCatEl = document.getElementById('newDocCat');
      if (newDocCatEl) {
        const selectedOpt = salesDocCatSelect.options[salesDocCatSelect.selectedIndex];
        newDocCatEl.textContent = selectedOpt ? selectedOpt.text : '–';
        newDocCatEl.dataset.value = salesDocCatSelect.value;
      }
      updateDiscountFromRules();
    });
  }

  // Add item row button
  const btnAddRow = document.getElementById('btnAddItemRow');
  if (btnAddRow) btnAddRow.addEventListener('click', () => addItemRow());

  // Save button
  const btnSave = document.getElementById('btnSaveNewDoc');
  if (btnSave) btnSave.addEventListener('click', saveNewDocument);
}

let _rowSeq = 0;

function addItemRow(initialVal = null) {
  if (initialVal instanceof Event) initialVal = null;
  const isNewItem = !initialVal;

  const rowId = ++_rowSeq;
  itemsRowData.push({
    rowId,
    item_id: initialVal ? initialVal.item_id : null,
    item_name: initialVal ? initialVal.item_name : '',
    item_unit: initialVal ? initialVal.item_unit : '',
    item_price: initialVal ? (initialVal.item_price || 0) : 0,
    item_qty: initialVal ? (initialVal.item_qty || 1) : 1,
    cd_tot: initialVal ? (initialVal.cd_tot || ((initialVal.item_price || 0) * (initialVal.item_qty || 1))) : 0
  });

  const tbody = document.getElementById('createDocItemsBody');
  const tr = document.createElement('tr');
  tr.dataset.rowId = rowId;
  const currentCount = tbody ? tbody.querySelectorAll('tr').length + 1 : 1;
  const initPrice = initialVal ? initialVal.item_price : 0;
  const initQty = initialVal ? initialVal.item_qty : 1;
  const initTot = initialVal ? (initialVal.cd_tot || (initPrice * initQty)) : 0;

  tr.innerHTML = `
    <td class="row-num-cell" style="color:var(--text-muted);font-size:12px;text-align:center;font-weight:500;">${currentCount}</td>
    <td>
      <div class="combo-wrapper" style="position:relative;">
        <input type="text" class="cell-input item-search-input"
          placeholder="ابحث بالاسم أو الكود…" autocomplete="off"
          data-row="${rowId}" value="${escapeHtml(initialVal?.item_name || '')}">
        <div class="combo-dropdown item-combo-dropdown" id="itemDrop_${rowId}"></div>
      </div>
    </td>
    <td><span class="item-unit-cell" style="color:var(--text-muted);font-size:12px;">${escapeHtml(initialVal?.item_unit || '–')}</span></td>
    <td><input type="number" class="cell-input item-qty-input" value="${initQty}" min="0.001" step="any" dir="ltr" data-row="${rowId}"></td>
    <td><input type="number" class="cell-input item-price-input" value="${initPrice}" min="0" step="any" dir="ltr" data-row="${rowId}"></td>
    <td><span class="cell-tot item-tot-cell" id="rowTot_${rowId}">${initTot.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}</span></td>
    <td>
      <button type="button" class="btn-del-row" data-row="${rowId}" title="حذف">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Item search combo
  const searchInput = tr.querySelector('.item-search-input');
  const dropdownEl = tr.querySelector('.item-combo-dropdown');
  const unitCell = tr.querySelector('.item-unit-cell');
  const priceInput = tr.querySelector('.item-price-input');
  const qtyInput = tr.querySelector('.item-qty-input');

  const combo = initCombo({
    inputEl: searchInput,
    hiddenEl: { value: null },   // managed via onSelect
    dropdownEl,
    portal: true,              // portal mode → never clipped by table overflow
    getLocalData: filterItemsWithStock,
    onSelect: (id, name) => {
      // Use the cached allOptions from the combo – no extra network round-trip
      const cached = combo.getAllOptions().find(o => String(o.id) === String(id));
      if (cached) {
        unitCell.textContent = cached.unit || '–';
        priceInput.value = cached.price || 0;
        updateRow(rowId, {
          item_id: cached.id,
          item_name: cached.name,
          item_unit: cached.unit,
          item_price: cached.price || 0
        });
      }
    }
  });

  // qty / price change
  qtyInput.addEventListener('input', () => {
    updateRow(rowId, { item_qty: parseFloat(qtyInput.value) || 0 });
    validateRowQty(rowId);
  });
  priceInput.addEventListener('input', () => updateRow(rowId, { item_price: parseFloat(priceInput.value) || 0 }));

  // Delete row
  tr.querySelector('.btn-del-row').addEventListener('click', () => {
    itemsRowData = itemsRowData.filter(r => r.rowId !== rowId);
    tr.remove();
    updateCreateDocTotals();
    updateSalesRowNumbers();
  });

  if (isNewItem && searchInput) {
    setTimeout(() => {
      searchInput.focus();
    }, 50);
  }
}

function updateSalesRowNumbers() {
  const tbody = document.getElementById('createDocItemsBody');
  if (!tbody) return;
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((r, idx) => {
    const numCell = r.querySelector('.row-num-cell');
    if (numCell) numCell.textContent = idx + 1;
  });
}

function updateRow(rowId, patch) {
  const row = itemsRowData.find(r => r.rowId === rowId);
  if (!row) return;
  Object.assign(row, patch);
  row.cd_tot = (row.item_price || 0) * (row.item_qty || 0);

  const totEl = document.getElementById(`rowTot_${rowId}`);
  if (totEl) totEl.textContent = formatNum(row.cd_tot);

  updateCreateDocTotals();
}

function updateCreateDocTotals() {
  const gross = itemsRowData.reduce((s, r) => s + (r.cd_tot || 0), 0);
  const discountPercent = parseFloat(document.getElementById('newDocDiscountPercentInput')?.value || document.getElementById('newDocDiscount')?.value || 0);
  const discountAmount = gross * (discountPercent / 100);
  const net = Math.max(0, gross - discountAmount);

  const fmt = n => formatNum(n);
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
  setEl('newDocGross', gross);
  setEl('newDocDiscountDisplay', discountAmount);
  setEl('newDocNet', net);

  const percentLabel = document.getElementById('newDocDiscountPercentLabel');
  if (percentLabel) percentLabel.textContent = `${discountPercent}%`;
}

async function saveNewDocument() {
  const salesDocCatSelect = document.getElementById('SalesDocCat');
  const newDocCatEl = document.getElementById('newDocCat');
  const cash_cat = parseInt(newDocCatEl?.dataset?.value || salesDocCatSelect?.value || 0);
  const cash_cat_name = newDocCatEl?.textContent?.trim() || (salesDocCatSelect ? salesDocCatSelect.options[salesDocCatSelect.selectedIndex]?.text : '') || '';
  const cash_date = document.getElementById('newDocDate')?.value || '';
  const cash_cv_id = document.getElementById('newDocCvId')?.value;
  const cash_cv_name = document.getElementById('newDocCvSearch')?.value?.trim() || '';
  const cash_stock_id = document.getElementById('newDocStockId')?.value || null;
  const cash_stock_name = document.getElementById('newDocStockSearch')?.value?.trim() || '';
  const cash_pay_method = document.getElementById('newDocPayMethod')?.value || '';

  const cash_agent_id = document.getElementById('newDocAgentIdVal')?.value || null;
  const cash_agent_name = document.getElementById('newDocAgentNameVal')?.value || '';

  const gross_amount = itemsRowData.reduce((s, r) => s + (r.cd_tot || 0), 0);
  const cash_discount_percent = parseFloat(document.getElementById('newDocDiscountPercentInput')?.value || document.getElementById('newDocDiscount')?.value || 0);
  const cash_discount = gross_amount * (cash_discount_percent / 100);
  const cash_notes = document.getElementById('newDocNotes')?.value?.trim() || '';

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

  // ── Client-side pre-save stock check ──────────────────────────
  if (activeStockId && warehouseStockCache[activeStockId]) {
    const clientViolations = [];
    for (const r of validItems) {
      if (!r.item_id) continue;
      const stockItem = warehouseStockCache[activeStockId].find(s => String(s.item_id) === String(r.item_id));
      const available = stockItem ? stockItem.cur_qty : 0;
      if (r.item_qty > available) {
        clientViolations.push({ item_name: r.item_name || r.item_id, requested_qty: r.item_qty, cur_qty: available });
      }
    }
    if (clientViolations.length) {
      const lines = clientViolations.map(v =>
        `• ${v.item_name}: طلب ${v.requested_qty} / متاح ${v.cur_qty}`
      ).join('\n');
      showToast(`الكمية تتجاوز المخزون المتاح:\n${lines}`, 'error');
      return;
    }
  }

  const btnSave = document.getElementById('btnSaveNewDoc');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = 'جاري الحفظ…'; }

  try {
    const payload = {
      cash_cat, cash_cat_name, cash_date,
      cash_cv_id: parseInt(cash_cv_id), cash_cv_name,
      cash_stock_id: cash_stock_id ? parseInt(cash_stock_id) : null,
      cash_stock_name, cash_pay_method, cash_discount, cash_notes,
      cash_agent_id: cash_agent_id ? parseInt(cash_agent_id) : null,
      cash_agent_name,
      items: validItems.map((r, idx) => ({
        row_no: idx + 1,
        item_id: r.item_id,
        item_price: r.item_price,
        item_qty: r.item_qty,
        cd_tot: r.cd_tot
      }))
    };

    const url = editingSalesSer ? `/api/document/${editingSalesSer}` : '/api/document';
    const method = editingSalesSer ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (res.status === 422 && json.violations) {
      // Server-side stock violation details
      const lines = json.violations.map(v =>
        `• ${v.item_name}: طلب ${v.requested_qty} / متاح ${v.cur_qty}`
      ).join('\n');
      showToast(`تجاوز المخزون:\n${lines}`, 'error');
      // Re-highlight the exceeded qty inputs
      for (const v of json.violations) {
        const row = itemsRowData.find(r => String(r.item_id) === String(v.item_id));
        if (row) {
          const qtyInput = document.querySelector(`.item-qty-input[data-row="${row.rowId}"]`);
          if (qtyInput) {
            qtyInput.classList.add('qty-exceeded');
            qtyInput.title = `الكمية المطلوبة (${v.requested_qty}) تتجاوز المتاح (${v.cur_qty})`;
          }
        }
      }
      return;
    }

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


/**
 * Generate & open printable 3-page PDF document matching exact specifications
 * @param {Object} docDetails 
 */
export function generateSalesDocumentPDF(docDetails) {
  if (!docDetails || !docDetails.header) {
    showToast('بيانات المستند غير مكتملة للطباعة', 'error');
    return;
  }

  const header = docDetails.header;
  const items = docDetails.items || [];

  const cashSer = String(header.cash_ser || '');
  let docDate = '';
  if (header.cash_date) {
    const d = new Date(header.cash_date);
    docDate = isNaN(d.getTime()) ? String(header.cash_date) : d.toISOString().split('T')[0];
  }

  const cvId = String(header.cash_cv_id || '');
  const cvName = header.cash_cv_name || '';
  const cvPhone = header.customer_phone || '';
  const cvAddress = header.customer_address || '';
  const catName = header.cash_cat_name || 'عرض';
  const stockName = header.cash_stock_name || 'مخزن التسليم بيلا سيتى';

  const amount = Number(header.cash_amount) || 0;
  const discount = Number(header.cash_discount) || 0;
  const grossAmount = amount + discount;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'error');
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>مستند مبيعات #${cashSer}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      direction: rtl;
      color: #000;
      background: #fff;
      font-size: 13px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      width: 100%;
      min-height: 270mm;
      padding: 10px 5px;
      position: relative;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .page-break {
      page-break-after: always;
      break-after: page;
    }

    /* ── Header Banner ── */
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #b91c1c;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    .header-logo-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .logo-text-red {
      font-weight: 800;
      font-size: 26px;
      color: #b91c1c;
      letter-spacing: 1px;
    }

    .company-sub {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
    }

    .header-logo-left {
      text-align: left;
      direction: ltr;
    }

    .bella-title {
      font-weight: 800;
      font-size: 18px;
      color: #1e293b;
      font-family: serif;
    }

    .bella-sub {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
    }

    /* ── Document Title ── */
    .doc-title {
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      margin: 6px 0 14px 0;
      color: #000;
    }

    /* ── Meta Section ── */
    .doc-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.8;
    }

    .meta-col {
      display: flex;
      flex-direction: column;
    }

    .meta-col div span.lbl {
      display: inline-block;
      min-width: 90px;
    }

    /* ── Tables ── */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }

    .data-table th, .data-table td {
      border: 1px solid #000;
      padding: 5px 8px;
      text-align: center;
      font-size: 12px;
    }

    .data-table th {
      background-color: #f1f5f9;
      font-weight: 800;
      color: #000;
    }

    .data-table td.name-cell {
      text-align: right;
      font-weight: 700;
    }

    /* ── Totals Box (Page 1) ── */
    .page1-summary-block {
      display: flex;
      justify-content: flex-start;
      margin-top: 10px;
    }

    .totals-table {
      width: 220px;
      border-collapse: collapse;
    }

    .totals-table td {
      border: 1px solid #000;
      padding: 5px 10px;
      font-weight: 700;
      font-size: 13px;
    }

    .totals-table td.lbl {
      background-color: #f1f5f9;
      text-align: center;
      width: 90px;
    }

    .totals-table td.val {
      text-align: left;
      direction: ltr;
    }

    /* ── Page Footers ── */
    .footer-sign-block {
      margin-top: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-weight: 700;
    }

    .ack-block {
      margin-top: 25px;
      font-weight: 700;
      font-size: 13.5px;
    }

    .ack-lines {
      margin-top: 15px;
      line-height: 2.2;
    }

    .page-bottom-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #000;
      font-weight: 600;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      margin-top: auto;
    }
  </style>
</head>
<body>

  <!-- ════════════════ PAGE 1: بيان أسعار ════════════════ -->
  <div class="page page-break">
    <div>
      <div class="header-banner">
        <div class="header-logo-right">
          <div class="logo-text-red">بلاستي</div>
          <div class="company-sub">الشركة المصرية الإيطالية للصناعات الحديثة</div>
        </div>
        <div class="header-logo-left">
          <div class="bella-title">BELLA CITY</div>
          <div class="bella-sub">THE EGYPTIAN ITALIAN COMPANY FOR MODERN INDUSTRIES</div>
        </div>
      </div>

      <div class="doc-title">بيان أسعار</div>

      <div class="doc-meta">
        <div class="meta-col">
          <div><span class="lbl">رقم المستند :</span> ${cashSer}</div>
          <div><span class="lbl">رقم العميل :</span> ${cvId}</div>
          <div><span class="lbl">الهاتف :</span> ${cvPhone}</div>
          <div><span class="lbl">العنوان :</span> ${cvAddress}</div>
          <div><span class="lbl">المستند :</span> ${catName}</div>
        </div>
        <div class="meta-col" style="text-align: right;">
          <div><span class="lbl">التاريخ :</span> ${docDate}</div>
          <div><span class="lbl">الاسم :</span> ${cvName}</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 4%;">م</th>
            <th style="width: 16%;">كود الصنف</th>
            <th style="width: 38%;">اسم الصنف</th>
            <th style="width: 10%;">الوحدة</th>
            <th style="width: 10%;">الكمية</th>
            <th style="width: 10%;">السعر</th>
            <th style="width: 12%;">القيمة</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `
            <tr>
              <td>${it.row_no || (i + 1)}</td>
              <td>${it.item_id || ''}</td>
              <td class="name-cell">${it.item_name || ''}</td>
              <td>${it.item_unit || ''}</td>
              <td>${it.item_qty != null ? Number(it.item_qty) : 0}</td>
              <td>${it.item_price != null ? Number(it.item_price).toLocaleString('ar-EG', {minimumFractionDigits: 1, maximumFractionDigits: 3}) : '0'}</td>
              <td>${it.cd_tot != null ? Number(it.cd_tot).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="page1-summary-block">
        <table class="totals-table">
          <tr>
            <td class="lbl">الاجمالي</td>
            <td class="val">${grossAmount.toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
          <tr>
            <td class="lbl">الخصم</td>
            <td class="val">${discount.toLocaleString('ar-EG', {minimumFractionDigits: 1, maximumFractionDigits: 2})}</td>
          </tr>
          <tr>
            <td class="lbl">الصافي</td>
            <td class="val">${amount.toLocaleString('ar-EG', {minimumFractionDigits: 1, maximumFractionDigits: 2})}</td>
          </tr>
        </table>
      </div>

      <div class="footer-sign-block">
        <div>السادة / الشركة المصرية الإيطالية ... نوافق على عرض أسعاركم إلينا</div>
        <div>توقيع العميل</div>
      </div>
    </div>

    <div class="page-bottom-bar">
      <div>صفحة 1 من 1</div>
      <div dir="ltr">${timeStr}</div>
    </div>
  </div>


  <!-- ════════════════ PAGE 2: أذن صرف بضاعة (لا توجد علامة مائية) ════════════════ -->
  <div class="page page-break">
    <div>
      <div class="header-banner">
        <div class="header-logo-right">
          <div class="logo-text-red">بلاستي</div>
          <div class="company-sub">الشركة المصرية الإيطالية للصناعات الحديثة</div>
        </div>
        <div class="header-logo-left">
          <div class="bella-title">BELLA CITY</div>
          <div class="bella-sub">THE EGYPTIAN ITALIAN COMPANY FOR MODERN INDUSTRIES</div>
        </div>
      </div>

      <div class="doc-title">أذن صرف بضاعة (مبيعات بولي) : من مخزن التسليم ${stockName}</div>

      <div class="doc-meta">
        <div class="meta-col">
          <div><span class="lbl">رقم المستند :</span> ${cashSer}</div>
          <div><span class="lbl">رقم العميل :</span> ${cvId}</div>
          <div><span class="lbl">الهاتف :</span> ${cvPhone}</div>
          <div><span class="lbl">العنوان :</span> ${cvAddress}</div>
          <div><span class="lbl">المستند :</span> ${catName}</div>
        </div>
        <div class="meta-col" style="text-align: right;">
          <div><span class="lbl">التاريخ :</span> ${docDate}</div>
          <div><span class="lbl">الاسم :</span> ${cvName}</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 6%;">م</th>
            <th style="width: 20%;">كود الصنف</th>
            <th style="width: 50%;">اسم الصنف</th>
            <th style="width: 12%;">الوحدة</th>
            <th style="width: 12%;">الكمية</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `
            <tr>
              <td>${it.row_no || (i + 1)}</td>
              <td>${it.item_id || ''}</td>
              <td class="name-cell">${it.item_name || ''}</td>
              <td>${it.item_unit || ''}</td>
              <td>${it.item_qty != null ? Number(it.item_qty) : 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="page-bottom-bar">
      <div>صفحة 1 من 1</div>
      <div dir="ltr">${timeStr}</div>
    </div>
  </div>


  <!-- ════════════════ PAGE 3: أذن استلام بضاعة ════════════════ -->
  <div class="page">
    <div>
      <div class="header-banner">
        <div class="header-logo-right">
          <div class="logo-text-red">بلاستي</div>
          <div class="company-sub">الشركة المصرية الإيطالية للصناعات الحديثة</div>
        </div>
        <div class="header-logo-left">
          <div class="bella-title">BELLA CITY</div>
          <div class="bella-sub">THE EGYPTIAN ITALIAN COMPANY FOR MODERN INDUSTRIES</div>
        </div>
      </div>

      <div class="doc-title">أذن استلام بضاعة</div>

      <div class="doc-meta">
        <div class="meta-col">
          <div><span class="lbl">رقم المستند :</span> ${cashSer}</div>
          <div><span class="lbl">رقم العميل :</span> ${cvId}</div>
          <div><span class="lbl">الهاتف :</span> ${cvPhone}</div>
          <div><span class="lbl">العنوان :</span> ${cvAddress}</div>
        </div>
        <div class="meta-col" style="text-align: right;">
          <div><span class="lbl">التاريخ :</span> ${docDate}</div>
          <div><span class="lbl">الاسم :</span> ${cvName}</div>
        </div>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 6%;">م</th>
            <th style="width: 20%;">كود الصنف</th>
            <th style="width: 50%;">اسم الصنف</th>
            <th style="width: 12%;">الوحدة</th>
            <th style="width: 12%;">الكمية</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => `
            <tr>
              <td>${it.row_no || (i + 1)}</td>
              <td>${it.item_id || ''}</td>
              <td class="name-cell">${it.item_name || ''}</td>
              <td>${it.item_unit || ''}</td>
              <td>${it.item_qty != null ? Number(it.item_qty) : 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="ack-block">
        <p>أستلمت أنا الموقع أدناه البضاعة كاملة ومطابقة للمواصفات .</p>
        <div class="ack-lines">
          <div><strong>الأسم :</strong> .........................</div>
          <div><strong>التوقيع :</strong> .........................</div>
        </div>
      </div>
    </div>

    <div class="page-bottom-bar">
      <div>صفحة 1 من 1</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


