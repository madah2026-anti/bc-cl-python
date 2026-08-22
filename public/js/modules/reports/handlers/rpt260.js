/**
 * rpt260.js – Dedicated Strategy Handler for Report #260 (رصيد المخزن)
 */

import { BaseReportHandler } from './baseReport.js';

export class InventoryBalanceReportHandler extends BaseReportHandler {
  /**
   * Fetch actual report data from endpoint /api/report-data-260
   */
  async fetchReportData(context) {
    const { entityId, toDate, fromDate } = context || {};
    const whId = entityId || '';
    const to = (toDate && toDate !== 'غير محدد') ? toDate : '';
    const from = (fromDate && fromDate !== 'غير محدد') ? fromDate : '';

    try {
      const response = await fetch(`/api/report-data-260?warehouse_id=${encodeURIComponent(whId)}&to_date=${encodeURIComponent(to)}&from_date=${encodeURIComponent(from)}`);
      if (!response.ok) {
        console.warn(`Report 260 API status: ${response.status}`);
        return [];
      }
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error('Error fetching rpt260 report data:', err);
      return [];
    }
  }

  getColumns() {
    return [
      { key: 'item_id', title: 'كود الصنف' },
      { key: 'item_name', title: 'اسم الصنف' },
      { key: 'item_unit', title: 'الوحدة' },
      { key: 'itmqty_bal', title: 'الكمية المتوفرة' }
    ];
  }

  async renderPreview(context) {
    const { categoryName, entityName, fromDate, toDate } = context;
    const catText = categoryName || 'المخازن';
    const entText = entityName || 'جميع المخازن';
    const fromText = fromDate || 'غير محدد';
    const toText = toDate || 'غير محدد';

    const rows = await this.fetchReportData(context);

    let totalQty = 0;
    let tableRowsHtml = '';

    if (rows && rows.length > 0) {
      tableRowsHtml = rows.map((row, idx) => {
        const qty = Number(row.itmqty_bal || 0);
        totalQty += qty;
        const qtyColor = qty > 0 ? 'var(--success)' : (qty < 0 ? 'var(--danger)' : 'var(--text-muted)');

        return `
          <tr>
            <td>${row.item_id || idx + 1}</td>
            <td style="font-weight: 500;">${row.item_name || 'بدون اسم'}</td>
            <td>${row.item_unit || '-'}</td>
            <td style="font-weight: 600; color: ${qtyColor};">${qty.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
          </tr>
        `;
      }).join('');
    } else {
      tableRowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
            لا توجد بيانات متاحة لهذا المخزن أو بالفترة المحددة
          </td>
        </tr>
      `;
    }

    return `
      <div id="reportPrintArea" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 20px;">
        <div class="report-preview-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: rgba(255, 255, 255, 0.02); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; color: var(--text-muted);">القسم</div>
            <div style="font-weight: 600; color: var(--text-primary);">${catText}</div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.02); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; color: var(--text-muted);">المخزن المحدد</div>
            <div style="font-weight: 600; color: var(--success);">${entText}</div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.02); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; color: var(--text-muted);">من تاريخ</div>
            <div style="font-weight: 600; color: var(--accent-light);">${fromText}</div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.02); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 11px; color: var(--text-muted);">إلى تاريخ</div>
            <div style="font-weight: 600; color: var(--accent-light);">${toText}</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px;">
          <h3 style="margin-bottom: 4px; color: var(--text-primary);">شركة بيلا سيتي - تقرير رصيد المخزن</h3>
          <h4 style="color: var(--accent-light); margin-bottom: 4px;">${this.reportName} - [${entText}]</h4>
          <p style="font-size: 12px; color: var(--text-muted);">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <table class="data-table report-table">
          <thead>
            <tr>
              <th>كود الصنف</th>
              <th>اسم الصنف</th>
              <th>الوحدة</th>
              <th>الكمية المتوفرة</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${rows && rows.length > 0 ? `
          <tfoot>
            <tr style="font-weight: bold; background: rgba(255, 255, 255, 0.04); border-top: 2px solid var(--border-color);">
              <td colspan="3" style="text-align: right;">الإجمالي (${rows.length} أصناف):</td>
              <td style="color: var(--accent-light); font-size: 14px;">${totalQty.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
          ` : ''}
        </table>
      </div>
    `;
  }
}
