// ============================================================
// modules/customers.js – Customers (أسماء العملاء) CRUD Module
// ============================================================

import { escapeHtml, debounce } from '../utils/helpers.js';
import { showToast } from '../utils/toast.js';
import { openModal, closeModal } from '../utils/modal.js';
import { clearMasterDataCache } from './sales.js';

let customersData = [];
let deleteTargetId = null;

/**
 * Fetch customers data from backend API
 * @param {string} search 
 */
export async function loadCustomers(search = '') {
  const customerTableBody = document.getElementById('customersTableBody');
  if (!customerTableBody) return;

  customerTableBody.innerHTML = '<tr><td colspan="8" class="table-loading">جاري تحميل البيانات…</td></tr>';

  try {
    let url = '/api/customers';
    if (search) url += '?search=' + encodeURIComponent(search);

    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();

    if (!json.success) throw new Error(json.error);

    customersData = json.data || [];
    const customerCount = json.cnt !== undefined ? json.cnt : customersData.length;
    renderCustomersTable(customersData, customerCount);
  } catch (err) {
    console.error('Load customers error:', err);
    customerTableBody.innerHTML = '<tr><td colspan="8" class="table-empty">خطأ في تحميل البيانات</td></tr>';
  }
}

/**
 * Render customer table rows & update counter badges
 * @param {Array} data 
 * @param {number} count 
 */
