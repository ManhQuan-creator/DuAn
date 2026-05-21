import { GridApi, IRowNode } from 'ag-grid-community';
import { parseNumberVN, parseDateMulti } from './parse-value.util';
import type { CellFormat } from '../utils/cell-styles.const';

export interface PasteColumnSpec {
  /** Tên field của cột trong row data. */
  field: string;
  /** Kiểu dữ liệu cột — chi phối parser mặc định. */
  dataType?: 'number' | 'text' | 'date';
  /** Cột catalog (pinned-left, chỉ đọc — paste skip). */
  isCatalog?: boolean;
  /** Cột có formula toàn cột (tính toán, chỉ đọc — paste skip). */
  formula?: string;
}

export interface PasteContext {
  gridApi: GridApi;
  /** Matrix cột theo đúng thứ tự hiển thị. Caller lọc ra các cột data-entry. */
  columns: PasteColumnSpec[];
  /** Kiểm tra quyền edit field theo rowCode. Trả true nếu user được sửa. */
  canEdit: (field: string, rowCode: string) => boolean;
  /**
   * Lấy danh sách dropdown items hiện có cho 1 cell (nếu cell config có dropdown).
   * Đồng bộ — caller phải preload cache trước khi paste.
   * Trả string[] (tên items) hoặc null nếu cell không phải dropdown.
   */
  getDropdownItems: (field: string, rowData: any) => string[] | null;
  /**
   * Optional matrix format `[r][c]` cùng kích thước với value matrix. Khi cung cấp,
   * applyPaste sẽ replace format ở mỗi cell apply (Excel-faithful: paste cell có
   * format → set, paste cell `null` → clear). Skipped cells không bị đụng format.
   */
  formats?: (CellFormat | null)[][];
}

export type SkipReason = 'formula' | 'catalog' | 'date' | 'number' | 'dropdown' | 'permission' | 'out-of-bounds' | 'readonly';

export interface SkippedCell {
  rowIndex: number;
  colId: string;
  reason: SkipReason;
}

/** Ghi nhận mỗi cell đã thay đổi thành công — dùng để build undo action. */
export interface PasteChange {
  node: IRowNode;
  field: string;
  oldValue: any;
  newValue: any;
  /** True nếu format thay đổi (oldFormat !== newFormat). Caller dùng cho undo. */
  formatChanged?: boolean;
  /** Snapshot cũ — null = không có format trước khi paste. */
  oldFormat?: CellFormat | null;
  /** Format mới sau paste — null = đã clear format. */
  newFormat?: CellFormat | null;
}

export interface PasteResult {
  applied: number;
  skipped: SkippedCell[];
  skipCountByReason: Record<SkipReason, number>;
  /** Cell đã apply nhưng vi phạm validation rule (required/min/max…). */
  warnings: number;
  /** Danh sách change để caller push vào UndoRedoService. */
  changes: PasteChange[];
}

const EMPTY_COUNTS: Record<SkipReason, number> = {
  formula: 0,
  catalog: 0,
  date: 0,
  number: 0,
  dropdown: 0,
  permission: 0,
  'out-of-bounds': 0,
  readonly: 0,
};

/**
 * Áp clipboard matrix vào grid bắt đầu từ anchor cell.
 * Skip cell không hợp lệ (trả về trong `skipped`), apply cell hợp lệ qua
 * `node.setDataValue`. Caller tự gọi refreshCells + recalc validation sau.
 */
