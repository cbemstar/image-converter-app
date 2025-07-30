/**
 * Initialise sidebar UI.
 * @param {HTMLElement} el
 * @param {object} props
 */
export function initSidebar(el, props) {
  el.innerHTML = '';
  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = 'image/*';
  upload.addEventListener('change', () => {
    const file = upload.files[0];
    if (file) props.onUpload(file);
  });
  el.appendChild(upload);

  const addTextBtn = document.createElement('button');
  addTextBtn.textContent = 'Add Text';
  addTextBtn.className = 'shad-btn';
  addTextBtn.onclick = () => {
    const text = prompt('Text');
    if (text) props.onAddText(text);
  };
  el.appendChild(addTextBtn);

  const addLogoBtn = document.createElement('button');
  addLogoBtn.textContent = 'Add Logo';
  addLogoBtn.className = 'shad-btn';
  addLogoBtn.onclick = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (file) props.onAddLogo(file);
    };
    input.click();
  };
  el.appendChild(addLogoBtn);

  const presetList = document.createElement('div');
  props.presets.forEach(p => {
    const label = document.createElement('label');
    label.style.display = 'block';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.name = p.name;
    label.appendChild(cb);
    label.append(' ' + p.name);
    presetList.appendChild(label);
  });
  el.appendChild(presetList);

  const genBtn = document.createElement('button');
  genBtn.textContent = 'Generate';
  genBtn.className = 'shad-btn';
  genBtn.addEventListener('click', () => {
    const selected = Array.from(presetList.querySelectorAll('input:checked')).map(cb => cb.dataset.name);
    props.onGenerate(selected);
  });
  el.appendChild(genBtn);
}
