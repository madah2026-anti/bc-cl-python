// ============================================================
// utils/modal.js – Reusable modal popup helpers
// ============================================================

/**
 * Open a modal overlay
 * @param {HTMLElement} overlayEl 
 */
export function openModal(overlayEl) {
  if (overlayEl) overlayEl.classList.add('active');
}

/**
 * Close a modal overlay
 * @param {HTMLElement} overlayEl 
 */
export function closeModal(overlayEl) {
  if (overlayEl) overlayEl.classList.remove('active');
}

/**
 * Initialize global modal listeners (Escape key, background overlay click)
 * @param {HTMLElement[]} overlays 
 */
export function initModalListeners(overlays = []) {
  // Close on backdrop click & modal close buttons
  overlays.forEach(overlayEl => {
    if (overlayEl) {
      overlayEl.addEventListener('click', (e) => {
        if (e.target === overlayEl) closeModal(overlayEl);
      });
      overlayEl.querySelectorAll('.btn-close-modal, .modal-close, .btn-cancel, .btn-close').forEach(btn => {
        btn.addEventListener('click', () => closeModal(overlayEl));
      });
    }
  });

  // Global escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      overlays.forEach(overlayEl => closeModal(overlayEl));
    }
  });
}
