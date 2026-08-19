// ============================================================
// core/userStats.js – User Profile & Dashboard Stats Loader
// ============================================================

import { animateNumber } from '../utils/helpers.js';

/**
 * Fetch and display authenticated user details
 */
export async function loadUser() {
  const sidebarName = document.getElementById('userNameSidebar');
  try {
    const res = await fetch('/api/me');
    if (!res.ok) {
      if (sidebarName) sidebarName.textContent = 'زائر';
      return;
    }
    const { user } = await res.json();
    if (!user) {
      if (sidebarName) sidebarName.textContent = 'زائر';
      return;
    }

    const welcomeEl = document.getElementById('welcomeUsername');
    const sidebarAvatar = document.getElementById('userAvatarSidebar');

    const name = user.username || '';
    if (welcomeEl) welcomeEl.textContent = name;
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = name ? name.charAt(0).toUpperCase() : 'U';
  } catch (e) {
    console.error('Failed to load user:', e);
    if (sidebarName) sidebarName.textContent = 'زائر';
  }
}

/**
 * Fetch and animate dashboard overview counters & section badges
 */
export async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const { data } = await res.json();

    // Home statistics cards
    animateNumber(document.getElementById('statUsers'), data.userCount);
    animateNumber(document.getElementById('statWarehouses'), data.warehouseCount);
    animateNumber(document.getElementById('statItems'), data.itemCount);
    animateNumber(document.getElementById('statGroups'), data.groupCount);

    // Customer count badges (Home card + Sales section badge)
    const custStatEl = document.getElementById('statCustomers');
    if (custStatEl && data.customerCount !== undefined) {
      animateNumber(custStatEl, data.customerCount);
    }
    const salesSubCustEl = document.getElementById('salesSubCustomersCount');
    if (salesSubCustEl && data.customerCount !== undefined) {
      animateNumber(salesSubCustEl, data.customerCount);
    }

    // Inventory overview card badges
    const invSubWhEl = document.getElementById('invSubWarehousesCount');
    if (invSubWhEl && data.warehouseCount !== undefined) animateNumber(invSubWhEl, data.warehouseCount);

    const invSubGrpEl = document.getElementById('invSubGroupsCount');
    if (invSubGrpEl && data.groupCount !== undefined) animateNumber(invSubGrpEl, data.groupCount);

    const invSubItemEl = document.getElementById('invSubItemsCount');
    if (invSubItemEl && data.itemCount !== undefined) animateNumber(invSubItemEl, data.itemCount);
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}



