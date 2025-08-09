/**
 * Initialize topbar controls with consistent styling
 * @param {HTMLElement} el
 * @param {object} props
 */
export function initTopbar(el, props) {
  el.innerHTML = `
    <div class="flex flex-wrap items-center gap-4">
      <!-- History Controls -->
      <div class="flex items-center gap-2">
        <button id="undo-btn" class="btn btn-outline" title="Undo">
          <i class="fas fa-undo mr-2"></i>
          Undo
        </button>
        <button id="redo-btn" class="btn btn-outline" title="Redo">
          <i class="fas fa-redo mr-2"></i>
          Redo
        </button>
      </div>

      <!-- Separator -->
      <div class="w-px h-6 bg-[var(--border)]"></div>

      <!-- Channel Filter -->
      <div class="flex items-center gap-2">
        <label class="label text-sm mb-0">Channel:</label>
        <select id="channel-select" class="input w-auto min-w-100">
          <option value="all">All</option>
          <option value="print">Print</option>
          <option value="digital">Digital</option>
          <option value="social">Social</option>
        </select>
      </div>

      <!-- Color Mode -->
      <div class="flex items-center gap-2">
        <label class="label text-sm mb-0">Color:</label>
        <button id="color-mode-btn" class="btn btn-outline min-w-60">
          RGB
        </button>
      </div>

      <!-- DPI Setting -->
      <div class="flex items-center gap-2">
        <label class="label text-sm mb-0">DPI:</label>
        <select id="dpi-select" class="input w-auto min-w-80">
          <option value="72">72 DPI</option>
          <option value="150">150 DPI</option>
          <option value="300">300 DPI</option>
        </select>
      </div>

      <!-- Separator -->
      <div class="w-px h-6 bg-[var(--border)]"></div>

      <!-- Export Button -->
      <button id="export-btn" class="btn btn-outline primary">
        <i class="fas fa-download mr-2"></i>
        Export ZIP
      </button>
    </div>
  `;

  // Bind event handlers
  const undoBtn = el.querySelector('#undo-btn');
  const redoBtn = el.querySelector('#redo-btn');
  const channelSelect = el.querySelector('#channel-select');
  const colorModeBtn = el.querySelector('#color-mode-btn');
  const dpiSelect = el.querySelector('#dpi-select');
  const exportBtn = el.querySelector('#export-btn');

  undoBtn.addEventListener('click', props.onUndo);
  redoBtn.addEventListener('click', props.onRedo);
  
  channelSelect.addEventListener('change', () => {
    props.onChannel(channelSelect.value);
  });

  colorModeBtn.addEventListener('click', () => {
    const currentMode = colorModeBtn.textContent.trim();
    const newMode = currentMode === 'RGB' ? 'CMYK' : 'RGB';
    colorModeBtn.textContent = newMode;
    props.onColour(newMode);
  });

  dpiSelect.addEventListener('change', () => {
    props.onDpi(parseInt(dpiSelect.value, 10));
  });

  exportBtn.addEventListener('click', props.onExport);
}
