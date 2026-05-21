import { SelectOption } from '../../shared/components/multi-select';

/**
 * Build danh sách năm cho dropdown filter ở dashboard ĐTXD 110kV.
 * Mặc định: 4 năm quá khứ + năm hiện tại + 1 năm tương lai (KH năm sau).
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
