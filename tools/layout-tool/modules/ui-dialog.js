/**
 * Simple modal dialog.
 * @param {HTMLElement} host
 * @param {Function} onConfirm
 */
export function showExportDialog(host, onConfirm) {
  host.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';
  const dpiSelect = document.createElement('select');
  ;['72','300'].forEach(d => {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = `${d} DPI`;
    dpiSelect.appendChild(o);
  });
  const ok = document.createElement('button');
  ok.textContent = 'Download';
  ok.className = 'btn mt-2';
  ok.addEventListener('click', () => {
    host.classList.add('hidden');
    onConfirm(parseInt(dpiSelect.value,10));
  });
  modal.append('DPI: ', dpiSelect, ok);
  host.appendChild(modal);
  host.classList.remove('hidden');
}
