export interface UndoAction {
  type: string;
  description: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}
