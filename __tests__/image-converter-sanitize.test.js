const { JSDOM } = require('jsdom');

function sanitizeFilename(name) {
  return name.replace(/[<>&"'`]/g, '');
}

function addFileRow(document, file) {
  const tbody = document.getElementById('preview-tbody');
  const tr = document.createElement('tr');
  const cell = document.createElement('td');
  cell.className = 'filename-cell';
  cell.textContent = sanitizeFilename(file.name);
  tr.appendChild(cell);
  tbody.appendChild(tr);
}

describe('image converter filename sanitization', () => {
  test('renders HTML-like filename safely', () => {
    const dom = new JSDOM(`<!DOCTYPE html><table><tbody id="preview-tbody"></tbody></table>`);
    const file = new dom.window.File(['data'], '<img src=x onerror=alert(1)>.png', { type: 'image/png' });
    addFileRow(dom.window.document, file);
    const cell = dom.window.document.querySelector('.filename-cell');
    expect(cell.textContent).toBe('img src=x onerror=alert(1).png');
    expect(cell.innerHTML).toBe('img src=x onerror=alert(1).png');
    expect(cell.querySelector('img')).toBeNull();
  });
});

