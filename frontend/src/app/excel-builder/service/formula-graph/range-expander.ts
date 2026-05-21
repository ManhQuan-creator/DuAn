/**
 * Expand aggregate function arguments thành tập (rowCode, field) pairs cho dependency graph.
 *
 * Mirror EXACT behavior của `formula.service.buildAggregateFunctions`:
 * - SUM/AVGROW range: rowOrder.indexOf(fromRow) → indexOf(toRow), inclusive cả 2 ends.
 *   formula.service dùng "inRange flag" với startRow first, endRow last → nếu reverse,
 *   gốc skip range. Range expander normalize về [min, max] để không bị bỏ row.
 * - SUMALL/AVG/COUNTIF: tất cả rows trong rowOrder × field.
 * - SUMIF: tất cả rows × {sumField, condField}.
 * - SUMCOL/AVGCOL: 1 row (specified rowCode hoặc current) × cols range.
 * - VLOOKUP: 1 cell.
 *
 * Tất cả deps trả về với rowCode + field ORIGINAL CASE (CI lookup → first-wins).
 * `_isTypeHeader` skip xảy ra ở runtime eval (gốc), KHÔNG ở dep — defensive.
 */

import { CellRef } from './types';

const ciLower = (s: string | undefined | null): string => (s ?? '').toLowerCase();

export interface RangeExpanderContext {
  /** rowOrder ORIGINAL CASE theo display order. */
  rowOrder: string[];
  /** Tất cả field names ORIGINAL CASE trong template. */
  allFields: string[];
  /** rowCode hiện tại của formula owner (ORIGINAL CASE). Dùng cho SUMCOL không có rowCode arg. */
  currentRowCode: string;
}

// ============ Lookup helpers (CI first-wins → original case) ============

/** Tìm rowCode original case từ token (CI). Returns null nếu không match. */
function findRowOriginal(token: string, rowOrder: string[]): string | null {
  const lo = ciLower(token);
  for (const rc of rowOrder) {
    if (ciLower(rc) === lo) return rc; // first-wins
  }
  return null;
}

/** Tìm field original case từ token (CI). Returns null nếu không match. */
function findFieldOriginal(token: string, allFields: string[]): string | null {
  const lo = ciLower(token);
  for (const f of allFields) {
    if (ciLower(f) === lo) return f; // first-wins
  }
  return null;
}

/** Tìm index của row trong rowOrder (CI). Returns -1 nếu không match. */
function findRowIndex(token: string, rowOrder: string[]): number {
  const lo = ciLower(token);
  return rowOrder.findIndex(rc => ciLower(rc) === lo);
}

/** Tìm index của field trong allFields (CI). Returns -1 nếu không match. */
function findFieldIndex(token: string, allFields: string[]): number {
  const lo = ciLower(token);
  return allFields.findIndex(f => ciLower(f) === lo);
}

/**
 * Tách args của aggregate call. Strip quote/whitespace.
 * Ví dụ input `"VAT2024", "PCHP", "PCND"` → ["VAT2024", "PCHP", "PCND"].
 */
function parseArgs(argsStr: string): string[] {
  return argsStr.split(',').map(a => a.trim().replace(/^['"]|['"]$/g, ''));
}

// ============ Per-function expanders ============

/**
 * Expand SUM(field, fromRow, toRow) → list (rowCode, field).
 * Inclusive cả 2 endpoints. Nếu fromRow/toRow không tìm thấy trong rowOrder → empty.
 */
export function expandSum(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 3) return { deps: [] };

  const field = findFieldOriginal(args[0], ctx.allFields) ?? args[0];
  const fromIdx = findRowIndex(args[1], ctx.rowOrder);
  const toIdx = findRowIndex(args[2], ctx.rowOrder);
  if (fromIdx === -1 || toIdx === -1) return { deps: [] };

  const [min, max] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
  const rows = ctx.rowOrder.slice(min, max + 1);
  return { deps: rows.map(rc => ({ rowCode: rc, field })) };
}

/** SUMALL(field) → tất cả rows × field. */
export function expandSumAll(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 1) return { deps: [] };
  const field = findFieldOriginal(args[0], ctx.allFields) ?? args[0];
  return { deps: ctx.rowOrder.map(rc => ({ rowCode: rc, field })) };
}

/**
 * SUMIF(sumField, condField, condValue) → tất cả rows × {sumField, condField}.
 * Cả 2 fields đều là deps vì SUMIF cần đọc condField để check, sumField để cộng.
 */
export function expandSumIf(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 3) return { deps: [] };

  const sumField = findFieldOriginal(args[0], ctx.allFields) ?? args[0];
  const condField = findFieldOriginal(args[1], ctx.allFields) ?? args[1];
  const distinct = ciLower(sumField) !== ciLower(condField);

  const deps: CellRef[] = [];
  for (const rc of ctx.rowOrder) {
    deps.push({ rowCode: rc, field: sumField });
    if (distinct) deps.push({ rowCode: rc, field: condField });
  }
  return { deps };
}

