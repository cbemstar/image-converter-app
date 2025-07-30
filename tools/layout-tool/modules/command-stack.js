/**
 * CommandStack manages undo and redo operations.
 */
export class CommandStack {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Push a command onto the stack and clear redo stack.
   * @param {function():void} undo
   * @param {function():void} redo
   */
  push(undo, redo) {
    this.undoStack.push({ undo, redo });
    this.redoStack = [];
  }

  /** Undo the last command. */
  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  /** Redo the last undone command. */
  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.redo();
      this.undoStack.push(cmd);
    }
  }
}
