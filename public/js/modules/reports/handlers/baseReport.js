/**
 * baseReport.js – Base Report Strategy Handler
 */

export class BaseReportHandler {
  constructor(reportId, reportName) {
    this.reportId = reportId;
    this.reportName = reportName;
  }

  /**
   * Fetch filter items (entities/records) for the left panel search list
   */
  async fetchOptions(category) {
    try {
      const response = await fetch(`/api/report-data?reportId=${this.reportId}&category=${category}`);
      if (!response.ok) {
        console.warn(`Report API returned status ${response.status}`);
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('Error fetching report data:', err);
      return [];
    }
  }

  /**
   * Get table columns definition for this report
   */
  getColumns() {
    return [
      { key: 'index', title: '#' },
      { key: 'code', title: 'الكود / السريال' },
      { key: 'description', title: 'البيان / الوصف' },
      { key: 'date', title: 'التاريخ' },
      { key: 'amount', title: 'المبلغ / الكمية' },
      { key: 'status', title: 'الحالة' }
    ];
  }

  /**
   * Render HTML for the modal preview table
   */
  renderPreview(context) {
    const { categoryName, entityName, fromDate, toDate } = context;
    const catText = categoryName || 'عام';
    const entText = entityName || 'جميع البيانات';
    const fromText = fromDate || 'غير محدد';
    const toText = toDate || 'غير محدد';

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">القسم</div>
          <div style="font-weight: 600; color: var(--text-primary);">${catText}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">العنصر / التصفية</div>
          <div style="font-weight: 600; color: var(--success);">${entText}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">من تاريخ</div>
          <div style="font-weight: 600; color: var(--accent-light);">${fromText}</div>
        </div>
        <div style="background: var(--bg-input); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
          <div style="font-size: 11px; color: var(--text-muted);">إلى تاريخ</div>
          <div style="font-weight: 600; color: var(--accent-light);">${toText}</div>
        </div>
      </div>

      <div id="reportPrintArea" style="background: var(--bg-input); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 20px;">
        <div style="text-align: center; margin-bottom: 16px; border-bottom: 1px dashed var(--border-color); padding-bottom: 12px;">
          <h3 style="margin-bottom: 4px; color: var(--text-primary);">شركة بيلا سيتي - BC ERP</h3>
          <h4 style="color: var(--accent-light); margin-bottom: 4px;">${this.reportName}</h4>
          <p style="font-size: 12px; color: var(--text-muted);">تاريخ استخراج التقرير: ${new Date().toLocaleString('ar-EG')}</p>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>الكود / السريال</th>
              <th>البيان / الوصف</th>
              <th>التاريخ</th>
              <th>المبلغ / الكمية</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>RPT-${this.reportId}-001</td>
              <td>بيانات التقرير المجمع - ${entText}</td>
              <td>${fromText}</td>
              <td>1,250.00</td>
              <td><span class="record-count" style="background: rgba(16,185,129,0.15); color: #6ee7b7;">مكتمل</span></td>
            </tr>
            <tr>
              <td>2</td>
              <td>RPT-${this.reportId}-002</td>
              <td>تفاصيل الحركة لـ ${this.reportName}</td>
              <td>${toText}</td>
              <td>3,480.00</td>
              <td><span class="record-count" style="background: rgba(16,185,129,0.15); color: #6ee7b7;">مكتمل</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}
