/**
 * Style cell dùng chung cho Excel Builder + Excel Render.
 * Mỗi entry là object hợp lệ cho `colDef.cellStyle` của AG Grid.
 *
 * Mục đích: gom màu sắc/font về 1 nơi → muốn rebrand chỉ sửa 1 file.
 *
 * Convention màu:
 * - Đỏ (#dc2626 / #fef2f2): error
 * - Vàng (#92400e / #fffbeb): warning (NODATA/NOROW lookup)
 * - Xanh dương (#1e40af / #f0f9ff): date
 * - Tím (#6d28d9 / #f5f3ff): dropdown
 * - Cam (#ea580c #007bff / #fff7ed): formula (cell-level cam, column-level xanh)
 * - Xám (#9ca3af #6b7280 / #f9fafb #f1f5f9): readonly / locked / type-header
 */
/**
 * Validation invalid dùng `box-shadow inset` (KHÔNG dùng `border`, KHÔNG dùng
 * `outline`).
 *
 * Lý do KHÔNG dùng border: AG Grid v35 vẽ border dọc giữa cột qua
 * `--ag-cell-horizontal-border` → compile thành `border-right` trên `.ag-cell`.
 * Nếu cellStyle inline set `border: ...`, inline-style đè class → mất đường dọc.
 *
 * Lý do KHÔNG dùng outline: outline 2px với offset -2px vẽ Ở TRONG cell sát đáy.
 * Nhưng `.ag-row { border-bottom: 1px gray }` (row separator) sit NGAY DƯỚI cell →
 * 2 thứ ở vùng visual chồng nhau, browser z-index/painting order có thể clip 1px
 * outline ở bottom → outline visual bottom < 2px (lệch top).
 *
 * `box-shadow: inset 0 0 0 2px` vẽ inner shadow TRÊN BỀ MẶT cell — đảm bảo 2px
 * đều 4 cạnh, KHÔNG đụng box-model, KHÔNG bị row border-bottom interfere.
 *
 * Hệ quả: preset reset cần clear box-shadow (`boxShadow: 'none'`) thay vì outline
 * (AG Grid không tự reset CSS keys giữa state).
 */
const SHADOW_RESET = { boxShadow: 'none', outline: 'none', outlineOffset: '0' } as const;
const VALIDATION_INVALID_OUTLINE = { boxShadow: 'inset 0 0 0 2px #dc2626', outline: 'none', outlineOffset: '0' } as const;

export const CELL_STYLES = {
  /** Type-header row legacy (nền xám nhạt + bold) */
  TYPE_HEADER: { backgroundColor: '#f1f5f9', fontWeight: '700', ...SHADOW_RESET },

  /** Dòng bị khóa quyền chỉnh sửa (whole row) */
  LOCKED_ROW: { backgroundColor: '#f9fafb', ...SHADOW_RESET },

  /** Cell bị khóa quyền (chỉ 1 cell) */
  LOCKED_CELL: { backgroundColor: '#f9fafb', color: '#9ca3af', ...SHADOW_RESET },

  /** Lỗi công thức (#SYNTAX!, #REF!, #CIRCULAR!, #DIV/0!, #VALUE!, #NOCOL!, #NOTEMPLATE!) */
  ERROR: { backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: '600', ...SHADOW_RESET },

  /** Warning (#NODATA!, #NOROW! — formula đúng cú pháp, chỉ thiếu data; user cần nhập nguồn) */
  WARNING: { backgroundColor: '#fffbeb', color: '#92400e', fontWeight: '600', ...SHADOW_RESET },

  /** Cell ngày tháng */
  DATE: { backgroundColor: '#f0f9ff', color: '#1e40af', ...SHADOW_RESET },

  /** Cell ngày tháng + validation fail */
  DATE_INVALID: { backgroundColor: '#f0f9ff', color: '#1e40af', ...VALIDATION_INVALID_OUTLINE },

  /** Cell dropdown */
  DROPDOWN: { backgroundColor: '#f5f3ff', color: '#6d28d9', ...SHADOW_RESET },

  /** Cell công thức level CỘT (toàn cột mặc định) */
  FORMULA_COLUMN: { backgroundColor: '#fff7ed', fontStyle: 'italic', color: '#007bff', ...SHADOW_RESET },

  /** Cell công thức level Ô (override công thức cột) */
  FORMULA_CELL: { backgroundColor: '#fff7ed', fontStyle: 'italic', color: '#ea580c', ...SHADOW_RESET },

  /** Reset về cell data thường (override outline đỏ từ state invalid trước). */
  DATA_NORMAL: { backgroundColor: '#ffffff', color: '#000000', fontStyle: 'normal', ...SHADOW_RESET },

  /** Outline đỏ khi cell vi phạm validation rule (giữ nguyên bg + border-right theme) */
  VALIDATION_INVALID_BORDER: { ...VALIDATION_INVALID_OUTLINE },

  /** Cột row_code — type-header row (xám nhạt, italic) */
  ROW_CODE_HEADER: { color: '#6b7280', fontStyle: 'italic', ...SHADOW_RESET },

  /** Cột row_code — catalog item row (xám nhạt) */
  ROW_CODE_CATALOG: { color: '#6b7280', fontStyle: 'normal', ...SHADOW_RESET },

  /** Cột row_code — manual row (xanh dương đậm) */
  ROW_CODE_NORMAL: { color: '#2563eb', fontWeight: '600', fontStyle: 'normal', ...SHADOW_RESET },
} as const;

