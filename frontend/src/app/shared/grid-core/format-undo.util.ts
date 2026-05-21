import type { GridApi, IRowNode } from 'ag-grid-community';
import { applyEntrySnapshot } from '../components/format-toolbar';
import type { FormatChange } from '../components/format-toolbar';

export interface FormatUndoBridge {
  isBulkOperation: boolean;
  pushUndo(action: any): void;
}

export interface PushFormatUndoOptions {
  changes: FormatChange[];
  gridApi: GridApi;
  undoBridge: FormatUndoBridge;
  /**
   * Callback chạy sau khi apply snapshot cho mỗi node — Builder dùng để
   * sync local rowData[] (`syncRowData`); Render = undefined.
   */
  afterApplyNode?: (node: IRowNode) => void;
}

/**
 * Push 1 undo action gộp toàn batch format change (toolbar B/I/Fill/Text/Merge).
 * `applyEntrySnapshot` khôi phục `_cellConfig[field]` theo snapshot, redraw +
 * refreshCells gom 1 lần cuối callback để tránh redraw lặp.
 *
 * `redrawRows` cần thiết vì AG Grid không tự reset CSS keys giữa state — inline
 * style cũ còn nguyên trên DOM nếu chỉ refreshCells (xem cell-styles.const.ts).
 */
export function pushFormatUndoAction(opts: PushFormatUndoOptions): void {
  const { changes, gridApi, undoBridge, afterApplyNode } = opts;
  if (!changes.length) return;

  const apply = (which: 'undo' | 'redo'): void => {
    undoBridge.isBulkOperation = true;
    try {
      for (const ch of changes) {
        const snap = which === 'undo' ? ch.oldEntry : ch.newEntry;
        applyEntrySnapshot(ch.node, ch.field, snap);
        afterApplyNode?.(ch.node);
      }
    } finally {
      undoBridge.isBulkOperation = false;
    }
    const nodes = Array.from(new Set(changes.map((ch) => ch.node)));
    gridApi.redrawRows({ rowNodes: nodes });
    gridApi.refreshCells({ rowNodes: nodes, force: true });
  };

  undoBridge.pushUndo({
    type: 'format_change',
    description: `Định dạng ${changes.length} ô`,
    undo: () => apply('undo'),
    redo: () => apply('redo'),
  });
}
