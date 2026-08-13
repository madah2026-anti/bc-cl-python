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
