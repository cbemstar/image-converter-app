/**
 * Initialise topbar controls.
 * @param {HTMLElement} el
 * @param {object} props
 */
export function initTopbar(el, props) {
  el.innerHTML = '';
  const undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'shad-btn';
  undoBtn.onclick = props.onUndo;
  el.appendChild(undoBtn);

  const redoBtn = document.createElement('button');
  redoBtn.textContent = 'Redo';
  redoBtn.className = 'shad-btn';
  redoBtn.onclick = props.onRedo;
  el.appendChild(redoBtn);

  const chanSel = document.createElement('select');
  ['all','print','digital','social'].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    chanSel.appendChild(opt);
  });
  chanSel.onchange = () => props.onChannel(chanSel.value);
  el.appendChild(chanSel);

  const modeBtn = document.createElement('button');
  modeBtn.textContent = 'RGB';
  modeBtn.className = 'shad-btn';
  modeBtn.onclick = () => {
    modeBtn.textContent = modeBtn.textContent === 'RGB' ? 'CMYK' : 'RGB';
    props.onColour(modeBtn.textContent);
  };
  el.appendChild(modeBtn);

  const dpiSel = document.createElement('select');
  [72,300].forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d+' DPI';
    dpiSel.appendChild(opt);
  });
  dpiSel.onchange = () => props.onDpi(parseInt(dpiSel.value,10));
  el.appendChild(dpiSel);

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export';
  exportBtn.className = 'shad-btn';
  exportBtn.onclick = props.onExport;
  el.appendChild(exportBtn);
}
