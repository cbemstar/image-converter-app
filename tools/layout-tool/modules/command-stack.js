/** Simple command stack for undo/redo. */
class Stack {
  constructor(limit = 20) {
    this.limit = limit;
    this.stack = [];
    this.pointer = -1;
  }
  push(cmd) {
    this.stack.splice(this.pointer + 1);
    this.stack.push(cmd);
    if (this.stack.length > this.limit) this.stack.shift();
    this.pointer = this.stack.length - 1;
  }
  undo() {
    if (this.pointer < 0) return;
    const cmd = this.stack[this.pointer];
    if (cmd.undo) cmd.undo();
    this.pointer--;
  }
  redo() {
    if (this.pointer + 1 >= this.stack.length) return;
    this.pointer++;
    const cmd = this.stack[this.pointer];
    if (cmd.redo) cmd.redo();
  }
}

/**
 * Command stack instance limited to 20 levels.
 * @type {Stack}
 */
export const commandStack = new Stack(20);
