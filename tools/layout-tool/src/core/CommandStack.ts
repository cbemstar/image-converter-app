export interface Command {
  undo: () => void;
  redo: () => void;
}

export default class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  push(cmd: Command) {
    this.undoStack.push(cmd);
    this.redoStack = [];
    cmd.redo();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.redo();
      this.undoStack.push(cmd);
    }
  }
}
