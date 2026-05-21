import { SelectOption } from '../../shared/components/multi-select';

/**
 * Build danh sách năm cho dropdown filter ở dashboard + form.
 * Mặc định: 4 năm quá khứ + năm hiện tại + 1 năm tương lai (KH năm sau).
 *
 * @param base Năm gốc (default = năm hiện tại). Cho phép inject để test.
 * @param past Số năm quá khứ. Default 4.
 * @param future Số năm tương lai. Default 1.
 */
export function buildYearOptions(
  base: number = new Date().getFullYear(),
  past: number = 4,
  future: number = 1,
): SelectOption<number>[] {
  const years: SelectOption<number>[] = [];
  for (let y = base + future; y >= base - past; y--) {
    years.push({ value: y, label: String(y) });
  }
  return years;
}