/** Map mã lỗi formula → style. Tách riêng để engine có thể lookup nhanh. */
export function styleForFormulaError(errorCode: string): typeof CELL_STYLES[keyof typeof CELL_STYLES] {
  if (errorCode === '#NODATA!' || errorCode === '#NOROW!') return CELL_STYLES.WARNING;
  return CELL_STYLES.ERROR;
}

/**
 * Cấu hình format do user áp lên cell qua toolbar (Bold/Italic/Fill/Text color).
 * Lưu vào `_cellConfig[field].format`. Thiếu key = không áp.
 */
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  fillColor?: string;   // CSS hex, vd "#fbbf24"
  textColor?: string;   // CSS hex, vd "#dc2626"
  /** Số chữ số thập phân (0-10). Undefined = format mặc định theo locale. */
  decimals?: number;
  /** True = nhân giá trị × 100 + suffix `%` (Excel-standard). */
  percent?: boolean;
}

/**
 * Merge ngang (Phase 1 — horizontal only).
 * Lưu trên cell ANCHOR (cell trái nhất của vùng merged):
 *   _cellConfig[anchorField].merge = { colSpan: N }   // N >= 2
 * Cell bị bao phủ:
 *   _cellConfig[hiddenField].mergedBy = anchorField   // string
 */
export interface CellMerge {
  colSpan?: number;
}

/** Đọc colSpan effective của cell (>= 1). Dùng cho AG Grid `colSpan` callback. */
export function cellColSpan(cellCfg?: { merge?: CellMerge } | null): number {
  const span = cellCfg?.merge?.colSpan;
  return span && span > 1 ? span : 1;
}

/**
 * Trả style fontWeight/fontStyle/backgroundColor/color cho cell theo
 * cấu hình `_cellConfig[field].format`. Chỉ chứa key đang bật → spread sau preset.
 */
export function cellFormatStyle(
  cellCfg?: { format?: CellFormat } | null,
): { fontWeight?: string; fontStyle?: string; backgroundColor?: string; color?: string } {
  const fmt = cellCfg?.format;
  if (!fmt) return {};
  const out: { fontWeight?: string; fontStyle?: string; backgroundColor?: string; color?: string } = {};
  if (fmt.bold) out.fontWeight = '700';
  if (fmt.italic) out.fontStyle = 'italic';
  if (fmt.fillColor) out.backgroundColor = fmt.fillColor;
  if (fmt.textColor) out.color = fmt.textColor;
  return out;
}
