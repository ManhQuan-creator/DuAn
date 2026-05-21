import { CELL_STYLES, styleForFormulaError } from '../utils/cell-styles.const';

/** ISO `YYYY-MM-DD` → `DD/MM/YYYY`. Empty/non-match → ''. */
export function formatIsoDate(value: any): string {
  if (!value) return '';
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}

export interface FormatCellInput {
  value: any;
  data?: any;
}

export interface FormatCellColumnContext {
  field: string;
  dataType?: 'number' | 'text' | 'date';
}

/**
 * Format value chuẩn cho cell:
 * - Error string (`#XXX!`) → giữ nguyên
 * - cellCfg.datePicker → DD/MM/YYYY
 * - cellCfg.dropdown → string raw
 * - column.dataType=text → string raw, EXCEPT khi có `format.decimals/percent` +
 *   value parse được số → best-effort format như number (Excel parity: text-stored
 *   numbers vẫn honor numFmt).
 * - column.dataType=date → DD/MM/YYYY
 * - default (number / formula) → vi-VN number
 */
export function formatCellValue(p: FormatCellInput, config: FormatCellColumnContext): string {
  if (typeof p.value === 'string' && p.value.startsWith('#')) return p.value;
  const cellCfg = p.data?._cellConfig?.[config.field];
  if (cellCfg?.datePicker) return formatIsoDate(p.value);
  if (cellCfg?.dropdown) return p.value != null && p.value !== '' ? String(p.value) : '';
  if (config.dataType === 'text') {
    if (p.value == null || p.value === '') return '';
    if (hasNumericFormat(cellCfg?.format)) {
      const num = Number(p.value);
      if (Number.isFinite(num)) return formatNumberWithCellFormat(num, cellCfg.format);
    }
    return String(p.value);
  }
  if (config.dataType === 'date') return formatIsoDate(p.value);
  if (p.value == null || p.value === '') return '';
  return formatNumberWithCellFormat(Number(p.value), cellCfg?.format);
}

/** Cell có format số explicit (decimals hoặc percent). Dùng cho best-effort text-column. */
function hasNumericFormat(
  fmt?: { decimals?: number; percent?: boolean } | null,
): fmt is { decimals?: number; percent?: boolean } {
  return !!fmt && (fmt.decimals != null || !!fmt.percent);
}

/**
 * Format số theo `_cellConfig.format` (decimals + percent). Tách helper để tránh
 * inline magic ở `formatCellValue` + tái sử dụng được nếu nơi khác cần.
 *   - percent=true → giá trị × 100, suffix `%`
 *   - decimals=N  → ép đúng N chữ số thập phân (min=max=N)
 *   - decimals undefined → cho phép tới 10 chữ số (full precision với trailing zero ẩn).
 *     Default Intl vi-VN cap ở 3 decimals → thấy `1/3 = 0,333` (mất chính xác). Cap 10
 *     để giữ đủ chính xác công thức (vd `=1/7` → `0,1428571429`) mà không quá dài.
 */
function formatNumberWithCellFormat(
  raw: number,
  fmt?: { decimals?: number; percent?: boolean } | null,
): string {
  if (!Number.isFinite(raw)) return String(raw);
  const num = fmt?.percent ? raw * 100 : raw;
  const opts: Intl.NumberFormatOptions =
    fmt?.decimals != null
      ? { minimumFractionDigits: fmt.decimals, maximumFractionDigits: fmt.decimals }
      : { maximumFractionDigits: 10 };
  const formatted = new Intl.NumberFormat('vi-VN', opts).format(num);
  return fmt?.percent ? `${formatted}%` : formatted;
}

