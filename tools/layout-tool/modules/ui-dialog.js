/**
 * Show a modern dialog modal that matches the site's design
 * @param {string} msg - Message to display
 * @param {string} type - Type of dialog ('info', 'success', 'error', 'warning')
 */
export function showDialog(msg, type = 'info') {
  // Remove existing dialog if any
  const existingDialog = document.getElementById('layout-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.id = 'layout-dialog';
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  overlay.style.zIndex = '9999';

  // Create dialog content
  const dialog = document.createElement('div');
  dialog.className = 'bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 max-w-md mx-4 shadow-lg';

  // Icon based on type
  const icons = {
    info: '<i class="fas fa-info-circle text-blue-500"></i>',
    success: '<i class="fas fa-check-circle text-green-500"></i>',
    error: '<i class="fas fa-exclamation-circle text-red-500"></i>',
    warning: '<i class="fas fa-exclamation-triangle text-yellow-500"></i>'
  };

  dialog.innerHTML = `
    <div class="flex items-start gap-3 mb-4">
      <div class="text-xl">${icons[type]}</div>
      <div class="flex-1">
        <p class="text-[var(--foreground)] text-sm leading-relaxed">${msg}</p>
      </div>
    </div>
    <div class="flex justify-end">
      <button id="dialog-ok" class="layout-btn primary">OK</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Handle close
  const closeDialog = () => {
    overlay.remove();
  };

  // Close on OK button click
  dialog.querySelector('#dialog-ok').addEventListener('click', closeDialog);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Focus the OK button
  setTimeout(() => {
    dialog.querySelector('#dialog-ok').focus();
  }, 100);
}

/**
 * Show a confirmation dialog
 * @param {string} msg - Message to display
 * @param {function} onConfirm - Callback when confirmed
 * @param {function} onCancel - Callback when cancelled (optional)
 */
export function showConfirmDialog(msg, onConfirm, onCancel = null) {
  // Remove existing dialog if any
  const existingDialog = document.getElementById('layout-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.id = 'layout-dialog';
  overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  overlay.style.zIndex = '9999';

  // Create dialog content
  const dialog = document.createElement('div');
  dialog.className = 'bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 max-w-md mx-4 shadow-lg';

  dialog.innerHTML = `
    <div class="flex items-start gap-3 mb-4">
      <div class="text-xl">
        <i class="fas fa-question-circle text-blue-500"></i>
      </div>
      <div class="flex-1">
        <p class="text-[var(--foreground)] text-sm leading-relaxed">${msg}</p>
      </div>
    </div>
    <div class="flex justify-end gap-2">
      <button id="dialog-cancel" class="layout-btn">Cancel</button>
      <button id="dialog-confirm" class="layout-btn primary">Confirm</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Handle close
  const closeDialog = () => {
    overlay.remove();
  };

  // Handle confirm
  dialog.querySelector('#dialog-confirm').addEventListener('click', () => {
    closeDialog();
    if (onConfirm) onConfirm();
  });

  // Handle cancel
  dialog.querySelector('#dialog-cancel').addEventListener('click', () => {
    closeDialog();
    if (onCancel) onCancel();
  });

  // Close on overlay click (acts as cancel)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDialog();
      if (onCancel) onCancel();
    }
  });

  // Handle Escape key (acts as cancel)
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      if (onCancel) onCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Focus the confirm button
  setTimeout(() => {
    dialog.querySelector('#dialog-confirm').focus();
  }, 100);
}
