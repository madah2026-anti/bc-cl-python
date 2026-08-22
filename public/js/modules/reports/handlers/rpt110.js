/**
 * rpt110.js – Dedicated Strategy Handler for Report #110 (حساب مورد)
 */

import { BaseReportHandler } from './baseReport.js';

export class SupplierAccountReportHandler extends BaseReportHandler {
  getColumns() {
    return [
      { key: 'supplier_id', title: 'كود المورد' },
      { key: 'supplier_name', title: 'اسم المورد' },
      { key: 'debit', title: 'مدين' },
      { key: 'credit', title: 'دائن' },
      { key: 'balance', title: 'الرصيد الصافي' }
    ];
  }

  renderPreview(context) {
    const { categoryName, entityName, fromDate, toDate } = context;

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">القسم</div>
          <div style="font-weight: 600; color: var(--text-primary);">${categoryName}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">المورد المحدد</div>
          <div style="font-weight: 600; color: var(--success);">${entityName}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">من تاريخ</div>
          <div style="font-weight: 600; color: var(--accent-light);">${fromDate}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">إلى تاريخ</div>
          <div style="font-weight: 600; color: var(--accent-light);">${toDate}</div>
        </div>
      </div>

      <div id="reportPrintArea" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 20px;">
        <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px;">
          <h3 style="margin-bottom: 4px; color: var(--text-primary);">شركة بيلا سيتي - كشف حساب مورد</h3>
          <h4 style="color: var(--accent-light); margin-bottom: 4px;">${this.reportName} - [${entityName}]</h4>
          <p style="font-size: 12px; color: var(--text-muted);">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>كود المورد</th>
              <th>اسم المورد</th>
              <th>مدين (له)</th>
              <th>دائن (عليه)</th>
              <th>الرصيد الصافي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>SUP-110</td>
              <td>${entityName}</td>
              <td style="color: var(--success);">15,000.00</td>
              <td style="color: var(--danger);">5,000.00</td>
              <td style="font-weight: bold; color: var(--accent-light);">10,000.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}