/** AVG(field) — tất cả rows × field (giống SUMALL). */
export function expandAvg(argsStr: string, ctx: RangeExpanderContext) {
  return expandSumAll(argsStr, ctx);
}

/** COUNTIF(field, condValue) — tất cả rows × field. */
export function expandCountIf(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 2) return { deps: [] };
  const field = findFieldOriginal(args[0], ctx.allFields) ?? args[0];
  return { deps: ctx.rowOrder.map(rc => ({ rowCode: rc, field })) };
}

/** AVGROW(field, fromRow, toRow) — giống SUM. */
export function expandAvgRow(argsStr: string, ctx: RangeExpanderContext) {
  return expandSum(argsStr, ctx);
}

/**
 * SUMCOL/AVGCOL(startCol, endCol, rowCode?) — 1 row × cols range.
 * cols range tính theo allFields order (mirror formula.service.colFieldRange logic).
 */
export function expandColRange(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 2) return { deps: [] };

  const rowCode = args.length >= 3 && args[2]
    ? (findRowOriginal(args[2], ctx.rowOrder) ?? args[2])
    : ctx.currentRowCode;

  const startIdx = findFieldIndex(args[0], ctx.allFields);
  const endIdx = findFieldIndex(args[1], ctx.allFields);
  if (startIdx === -1 || endIdx === -1) return { deps: [] };

  const [min, max] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  const fields = ctx.allFields.slice(min, max + 1);
  return { deps: fields.map(f => ({ rowCode, field: f })) };
}

/** VLOOKUP(rowCode, field) — 1 cell. */
export function expandVlookup(argsStr: string, ctx: RangeExpanderContext): { deps: CellRef[] } {
  const args = parseArgs(argsStr);
  if (args.length < 2) return { deps: [] };
  const rowCode = findRowOriginal(args[0], ctx.rowOrder) ?? args[0];
  const field = findFieldOriginal(args[1], ctx.allFields) ?? args[1];
  return { deps: [{ rowCode, field }] };
}

// ============ Dispatcher ============

/** Aggregate function name → expander. */
const EXPANDERS: { [fn: string]: (argsStr: string, ctx: RangeExpanderContext) => { deps: CellRef[] } } = {
  SUM: expandSum,
  SUMALL: expandSumAll,
  SUMIF: expandSumIf,
  SUMCOL: expandColRange,
  AVGCOL: expandColRange,
  COUNTIF: expandCountIf,
  AVG: expandAvg,
  AVGROW: expandAvgRow,
  VLOOKUP: expandVlookup,
};

/** Tên các aggregate function được handle — dùng để build regex scan trong extractor. */
export const AGGREGATE_FNS = Object.keys(EXPANDERS);

/** Dispatch: gọi expander tương ứng `fn` (case-insensitive). Returns [] nếu không match. */
export function expandAggregate(
  fn: string,
  argsStr: string,
  ctx: RangeExpanderContext,
): CellRef[] {
  const expander = EXPANDERS[fn.toUpperCase()];
  if (!expander) return [];
  return expander(argsStr, ctx).deps;
}