export function renderCustomersTable(data, count) {
  const customerTableBody = document.getElementById('customersTableBody');
  const customersCountEl = document.getElementById('customersCount');
  const customerSearch = document.getElementById('customerSearch');
  const salesSubCustEl = document.getElementById('salesSubCustomersCount');

  if (!customerTableBody) return;

  const displayCount = count !== undefined ? count : data.length;
  if (customersCountEl) {
    customersCountEl.textContent = displayCount.toLocaleString('ar-SA');
  }
  if (salesSubCustEl && (!customerSearch || !customerSearch.value.trim())) {
    salesSubCustEl.textContent = displayCount.toLocaleString('ar-SA');
  }

  if (data.length === 0) {
    customerTableBody.innerHTML = '<tr><td colspan="8" class="table-empty">لا توجد بيانات</td></tr>';
    return;
  }

  customerTableBody.innerHTML = data.map(c => `
    <tr data-id="${c.cf_id}">
      <td class="cell-id">${c.cf_id}</td>
      <td class="cell-name">${escapeHtml(c.cf_t1 || '')}</td>
      <td>${escapeHtml(c.cf_t2 || '')}</td>
      <td>${escapeHtml(c.cf_t3 || '')}</td>
      <td dir="ltr" style="text-align:right">${escapeHtml(c.cf_t5 || '')}</td>
      <td class="cell-muted">${c.cf_n1 != null ? c.cf_n1 : '–'}</td>
      <td class="cell-notes" title="${escapeHtml(c.cf_t4 || '')}">${escapeHtml(c.cf_t4 || '–')}</td>
      <td>
        <div class="table-actions">
          <button class="btn-table-edit" title="تعديل" data-edit="${c.cf_id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-table-delete" title="حذف" data-delete="${c.cf_id}" data-name="${escapeHtml(c.cf_t1 || '')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach action button click listeners
  customerTableBody.querySelectorAll('.btn-table-edit').forEach(btn => {
    btn.addEventListener('click', () => openEditCustomer(parseInt(btn.dataset.edit, 10)));
  });

  customerTableBody.querySelectorAll('.btn-table-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteConfirm(parseInt(btn.dataset.delete, 10), btn.dataset.name));
  });
}

function openEditCustomer(cfId) {
  const customerModalOverlay = document.getElementById('customerModalOverlay');
  const customerModalTitle = document.getElementById('customerModalTitle');
  const customerEditId = document.getElementById('customerEditId');

  const customer = customersData.find(c => c.cf_id === cfId);
  if (!customer) return;

  if (customerModalTitle) customerModalTitle.textContent = 'تعديل بيانات العميل';
  if (customerEditId) customerEditId.value = cfId;

  const custName = document.getElementById('custName');
  const custGov = document.getElementById('custGovernorate');
  const custCity = document.getElementById('custCity');
  const custMobile = document.getElementById('custMobile');
  const custAgent = document.getElementById('custAgentId');
  const custNotes = document.getElementById('custNotes');

  if (custName) custName.value = customer.cf_t1 || '';
  if (custGov) custGov.value = customer.cf_t2 || '';
  if (custCity) custCity.value = customer.cf_t3 || '';
  if (custMobile) custMobile.value = customer.cf_t5 || '';
  if (custAgent) custAgent.value = customer.cf_n1 != null ? customer.cf_n1 : '';
  if (custNotes) custNotes.value = customer.cf_t4 || '';

  openModal(customerModalOverlay);
}

function openDeleteConfirm(cfId, name) {
  deleteTargetId = cfId;
  const deleteCustomerName = document.getElementById('deleteCustomerName');
  const deleteModalOverlay = document.getElementById('deleteModalOverlay');

  if (deleteCustomerName) deleteCustomerName.textContent = name || cfId;
  openModal(deleteModalOverlay);
}

/**
 * Initialize Customers module UI event listeners
 */
export function initCustomersModule() {
  const customerSearch = document.getElementById('customerSearch');
  const btnAddCustomer = document.getElementById('btnAddCustomer');
  const customerModalOverlay = document.getElementById('customerModalOverlay');
  const customerModalTitle = document.getElementById('customerModalTitle');
  const customerForm = document.getElementById('customerForm');
  const customerEditId = document.getElementById('customerEditId');
  const customerModalClose = document.getElementById('customerModalClose');
  const customerModalCancel = document.getElementById('customerModalCancel');

  const deleteModalOverlay = document.getElementById('deleteModalOverlay');
  const deleteCancelBtn = document.getElementById('deleteCancelBtn');
  const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

  // Search input debounce listener
  if (customerSearch) {
    customerSearch.addEventListener('input', debounce(() => {
      loadCustomers(customerSearch.value.trim());
    }, 300));
  }

  // Add customer button
  if (btnAddCustomer) {
    btnAddCustomer.addEventListener('click', () => {
      if (customerModalTitle) customerModalTitle.textContent = 'إضافة عميل جديد';
      if (customerEditId) customerEditId.value = '';
      if (customerForm) customerForm.reset();
      openModal(customerModalOverlay);
    });
  }

  // Save form handler (Create / Update)
  if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const editId = customerEditId ? customerEditId.value : '';
      const payload = {
        cf_t1: document.getElementById('custName')?.value || '',
        cf_t2: document.getElementById('custGovernorate')?.value || '',
        cf_t3: document.getElementById('custCity')?.value || '',
        cf_t4: document.getElementById('custNotes')?.value || '',
        cf_t5: document.getElementById('custMobile')?.value || '',
        cf_n1: document.getElementById('custAgentId')?.value || null,
      };

      const saveBtn = document.getElementById('customerSaveBtn');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ…'; }

      try {
        const url = editId ? `/api/customers/${editId}` : '/api/customers';
        const method = editId ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          showToast(json.error || 'حدث خطأ', 'error');
          return;
        }

        showToast(json.message, 'success');
        clearMasterDataCache('customers');
        closeModal(customerModalOverlay);
        loadCustomers(customerSearch ? customerSearch.value.trim() : '');
      } catch (err) {
        console.error('Save customer error:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            حفظ`;
        }
      }
    });
  }

  // Delete confirm handler
  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener('click', async () => {
      if (!deleteTargetId) return;

      deleteConfirmBtn.disabled = true;
      deleteConfirmBtn.textContent = 'جاري الحذف…';

      try {
        const res = await fetch(`/api/customers/${deleteTargetId}`, { method: 'DELETE' });
        const json = await res.json();

        if (!res.ok || !json.success) {
          showToast(json.error || 'حدث خطأ', 'error');
          return;
        }

        showToast(json.message, 'success');
        clearMasterDataCache('customers');
        closeModal(deleteModalOverlay);
        loadCustomers(customerSearch ? customerSearch.value.trim() : '');
      } catch (err) {
        console.error('Delete customer error:', err);
        showToast('خطأ في الاتصال بالخادم', 'error');
      } finally {
        deleteConfirmBtn.disabled = false;
        deleteConfirmBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          حذف`;
        deleteTargetId = null;
      }
    });
  }

  // Modal close buttons
  [customerModalClose, customerModalCancel].forEach(btn => {
    if (btn) btn.addEventListener('click', () => closeModal(customerModalOverlay));
  });

  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener('click', () => closeModal(deleteModalOverlay));
  }
}
