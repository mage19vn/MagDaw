import type { EditorSnapshot, Selection } from "./types";
import { validateProject } from "./validation";

const HISTORY_LIMIT = 100;
function copy(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    project: validateProject(snapshot.project),
    selection: structuredClone(snapshot.selection),
  };
}

/** Commit once at gesture end; transient drag previews remain outside history. */
export class ProjectHistory {
  private undoStack: EditorSnapshot[] = [];
  private redoStack: EditorSnapshot[] = [];
  private present: EditorSnapshot;
  constructor(initial: EditorSnapshot) {
    this.present = copy(initial);
  }
  get current(): EditorSnapshot {
    return structuredClone(this.present);
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  commit(snapshot: EditorSnapshot): EditorSnapshot {
    const next = copy(snapshot);
    if (JSON.stringify(this.present.project) === JSON.stringify(next.project)) {
      this.present.selection = next.selection;
      return this.current;
    }
    this.undoStack.push(this.present);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.present = next;
    this.redoStack = [];
    return this.current;
  }
  setSelection(selection: Selection): EditorSnapshot {
    this.present.selection = structuredClone(selection);
    return this.current;
  }
  undo(): EditorSnapshot {
    const previous = this.undoStack.pop();
    if (previous) {
      this.redoStack.push(this.present);
      this.present = previous;
    }
    return this.current;
  }
  redo(): EditorSnapshot {
    const next = this.redoStack.pop();
    if (next) {
      this.undoStack.push(this.present);
      this.present = next;
    }
    return this.current;
  }
  reset(snapshot: EditorSnapshot): EditorSnapshot {
    this.present = copy(snapshot);
    this.undoStack = [];
    this.redoStack = [];
    return this.current;
  }
}
