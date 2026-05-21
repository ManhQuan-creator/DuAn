import { Injectable, inject } from '@angular/core';
import { GridApi, IRowNode } from 'ag-grid-community';
import { Subject } from 'rxjs';
import { parseTsv } from '../excel-paste/parse-tsv.util';
import {
  applyPaste,
  PasteChange,
  PasteColumnSpec,
  PasteResult,
  writeCellFormat,
} from '../excel-paste/paste-helper.util';
import {
  preloadDropdownCatalogsForPaste,
  showPasteResultToast,
  type PasteToastDialog,
  type CatalogFetcher,
} from './paste-result-toast.util';
import type { PasteHighlightHandle } from './highlight-skip-cells.util';
import type { RangeBounds } from './tsv-formatter.util';
import { FormatClipboardService } from './format-clipboard.service';
import type { CellFormat } from '../utils/cell-styles.const';

export interface PasteUndoBridge {
  isBulkOperation: boolean;
  pushUndo(action: any): void;
}

export interface PasteHandlerAttachOptions {
  gridApi: GridApi;
  dialog: PasteToastDialog;
  catalogService: CatalogFetcher;
  destroy$: Subject<void>;
  undoRedoService: PasteUndoBridge;
  pasteHighlight: PasteHighlightHandle;
  dropdownItemsCache: Map<string, string[]>;
  /** Snapshot column configs để build PasteColumnSpec từ displayed columns. */
  getColumnConfigs: () => Array<{
    field: string;
    dataType?: 'number' | 'text' | 'date';
    formula?: string;
  }>;
  /** Per-cell permission check. Builder = always true, Render = real `canEdit`. */
  canEditCell: (field: string, rowCode: string) => boolean;
  /** Validate cell value (column-level + cell-level merged). */
  validateCell: (
    field: string,
    value: any,
    rowData: any,
  ) => { valid: boolean; message?: string };
  /** Optional: precheck (Render dùng `canEditRows` getter để chặn paste khi entry not editable). */
  canPaste?: () => boolean;
  /** Builder dùng để sync local rowData[] sau mỗi setDataValue. Render = undefined. */
  afterCellWrite?: (node: IRowNode) => void;
  /** Cập nhật badge số ô lỗi validation sau khi apply/undo/redo. */
  recalcValidationErrors: () => void;
  /**
   * Lấy vùng range hiện đang được chọn (Excel-style). Khi range > 1×1 và clipboard
   * matrix nhỏ hơn, paste sẽ tile pattern theo Excel rule:
   *  - source 1×1, dest NxM bất kỳ → fill cùng giá trị
   *  - source AxB, dest NxM với N % A === 0 và M % B === 0 → tile lặp pattern
   *  - không khớp bội số → fallback paste matrix as-is từ top-left của range
   * Trả null/undefined nếu không có range → behavior như cũ (paste từ focused cell).
   */
  getRangeBounds?: () => RangeBounds | null;
}

const EDIT_GUARD_SELECTOR =
  '.ag-cell-inline-editing, .ag-popup-editor, input, textarea, [contenteditable="true"]';

/**
 * Excel-style paste handler. Parse TSV → preload dropdown catalogs → applyPaste
 * (skip formula/catalog/permission/etc) → push 1 undo action gộp → highlight
 * skipped 3s → toast summary.
 *
 * Service stateless aside from `attach()` config. Component:
 * - `onGridReady`: gọi `attach({ ... })`
 * - `(paste)` event handler: `service.handlePaste(event)`
 */
@Injectable()
export class PasteHandlerService {
  private opts: PasteHandlerAttachOptions | null = null;
  private readonly formatClipboard = inject(FormatClipboardService);

  attach(opts: PasteHandlerAttachOptions): void {
    this.opts = opts;
  }

  detach(): void {
    this.opts = null;
  }

