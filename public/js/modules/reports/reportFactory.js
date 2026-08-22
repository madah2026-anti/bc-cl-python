/**
 * reportFactory.js – Factory to resolve and instantiate report strategy handlers
 */

import { BaseReportHandler } from './handlers/baseReport.js';

// Map of report IDs that have dedicated custom handler modules
const handlerRegistry = {
  110: () => import('./handlers/rpt110.js').then(m => m.SupplierAccountReportHandler),
  260: () => import('./handlers/rpt260.js').then(m => m.InventoryBalanceReportHandler)
};

/**
 * Returns an instance of the appropriate Report Handler for the given report ID
 */
export async function getReportHandler(reportId, reportName) {
  const numericId = parseInt(reportId, 10);

  if (handlerRegistry[numericId]) {
    try {
      const HandlerClass = await handlerRegistry[numericId]();
      return new HandlerClass(numericId, reportName);
    } catch (error) {
      console.warn(`Failed to load custom handler for report #${numericId}, falling back to BaseReportHandler`, error);
    }
  }

  return new BaseReportHandler(numericId, reportName);
}
