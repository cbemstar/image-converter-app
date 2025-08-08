const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;

function loadUtils() {
  const code = fs.readFileSync(path.resolve(__dirname, '../utils.js'), 'utf8');
  const sanitized = code.replace(/export\s+/g, '');
  const sandbox = {
    window: window,
    document: window.document,
    console,
    localStorage: window.localStorage,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  new vm.Script(sanitized, { filename: 'utils.js' }).runInContext(sandbox);
  return sandbox;
}

describe('notification utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('showNotification renders message text safely', () => {
    jest.useFakeTimers();
    const { showNotification } = loadUtils();
    const msg = '<b>alert</b>';
    showNotification(msg, 'info');
    const msgSpan = document.querySelector('#notification-container .notification div span:last-child');
    expect(msgSpan.textContent).toBe(msg);
    expect(msgSpan.querySelector('b')).toBeNull();
    jest.runAllTimers();
    jest.useRealTimers();
  });

  test('showError renders filename and error text safely', () => {
    const { showError } = loadUtils();
    document.body.innerHTML = '<table><tbody id="preview-tbody"></tbody></table>';
    const file = '<img src=x>';
    const err = { message: '<script>alert(1)</script>' };
    showError(0, file, err);
    const row = document.querySelector('#preview-tbody tr.error-row');
    expect(row.textContent).toContain(file);
    expect(row.textContent).toContain(err.message);
    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector('script')).toBeNull();
  });
});