/**
 * Parse user input cho cell number theo `_cellConfig.format`. Trả về raw value
 * sẽ store vào DB — KHÔNG bao gồm % suffix (raw = 0.1 cho display "10%").
 *
 * Excel "Auto Percent Entry" semantics:
 *   - Cell có percent=true → auto ÷100 cho mọi input số. User nhập "10" → 0.1.
 *   - User gõ "10%" (có suffix) → strip "%" rồi ÷100 → 0.1. Đảm bảo đồng nhất.
 *   - Cell không có percent → parse Number trực tiếp.
 *   - Empty/null → null.
 *   - NaN → null (caller nên reject hoặc giữ giá trị cũ).
 *
 * Hàm trả về `null` cho empty/invalid; caller check để decide reject hay accept.
 */
export function parseNumberInputForCell(
  raw: any,
  fmt?: { decimals?: number; percent?: boolean } | null,
): number | null {
  if (raw === '' || raw == null) return null;
  let str = String(raw).trim();
  if (!str) return null;
  // Strip % suffix (user gõ "10%" hay "10 %")
  if (str.endsWith('%')) str = str.slice(0, -1).trim();
  str = normalizeNumericString(str);
  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  // Cell có format % → auto ÷100 (Excel auto-percent-entry behavior)
  return fmt?.percent ? num / 100 : num;
}

/**
 * Chuẩn hoá string số về JS-parseable format. Heuristic "last separator is decimal":
 *   - "10.000,5"  (vi-VN có thousands)  → "10000.5"   (`,` là decimal, strip `.`)
 *   - "10,000.5"  (English có thousands) → "10000.5"   (`.` là decimal, strip `,`)
 *   - "12,34"     (vi-VN)                → "12.34"
 *   - "12.34"     (English / vi-VN không thousands) → "12.34"
 *   - "10.000.000" (vi-VN thousands only) → "10000000" (multiple `.` → strip all)
 *   - "1,000,000"  (English thousands only) → "1000000" (multiple `,` → strip all)
 */
function normalizeNumericString(str: string): string {
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Cả 2 separators — cái xuất hiện sau cùng = decimal.
    if (lastComma > lastDot) {
      return str.replace(/\./g, '').replace(',', '.');
    }
    return str.replace(/,/g, '');
  }
  if (lastComma >= 0) {
    // Chỉ "," — multiple = thousands; single = decimal (vi-VN).
    const commaCount = (str.match(/,/g) || []).length;
    return commaCount > 1 ? str.replace(/,/g, '') : str.replace(',', '.');
  }
  if (lastDot >= 0) {
    // Chỉ "." — multiple = vi-VN thousands; single = decimal (mặc định).
    const dotCount = (str.match(/\./g) || []).length;
    return dotCount > 1 ? str.replace(/\./g, '') : str;
  }
  return str;
}

export type ErrorStyleResolver = (errorValue: string) => any;

/**
 * Builder dùng `CELL_STYLES.ERROR` cho mọi error → resolver = `() => CELL_STYLES.ERROR`.
 * Render phân biệt warning vs error → resolver = `styleForFormulaError`.
 */
export const BUILDER_ERROR_STYLE: ErrorStyleResolver = () => CELL_STYLES.ERROR;
export const RENDER_ERROR_STYLE: ErrorStyleResolver = styleForFormulaError;

/**
 * Preset style theo cellCfg/value/column type. Trả `null` nếu không match preset nào.
 *
 * @param errorStyle resolver cho `#XXX!` value — Builder vs Render khác nhau.
 */
export function cellPresetStyle(
  params: { value: any },
  config: { formula?: string },
  cellCfg: any,
  errorStyle: ErrorStyleResolver,
): any | null {
  if (typeof params.value === 'string' && params.value.startsWith('#')) {
    return errorStyle(params.value);
  }
  if (cellCfg?.datePicker) return CELL_STYLES.DATE;
  if (cellCfg?.dropdown) return CELL_STYLES.DROPDOWN;
  if (cellCfg?.formula) return CELL_STYLES.FORMULA_CELL;
  if (config.formula) return CELL_STYLES.FORMULA_COLUMN;
  return null;
}
