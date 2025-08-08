const { JSDOM } = require('jsdom');

describe('ErrorHandler toast security', () => {
  let handler;
  let dom;
  let ErrorHandler;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    window.requestAnimationFrame = cb => cb();
    global.requestAnimationFrame = window.requestAnimationFrame;
    jest.resetModules();
    ErrorHandler = require('../js/error-handler.js');
    handler = new ErrorHandler();
  });

  afterEach(() => {
    dom.window.close();
  });

  test('escapes HTML in messages', () => {
    const html = '<img src=x onerror="window.injected=true">';
    const toast = handler.showToast('Title', html);
    const messageEl = toast.querySelector('.toast-message');

    expect(messageEl.innerHTML).toBe('&lt;img src=x onerror="window.injected=true"&gt;');
    expect(window.injected).toBeUndefined();
  });

  test('actions execute only via bound handlers', () => {
    let executed = false;
    const toast = handler.showToast('Title', 'Message', 'info', {
      actions: [
        { label: '<img src=x onerror="window.injected=true">', action: () => { executed = true; } }
      ]
    });

    const btn = toast.querySelector('.toast-actions button');
    expect(btn).not.toBeNull();
    expect(btn.innerHTML).toBe('&lt;img src=x onerror="window.injected=true"&gt;');
    expect(window.injected).toBeUndefined();
    expect(executed).toBe(false);

    btn.click();

    expect(executed).toBe(true);
    expect(window.injected).toBeUndefined();
  });
});