  async handlePaste(event: ClipboardEvent): Promise<void> {
    const opts = this.opts;
    if (!opts || !opts.gridApi) return;
    if (opts.canPaste && !opts.canPaste()) return;
    if ((event.target as HTMLElement)?.closest(EDIT_GUARD_SELECTOR)) return;

    const focused = opts.gridApi.getFocusedCell();
    if (!focused) {
      opts.dialog.warning('Chọn 1 ô trước khi paste (click vào ô để chọn).');
      return;
    }

    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;

    event.preventDefault();
    event.stopPropagation();

    const matrix = parseTsv(text);
    if (matrix.length === 0) return;

    const displayedColumns = opts.gridApi.getAllDisplayedColumns();
    const focusedColIdx = displayedColumns.findIndex(
      (c) => c.getColId() === focused.column.getColId(),
    );
    if (focusedColIdx < 0) return;

    const prep = prepareEffectiveMatrices({
      matrix,
      formatPayloadFormats: this.formatClipboard.tryMatch(text)?.formats,
      bounds: opts.getRangeBounds?.() ?? null,
      anchorFallback: { row: focused.rowIndex, col: focusedColIdx },
    });

    const columnSpecs = buildColumnSpecs(displayedColumns, opts.getColumnConfigs());

    await preloadDropdownCatalogsForPaste({
      gridApi: opts.gridApi,
      matrix: prep.matrix,
      anchorRow: prep.anchorRow,
      anchorCol: prep.anchorCol,
      columns: columnSpecs,
      cache: opts.dropdownItemsCache,
      catalogService: opts.catalogService,
      destroy$: opts.destroy$,
    });

    opts.undoRedoService.isBulkOperation = true;
    let result: PasteResult;
    try {
      result = applyPaste(
        prep.matrix,
        prep.anchorRow,
        prep.anchorCol,
        {
          gridApi: opts.gridApi,
          columns: columnSpecs,
          canEdit: opts.canEditCell,
          getDropdownItems: (field, rowData) => {
            const d = rowData?._cellConfig?.[field]?.dropdown;
            if (!d?.catalogType) return null;
            return opts.dropdownItemsCache.get(d.catalogType) ?? [];
          },
          formats: prep.formats,
        },
        opts.validateCell,
      );
    } finally {
      opts.undoRedoService.isBulkOperation = false;
    }

    if (opts.afterCellWrite) {
      for (const ch of result.changes) opts.afterCellWrite(ch.node);
    }
    refreshAfterPaste(opts.gridApi, result.changes);
    opts.recalcValidationErrors();

    pushPasteUndoAction(result.changes, opts);

    if (result.skipped.length > 0) opts.pasteHighlight.apply(result.skipped);
    showPasteResultToast(opts.dialog, result);
  }
}

/**
 * Refresh grid sau paste. Khi có format change → cần `redrawRows` cho các nodes
 * bị chạm vì AG Grid KHÔNG tự reset CSS keys giữa state (xem cell-styles.const.ts):
 * inline style cũ (vd `font-weight: 700`) còn nguyên trên DOM nếu cellStyle output
 * mới không có key đó để override. `redrawRows` rebuild row DOM hoàn toàn → reset.
 * Không có format change → `refreshCells({force:true})` đủ và rẻ hơn nhiều.
 */
function refreshAfterPaste(gridApi: GridApi, changes: PasteChange[]): void {
  if (changes.length === 0) {
    gridApi.refreshCells({ force: true });
    return;
  }
  const hasFormatChange = changes.some((ch) => ch.formatChanged);
  if (hasFormatChange) {
    const nodes = Array.from(new Set(changes.map((ch) => ch.node)));
    gridApi.redrawRows({ rowNodes: nodes });
    gridApi.refreshCells({ rowNodes: nodes, force: true });
  } else {
    gridApi.refreshCells({ force: true });
  }
}

/**
 * Tile matrix 2D theo modulo để vừa khít `destRows × destCols`. Caller đã verify
 * dest là bội của source. `fill` dùng khi row ngắn hơn srcCols (vd TSV không
 * đảm bảo mọi row cùng độ dài). Generic dùng được cho cả value (string) lẫn
 * format (CellFormat | null) — pattern modulo identical.
 */
function tile2D<T>(
  matrix: T[][],
  destRows: number,
  destCols: number,
  fill: T,
): T[][] {
  const srcRows = matrix.length;
  if (srcRows === 0) return matrix;
  const srcCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  if (srcCols === 0) return matrix;
  const out: T[][] = new Array(destRows);
  for (let r = 0; r < destRows; r++) {
    const srcRow = matrix[r % srcRows];
    const row: T[] = new Array(destCols);
    for (let c = 0; c < destCols; c++) {
      row[c] = srcRow[c % srcCols] ?? fill;
    }
    out[r] = row;
  }
  return out;
}

interface PreparedMatrices {
  matrix: string[][];
  formats: (CellFormat | null)[][] | undefined;
  anchorRow: number;
  anchorCol: number;
}

