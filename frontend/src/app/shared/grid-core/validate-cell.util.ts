export interface CellValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  type?: 'number' | 'text' | 'date';
  minDate?: string;
  maxDate?: string;
  pattern?: string;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Pure validate function. Hoạt động cùng signature ở cả Builder & Render.
 * Caller resolve `rule` (column-level + cell-level merged) trước khi gọi.
 *
 * Quy tắc trùng Excel:
 * - `required` là check duy nhất chạy trên cell EMPTY (null/undefined/'').
 * - min/max/pattern/minDate/maxDate chỉ chạy khi cell ĐÃ NHẬP value.
 *   Lý do: cell empty có min=5 không nên hiện border đỏ tự động — user chưa nhập gì
 *   thì chưa sai. Nếu muốn ép user phải nhập, cấu hình `required: true` riêng.
 */
export function validateCellValue(value: any, rule: CellValidationRule | undefined): ValidationResult {
  if (!rule) return { valid: true };

  // `required` check — Excel-like: chỉ null/undefined/'' là empty. SỐ 0 LÀ GIÁ TRỊ HỢP LỆ
  // (số 0 cũng là dữ liệu user đã nhập, không phải empty). Nếu muốn cấm 0, dùng `min: 1`.
  const isEmpty = value == null || value === '';
  if (rule.required && isEmpty) {
    return { valid: false, message: rule.errorMessage || 'Bắt buộc nhập' };
  }

  // Cell EMPTY + không required → valid. Skip min/max/pattern/date checks.
  // Excel-like: empty cell với min=5 KHÔNG hiện border đỏ tự động (user chưa nhập gì).
  if (isEmpty) return { valid: true };

  // Min/max chỉ apply cho giá trị numeric thật. Number('abc') = NaN → skip.
  if (rule.min != null) {
    const num = Number(value);
    if (!Number.isNaN(num) && num < rule.min) {
      return { valid: false, message: rule.errorMessage || `Giá trị tối thiểu: ${rule.min}` };
    }
  }
  if (rule.max != null) {
    const num = Number(value);
    if (!Number.isNaN(num) && num > rule.max) {
      return { valid: false, message: rule.errorMessage || `Giá trị tối đa: ${rule.max}` };
    }
  }
  if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) {
    return { valid: false, message: rule.errorMessage || 'Không đúng định dạng' };
  }
  if (rule.minDate && String(value) < rule.minDate) {
    const d = rule.minDate.split('-');
    return { valid: false, message: rule.errorMessage || `Ngày tối thiểu: ${d[2]}/${d[1]}/${d[0]}` };
  }
  if (rule.maxDate && String(value) > rule.maxDate) {
    const d = rule.maxDate.split('-');
    return { valid: false, message: rule.errorMessage || `Ngày tối đa: ${d[2]}/${d[1]}/${d[0]}` };
  }
  return { valid: true };
}
