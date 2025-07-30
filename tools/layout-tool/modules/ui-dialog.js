/** Simple modal dialog */
export class Dialog {
  /**
   * @param {HTMLElement} el
   */
  constructor(el) {
    this.el = el;
    const close = el.querySelector('[data-dialog-close]');
    if (close) close.addEventListener('click', () => this.hide());
  }

  show() {
    this.el.classList.remove('hidden');
  }

  hide() {
    this.el.classList.add('hidden');
  }
}
