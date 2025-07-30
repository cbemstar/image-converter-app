const undoStack = [];
const redoStack = [];
const LIMIT = 20;

/**
 * Execute a command and push to undo stack.
 * @param {{redo:Function,undo:Function}} cmd
 */
export function execute(cmd) {
  cmd.redo();
  undoStack.push(cmd);
  if (undoStack.length > LIMIT) undoStack.shift();
  redoStack.length = 0;
}

/** Undo last command. */
export function undo() {
  const cmd = undoStack.pop();
  if (cmd) {
    cmd.undo();
    redoStack.push(cmd);
  }
}

/** Redo last undone command. */
export function redo() {
  const cmd = redoStack.pop();
  if (cmd) {
    cmd.redo();
    undoStack.push(cmd);
  }
}
