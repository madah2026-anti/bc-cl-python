// ============================================================
// main.js – ES Module Application Entry Point
// ============================================================

import { initNavigation } from './core/navigation.js';
import { loadUser, loadStats } from './core/userStats.js';
import { initCustomersModule } from './modules/customers.js';
import { initSalesModule } from './modules/sales.js';
import { initInventoryModule } from './modules/inventory.js';
import { initModalListeners } from './utils/modal.js';

/**
 * Initialize all application modules on DOM ready
 */
function initApp() {
  // Initialize modal listeners for registered overlays
  const overlays = [
    document.getElementById('customerModalOverlay'),
    document.getElementById('deleteModalOverlay'),
    document.getElementById('warehouseModalOverlay'),
    document.getElementById('deleteWhModalOverlay')
  ].filter(Boolean);

  initModalListeners(overlays);

  // Initialize core navigation & feature domain modules
  initNavigation();
  initSalesModule();
  initInventoryModule();
  initCustomersModule();

  // Load user info & dashboard stats
  loadUser();
  loadStats();
}

// Bootstrap when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
