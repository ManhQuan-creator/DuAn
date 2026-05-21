import { PeriodType } from '../../excel-builder/models/grid-template.model';

/**
 * Constants + helpers cho `PeriodType` (kỳ báo cáo).
 *
 * Convention DB: cùng cột `month` lưu mọi kỳ — quy đổi:
 *   YEAR      → null
 *   HALF_YEAR → 6 (H1) | 12 (H2)
 *   QUARTER   → 3 (Q1) | 6 (Q2) | 9 (Q3) | 12 (Q4)
 *   MONTH     → 1..12
 *
 * Hai nơi đang dùng (mỗi nơi tự build options theo value scheme phù hợp):
 *  - Filter "kỳ báo cáo" ở excel-render report mode (value = month DB).
 *  - Form tạo entry ở create-entry-dialog (value = ordinal Q/H, map về month khi submit).
 */

/** Quý → tháng đại diện trong DB (ordinal 1..4 → month 3/6/9/12). */
export const QUARTER_TO_MONTH = { 1: 3, 2: 6, 3: 9, 4: 12 } as const;
/** Reverse: month → ordinal quý (chỉ định nghĩa cho 4 mốc 3/6/9/12). */
export const MONTH_TO_QUARTER: Record<number, 1 | 2 | 3 | 4 | undefined> = {
  3: 1, 6: 2, 9: 3, 12: 4,
};

/** Nửa năm → tháng đại diện (ordinal 1..2 → month 6/12). */
export const HALF_YEAR_TO_MONTH = { 1: 6, 2: 12 } as const;
/** Reverse: month → ordinal H1/H2 (chỉ định nghĩa cho 6, 12). */
export const MONTH_TO_HALF_YEAR: Record<number, 1 | 2 | undefined> = {
  6: 1, 12: 2,
};

/** Label tiếng Việt cho ordinal quý. */
export const QUARTER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Quý 1',
  2: 'Quý 2',
  3: 'Quý 3',
  4: 'Quý 4',
};

/** Label tiếng Việt cho ordinal nửa năm. */
export const HALF_YEAR_LABELS: Record<1 | 2, string> = {
  1: '6 tháng đầu năm',
  2: '6 tháng cuối năm',
};

/** Số tháng cố định 1..12 — tiện cho .map() khi cần tạo dropdown tháng. */
export const MONTH_VALUES: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Format label tháng dạng "Tháng N" — đồng nhất giữa các nơi build dropdown. */
export function formatMonthLabel(month: number): string {
  return `Tháng ${month}`;
}

/**
 * Có cần hiển thị input chọn kỳ không. Báo cáo theo năm thì 1 entry/năm/org → ẩn input.
 * Các kỳ khác đều cần NSD chọn để filter/tạo entry.
 */
export function shouldShowPeriodInput(period: PeriodType | null | undefined): boolean {
  return period != null && period !== 'YEAR';
}