/**
 * Excel-style range tile + format payload align. Khi user đang chọn range > 1×1
 * và source là **bội số** chia hết của dest dims → expand source lên dest size,
 * anchor đổi về top-left của range. Không khớp bội số / không có range → giữ
 * matrix gốc + anchor = focused cell.
 *
 * Format matrix tile song song với value matrix qua cùng modulo indexing để
 * pattern format khớp 1-1.
 */
function prepareEffectiveMatrices(input: {
  matrix: string[][];
  formatPayloadFormats: (CellFormat | null)[][] | undefined;
  bounds: RangeBounds | null;
  anchorFallback: { row: number; col: number };
}): PreparedMatrices {
  const { matrix, bounds, anchorFallback } = input;
  let formats = input.formatPayloadFormats;
  let effectiveMatrix = matrix;
  let anchorRow = anchorFallback.row;
  let anchorCol = anchorFallback.col;

  if (!bounds) return { matrix: effectiveMatrix, formats, anchorRow, anchorCol };

  const destRows = bounds.r1 - bounds.r0 + 1;
  const destCols = bounds.c1 - bounds.c0 + 1;
  if (destRows <= 1 && destCols <= 1) {
    return { matrix: effectiveMatrix, formats, anchorRow, anchorCol };
  }
  anchorRow = bounds.r0;
  anchorCol = bounds.c0;

  const srcRows = matrix.length;
  const srcCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);
  const fitsTile =
    srcRows > 0 &&
    srcCols > 0 &&
    destRows >= srcRows &&
    destCols >= srcCols &&
    destRows % srcRows === 0 &&
    destCols % srcCols === 0 &&
    (destRows !== srcRows || destCols !== srcCols);
  if (fitsTile) {
    effectiveMatrix = tile2D(matrix, destRows, destCols, '');
    if (formats) {
      formats = tile2D<CellFormat | null>(formats, destRows, destCols, null);
    }
  }
  return { matrix: effectiveMatrix, formats, anchorRow, anchorCol };
}

/**
 * Build `PasteColumnSpec[]` cho mỗi displayed column. Index configs theo `field`
 * cho O(1) lookup — wide grid (100+ cols) tránh O(N²) của `Array.find`.
 */
function buildColumnSpecs(
  displayedColumns: ReturnType<GridApi['getAllDisplayedColumns']>,
  configs: Array<{ field: string; dataType?: 'number' | 'text' | 'date'; formula?: string }>,
): PasteColumnSpec[] {
  const cfgByField = new Map(configs.map((c) => [c.field, c]));
  return displayedColumns.map((c) => {
    const field = c.getColId();
    const cfg = cfgByField.get(field);
    return {
      field,
      dataType: cfg?.dataType,
      isCatalog: false,
      formula: cfg?.formula,
    };
  });
}

/**
 * Push undo action gộp cho 1 batch paste. Undo iterate ngược (LIFO) để khôi phục
 * đúng thứ tự trong trường hợp nhiều cells cùng node bị mutate. `isBulkOperation`
 * flag chặn UndoRedoService re-push trong lúc apply. Refresh + recalc chạy sau
 * cùng 1 lần để tránh redraw lặp.
 */
function pushPasteUndoAction(changes: PasteChange[], opts: PasteHandlerAttachOptions): void {
  if (changes.length === 0) return;
  const undoBridge = opts.undoRedoService;
  const gridApi = opts.gridApi;
  const recalc = opts.recalcValidationErrors;
  const after = opts.afterCellWrite;

  const apply = (which: 'undo' | 'redo'): void => {
    undoBridge.isBulkOperation = true;
    try {
      const iter = which === 'undo'
        ? (cb: (ch: PasteChange) => void) => {
            for (let i = changes.length - 1; i >= 0; i--) cb(changes[i]);
          }
        : (cb: (ch: PasteChange) => void) => changes.forEach(cb);
      iter((ch) => {
        const value = which === 'undo' ? ch.oldValue : ch.newValue;
        const format = which === 'undo' ? ch.oldFormat : ch.newFormat;
        if (ch.oldValue !== ch.newValue) {
          ch.node.setDataValue(ch.field, value);
        }
        if (ch.formatChanged) {
          writeCellFormat(ch.node.data, ch.field, format ?? null);
        }
        after?.(ch.node);
      });
    } finally {
      undoBridge.isBulkOperation = false;
    }
    if (gridApi) refreshAfterPaste(gridApi, changes);
    recalc();
  };

  undoBridge.pushUndo({
    type: 'cell_paste',
    description: `Paste ${changes.length} ô`,
    undo: () => apply('undo'),
    redo: () => apply('redo'),
  });
}
