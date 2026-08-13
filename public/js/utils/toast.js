// ============================================================
// utils/toast.js – Toast notification system
// ============================================================

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Display a toast notification popup
 * @param {string} message 
 * @param {'success'|'danger'|'error'|'warning'} type 
 */
export function showToast(message, type = 'success') {
  const container = getToastContainer();
  const toastType = (type === 'danger') ? 'danger' : type;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${toastType}`;
  toast.textContent = message;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