export function applyPaste(
  matrix: string[][],
  anchorRowIndex: number,
  anchorColIdx: number,
  ctx: PasteContext,
  validateCell: (field: string, value: any, rowData: any) => { valid: boolean },
): PasteResult {
  const result: PasteResult = {
    applied: 0,
    skipped: [],
    skipCountByReason: { ...EMPTY_COUNTS },
    warnings: 0,
    changes: [],
  };

  const totalRows = ctx.gridApi.getDisplayedRowCount();
  const totalCols = ctx.columns.length;

  for (let r = 0; r < matrix.length; r++) {
    const targetRowIdx = anchorRowIndex + r;
    if (targetRowIdx >= totalRows) {
      // Clipboard có nhiều row hơn grid → skip phần dư
      for (let c = 0; c < matrix[r].length; c++) {
        recordSkip(result, targetRowIdx, ctx.columns[anchorColIdx + c]?.field ?? '', 'out-of-bounds');
      }
      continue;
    }

    const rowNode = ctx.gridApi.getDisplayedRowAtIndex(targetRowIdx);
    if (!rowNode || !rowNode.data) continue;
    const rowData = rowNode.data;
    const rowCode = rowData.row_code ?? '';

    for (let c = 0; c < matrix[r].length; c++) {
      const targetColIdx = anchorColIdx + c;
      if (targetColIdx >= totalCols) {
        recordSkip(result, targetRowIdx, '', 'out-of-bounds');
        continue;
      }
      const col = ctx.columns[targetColIdx];
      const rawText = matrix[r][c];

      // 1. Cột catalog (pinned left, chỉ đọc toàn bộ)
      if (col.isCatalog) {
        recordSkip(result, targetRowIdx, col.field, 'catalog');
        continue;
      }
      // 2. Cột có formula toàn cột
      if (col.formula) {
        recordSkip(result, targetRowIdx, col.field, 'formula');
        continue;
      }

      // 3. Per-cell config
      const cellCfg = rowData._cellConfig?.[col.field];
      if (cellCfg?.formula) {
        recordSkip(result, targetRowIdx, col.field, 'formula');
        continue;
      }

      // 4. Permission
      if (!ctx.canEdit(col.field, rowCode)) {
        recordSkip(result, targetRowIdx, col.field, 'permission');
        continue;
      }

      // 5. Parse value theo ưu tiên: per-cell config > column dataType
      let parsed: any;
      let parseReason: SkipReason | null = null;

      if (cellCfg?.datePicker) {
        parsed = parseDateMulti(rawText);
        if (parsed == null && rawText.trim() !== '') parseReason = 'date';
        // Cho phép paste empty để clear cell
        if (rawText.trim() === '') parsed = '';
      } else if (cellCfg?.dropdown) {
        const items = ctx.getDropdownItems(col.field, rowData) ?? [];
        parsed = matchDropdownItem(rawText, items);
        if (parsed == null && rawText.trim() !== '') parseReason = 'dropdown';
        if (rawText.trim() === '') parsed = '';
      } else if (col.dataType === 'number') {
        if (rawText.trim() === '') {
          parsed = null;
        } else {
          const n = parseNumberVN(rawText);
          if (n == null) parseReason = 'number';
          else parsed = n;
        }
      } else if (col.dataType === 'date') {
        if (rawText.trim() === '') {
          parsed = '';
        } else {
          const d = parseDateMulti(rawText);
          if (d == null) parseReason = 'date';
          else parsed = d;
        }
      } else {
        // text hoặc không xác định
        parsed = rawText;
      }

      if (parseReason) {
        recordSkip(result, targetRowIdx, col.field, parseReason);
        continue;
      }

      // 6. Apply value + format — lấy oldValue/oldFormat TRƯỚC khi set để dùng cho undo
      const oldValue = rowData[col.field];
      const valueChanged = oldValue !== parsed;

      const newFormat = ctx.formats ? (ctx.formats[r]?.[c] ?? null) : undefined;
      const hasFormatPayload = newFormat !== undefined;
      const oldFormat: CellFormat | null = hasFormatPayload
        ? readCellFormat(rowData, col.field)
        : null;
      const formatChanged = hasFormatPayload && !cellFormatEqual(oldFormat, newFormat);

      if (!valueChanged && !formatChanged) {
        // No-op: cùng value + cùng format → bỏ qua để stack undo không dày
        continue;
      }

      if (valueChanged) {
        rowNode.setDataValue(col.field, parsed);
      }
      if (formatChanged) {
        writeCellFormat(rowData, col.field, newFormat);
      }
      result.applied++;
      result.changes.push({
        node: rowNode,
        field: col.field,
        oldValue,
        newValue: parsed,
        formatChanged: formatChanged || undefined,
        oldFormat: formatChanged ? oldFormat : undefined,
        newFormat: formatChanged ? newFormat : undefined,
      });

      // 7. Check validation rule sau khi apply (warn, không skip)
      const vr = validateCell(col.field, parsed, rowData);
      if (!vr.valid) result.warnings++;
    }
  }

  return result;
}

function recordSkip(result: PasteResult, rowIndex: number, colId: string, reason: SkipReason): void {
  result.skipped.push({ rowIndex, colId, reason });
  result.skipCountByReason[reason]++;
}

/**
 * Đọc snapshot format hiện tại của 1 cell (clone shallow). Trả null nếu cell
 * chưa có format. Dùng cho undo + so sánh format change.
 */
export function readCellFormat(rowData: any, field: string): CellFormat | null {
  const fmt: CellFormat | undefined = rowData?._cellConfig?.[field]?.format;
  return fmt ? { ...fmt } : null;
}

/**
 * Ghi format vào `rowData._cellConfig[field].format`. `null` = clear (delete).
 * Tự cleanup empty `_cellConfig[field]` và `_cellConfig` để không lưu rác.
 * Mutation in-place — caller cần `refreshCells({force:true})` để AG Grid re-eval cellStyle.
 */
export function writeCellFormat(
  rowData: any,
  field: string,
  fmt: CellFormat | null,
): void {
  if (!rowData) return;
  if (fmt && Object.keys(fmt).length > 0) {
    if (!rowData._cellConfig) rowData._cellConfig = {};
    const entry = { ...(rowData._cellConfig[field] ?? {}) };
    entry.format = { ...fmt };
    rowData._cellConfig[field] = entry;
    return;
  }
  // Clear format
  const cfg = rowData._cellConfig;
  if (!cfg || !cfg[field]) return;
  const entry = { ...cfg[field] };
  delete entry.format;
  if (Object.keys(entry).length) cfg[field] = entry;
  else delete cfg[field];
  if (Object.keys(cfg).length === 0) delete rowData._cellConfig;
}

function cellFormatEqual(a: CellFormat | null, b: CellFormat | null | undefined): boolean {
  const aIsEmpty = !a || Object.keys(a).length === 0;
  const bIsEmpty = !b || Object.keys(b).length === 0;
  if (aIsEmpty && bIsEmpty) return true;
  if (aIsEmpty || bIsEmpty) return false;
  return (
    a!.bold === b!.bold &&
    a!.italic === b!.italic &&
    a!.fillColor === b!.fillColor &&
    a!.textColor === b!.textColor
  );
}

/**
 * Match dropdown theo label trước, không có thì theo value. Case-insensitive.
 * Dropdown Render hiện lưu items là string[] (tên) → label = value = chuỗi.
 */
function matchDropdownItem(raw: string, items: string[]): string | null {
  if (raw == null) return null;
  const needle = String(raw).trim();
  if (needle === '') return null;
  const needleLc = needle.toLowerCase();
  for (const it of items) {
    if (String(it).trim().toLowerCase() === needleLc) return it;
  }
  return null;
}
