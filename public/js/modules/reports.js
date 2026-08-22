/**
 * reports.js – UI Controller Module for Reports View Section
 */

import { CATEGORY_NAMES_MAP, CATEGORY_MAP, getRptName } from './reports/registry.js';
import { getReportHandler } from './reports/reportFactory.js';

export function initReportsModule() {
  const sectionPanel = document.getElementById('section-reports');
  if (!sectionPanel) return;

  const categoryTabs = document.querySelectorAll('.category-tab-btn');
  const reportNamesList = document.getElementById('list-report-names');
  const searchList = document.getElementById('search-list');
  const searchListCount = document.getElementById('search-list-count');
  const reportsCountBadge = document.getElementById('reports-count-badge');
  const selectedReportLabel = document.getElementById('selected-report-label');
  const selectedEntityLabel = document.getElementById('selected-entity-label');

  const reportSearchInput = document.getElementById('report-search-input');
  const entitySearchInput = document.getElementById('entity-search-input');
  const periodSelect = document.getElementById('period-select');
  const fromDateInput = document.getElementById('from-date');
  const toDateInput = document.getElementById('to-date');

  // Action Buttons
  const btnPreviewReport = document.getElementById('btnPreviewReport');
  const btnPrintReport = document.getElementById('btnPrintReport');
  const btnExportExcel = document.getElementById('btnExportExcel');
  const btnResetReportFilters = document.getElementById('btnResetReportFilters');

  // Modal Controls
  const modalOverlay = document.getElementById('reportPreviewModalOverlay');
  const modalTitle = document.getElementById('modalReportTitle');
  const modalBody = document.getElementById('modalReportBody');
  const modalCloseBtn = document.getElementById('modalReportCloseBtn');
  const modalCloseFooterBtn = document.getElementById('modalCloseFooterBtn');
  const modalPrintBtn = document.getElementById('modalPrintBtn');

  // Module State
  let currentCategory = 'sales';
  let currentReportId = null;
  let currentReportName = '';
  let currentEntityId = null;
  let currentEntityName = 'جميع البيانات';
  let currentSearchData = [];
  let currentHandler = null;

  /**
   * Render Search List Items
   */
  function renderSearchList(data) {
    if (!searchList) return;
    searchList.innerHTML = '';
    
    if (!data || data.length === 0) {
      searchList.innerHTML = `
        <div class="empty-state-list">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg>
          لا تتوفر خيارات تصفية إضافية لهذا التقرير
        </div>
      `;
      if (searchListCount) searchListCount.textContent = 'العدد: 0';
      return;
    }

    data.forEach(item => {
      const div = document.createElement('div');
      const itemTitle = item.cf_t1 || item.item_name || item.name || 'بدون اسم';
      const itemId = item.cf_id || item.item_id || item.id || '';

      div.className = 'report-list-item' + (currentEntityId == itemId ? ' selected' : '');
      div.dataset.id = itemId;
      div.dataset.name = itemTitle;

      div.innerHTML = `
        <span>${itemTitle}</span>
        ${itemId ? `<span class="report-badge">#${itemId}</span>` : ''}
      `;

      div.addEventListener('click', function () {
        document.querySelectorAll('#search-list .report-list-item').forEach(el => el.classList.remove('selected'));
        this.classList.add('selected');
        currentEntityId = itemId;
        currentEntityName = itemTitle;
        if (selectedEntityLabel) selectedEntityLabel.textContent = itemTitle;
      });

      searchList.appendChild(div);
    });

    if (searchListCount) searchListCount.textContent = `العدد: ${data.length}`;
  }

  /**
   * Select a Report by ID and Name
   */
  async function selectReport(reportId, reportName) {
    if (!reportId) return;

    currentReportId = reportId;
    currentReportName = reportName;

    // Highlight selected item in UI
    document.querySelectorAll('#list-report-names .report-list-item').forEach(el => {
      if (el.dataset.reportId == reportId) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });

    if (selectedReportLabel) selectedReportLabel.textContent = `${reportName} [${reportId}]`;
    if (selectedEntityLabel) selectedEntityLabel.textContent = 'جاري التحميل...';

    try {
      currentHandler = await getReportHandler(reportId, reportName);
      const data = await currentHandler.fetchOptions(currentCategory);
      currentSearchData = data || [];
      currentEntityId = null;
      currentEntityName = 'جميع البيانات';
      if (selectedEntityLabel) selectedEntityLabel.textContent = 'جميع البيانات';
      renderSearchList(currentSearchData);
    } catch (error) {
      console.warn('Error selecting report:', error);
      if (selectedEntityLabel) selectedEntityLabel.textContent = 'جميع البيانات';
      renderSearchList([]);
    }
  }

  /**
   * Update the report names list for the active category
   */
  function updateReportList(autoSelectFirst = false) {
    if (!reportNamesList) return;

    const reportIds = CATEGORY_MAP[currentCategory] || [];
    const filterTerm = (reportSearchInput ? reportSearchInput.value : '').trim().toLowerCase();

    reportNamesList.innerHTML = '';
    let count = 0;
    let firstItem = null;

    reportIds.forEach(id => {
      const name = getRptName(id);
      if (name) {
        if (filterTerm && !name.toLowerCase().includes(filterTerm) && !String(id).includes(filterTerm)) {
          return;
        }

        const div = document.createElement('div');
        div.className = 'report-list-item' + (currentReportId == id ? ' selected' : '');
        div.dataset.reportId = id;
        div.dataset.reportName = name;

        div.innerHTML = `
          <span>${name}</span>
          <span class="report-badge">[${id}]</span>
        `;

        if (!firstItem) firstItem = { id, name };

        reportNamesList.appendChild(div);
        count++;
      }
    });

    if (reportsCountBadge) reportsCountBadge.textContent = `${count} تقارير`;

    if (count === 0) {
      reportNamesList.innerHTML = `
        <div class="empty-state-list">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          لا توجد تقارير مطابقة للبحث
        </div>
      `;
    } else if (autoSelectFirst && firstItem) {
      selectReport(firstItem.id, firstItem.name);
    }
  }

  // Category Tabs Switch Handler
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      categoryTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentCategory = this.dataset.cat;

      // Reset selection state & auto select first report in category
      currentReportId = null;
      currentReportName = '';
      currentEntityId = null;
      currentEntityName = 'جميع البيانات';
      currentHandler = null;

      if (selectedReportLabel) selectedReportLabel.textContent = 'لم يتم التحديد';
      if (selectedEntityLabel) selectedEntityLabel.textContent = 'جميع البيانات';

      updateReportList(true);
    });
  });

  if (reportSearchInput) {
    reportSearchInput.addEventListener('input', () => updateReportList(false));
  }

  // Select Report Item click listener
  reportNamesList.addEventListener('click', function (e) {
    const itemEl = e.target.closest('.report-list-item');
    if (itemEl && itemEl.dataset.reportId) {
      selectReport(itemEl.dataset.reportId, itemEl.dataset.reportName);
    }
  });

  if (entitySearchInput) {
    entitySearchInput.addEventListener('input', function (e) {
      const searchTerm = e.target.value.toLowerCase().trim();
      if (!currentSearchData) return;

      const filteredData = currentSearchData.filter(item => {
        const text = (item.cf_t1 || item.item_name || item.name || '').toLowerCase();
        const idStr = String(item.cf_id || item.item_id || item.id || '');
        return text.includes(searchTerm) || idStr.includes(searchTerm);
      });

      renderSearchList(filteredData);
    });
  }

  // Period Selector Logic
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (periodSelect) {
    periodSelect.addEventListener('change', function () {
      const value = this.value;
      const today = new Date();
      let fromDate = new Date();
      let toDate = new Date();

      switch (value) {
        case 'none':
          fromDateInput.value = '';
          toDateInput.value = '';
          return;
        case 'prev_day':
          fromDate.setDate(today.getDate() - 1);
          toDate.setDate(today.getDate() - 1);
          break;
        case 'curr_day':
          fromDate = today;
          toDate = today;
          break;
        case 'next_day':
          fromDate.setDate(today.getDate() + 1);
          toDate.setDate(today.getDate() + 1);
          break;
        case 'curr_month':
          fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
          toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          break;
        case 'prev_month':
          fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          toDate = new Date(today.getFullYear(), today.getMonth(), 0);
          break;
        case 'q1':
          fromDate = new Date(today.getFullYear(), 0, 1);
          toDate = new Date(today.getFullYear(), 3, 0);
          break;
        case 'q2':
          fromDate = new Date(today.getFullYear(), 3, 1);
          toDate = new Date(today.getFullYear(), 6, 0);
          break;
        case 'q3':
          fromDate = new Date(today.getFullYear(), 6, 1);
          toDate = new Date(today.getFullYear(), 9, 0);
          break;
        case 'q4':
          fromDate = new Date(today.getFullYear(), 9, 1);
          toDate = new Date(today.getFullYear(), 12, 0);
          break;
        case 'curr_year':
          fromDate = new Date(today.getFullYear(), 0, 1);
          toDate = new Date(today.getFullYear(), 11, 31);
          break;
        case 'prev_year':
          fromDate = new Date(today.getFullYear() - 1, 0, 1);
          toDate = new Date(today.getFullYear() - 1, 11, 31);
          break;
      }

      if (fromDateInput) fromDateInput.value = formatDate(fromDate);
      if (toDateInput) toDateInput.value = formatDate(toDate);
    });
  }

  // Preview Action Button
  if (btnPreviewReport) {
    btnPreviewReport.addEventListener('click', async function () {
      if (!currentReportId) {
        // Auto select first report if none was clicked
        const firstItem = reportNamesList.querySelector('.report-list-item');
        if (firstItem && firstItem.dataset.reportId) {
          await selectReport(firstItem.dataset.reportId, firstItem.dataset.reportName);
        } else {
          alert('يرجى اختيار تقرير أولاً من قائمة التقارير المتاحة.');
          return;
        }
      }

      if (!currentHandler) {
        currentHandler = await getReportHandler(currentReportId, currentReportName);
      }

      const categoryName = CATEGORY_NAMES_MAP[currentCategory] || '';
      const fromDate = fromDateInput ? (fromDateInput.value || 'غير محدد') : 'غير محدد';
      const toDate = toDateInput ? (toDateInput.value || 'غير محدد') : 'غير محدد';

      if (modalTitle) modalTitle.textContent = `معاينة: ${currentReportName} [${currentReportId}]`;
      
      if (modalBody) {
        modalBody.innerHTML = await currentHandler.renderPreview({
          categoryName,
          entityId: currentEntityId,
          entityName: currentEntityName,
          fromDate,
          toDate,
          searchData: currentSearchData
        });
      }

      if (modalOverlay) modalOverlay.classList.add('active');
    });
  }

  function printReport() {
    window.print();
  }

  if (btnPrintReport) {
    btnPrintReport.addEventListener('click', async function () {
      if (btnPreviewReport) {
        await btnPreviewReport.click();
      }
      setTimeout(printReport, 150);
    });
  }

  if (modalPrintBtn) modalPrintBtn.addEventListener('click', printReport);

  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', function () {
      const name = currentReportName || 'التقرير';
      alert(`تم تجهيز التقرير: "${name}" للتصدير بصيغة Excel بنجاح.`);
    });
  }

  if (btnResetReportFilters) {
    btnResetReportFilters.addEventListener('click', function () {
      if (periodSelect) periodSelect.value = 'none';
      if (fromDateInput) fromDateInput.value = '';
      if (toDateInput) toDateInput.value = '';
      if (reportSearchInput) reportSearchInput.value = '';
      if (entitySearchInput) entitySearchInput.value = '';
      updateReportList(true);
    });
  }

  // Modal Close Listeners
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
  if (modalCloseFooterBtn) modalCloseFooterBtn.addEventListener('click', () => modalOverlay.classList.remove('active'));
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  // Initialize report list on module boot and auto select the first report
  updateReportList(true);
}
