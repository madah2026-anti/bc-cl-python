// ============================================================
// core/navigation.js – Sidebar & Section Navigation
// ============================================================

export const sectionTitles = {
  home: 'الرئيسية',
  purchases: 'الموردين',
  sales: 'العملاء',
  accounts: 'الحسابات',
  inventory: 'المخزون',
  customer_service: 'خدمة العملاء',
  reports: 'مركز التقارير والإحصائيات',
  system: 'النظام',
};

// Section switch hooks
let sectionChangeCallbacks = [];

export function onSectionChange(callback) {
  sectionChangeCallbacks.push(callback);
}

/**
 * Close mobile sidebar navigation
 */
export function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

/**
 * Switch active section view
 * @param {string} sectionId 
 */
export function switchSection(sectionId) {
  const sectionPanels = document.querySelectorAll('.section-panel');
  const navItems = document.querySelectorAll('.sidebar-nav > .nav-item[data-section]');
  const pageTitle = document.getElementById('pageTitle');

  sectionPanels.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));

  const panel = document.getElementById('section-' + sectionId);
  if (panel) panel.classList.add('active');

  const navEl = document.getElementById('nav-' + sectionId);
  if (navEl) navEl.classList.add('active');

  if (pageTitle) pageTitle.textContent = sectionTitles[sectionId] || sectionId;

  // Trigger callbacks
  sectionChangeCallbacks.forEach(cb => cb(sectionId));

  closeMobileSidebar();
}

/**
 * Initialize main sidebar navigation, sub-menus, mobile hamburger, and quick links
 */
export function initNavigation() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navItems = document.querySelectorAll('.sidebar-nav > .nav-item[data-section]');

  // Sidebar item click handlers
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      switchSection(section);
    });
  });

  // Home section quick-access link cards
  document.querySelectorAll('.sub-link-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.goto;
      switchSection(target);
    });
  });

  // Mobile menu toggle buttons
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (sidebar) sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }
}
