/**
 * Sinh `count` mã dòng custom kế tiếp theo pattern `RX{n}`.
 *
 * Chỉ đếm các mã match `^RX\d+$` (case-insensitive). Các mã khác (template rows
 * `R1`, catalog ids, v.v.) đều bị bỏ qua. Không reuse số đã xóa — max + 1 để
 * tránh đụng với custom row mà user lỡ delete trước đó nhưng có thể đã bị
 * reference ở chỗ khác.
 *
 *   nextCustomRowCodes([], 1)                   === ['RX1']
 *   nextCustomRowCodes(['RX1','RX2'], 1)        === ['RX3']
 *   nextCustomRowCodes(['R1','R2','RX5'], 3)    === ['RX6','RX7','RX8']
 *   nextCustomRowCodes(['rx1','rx2'], 1)        === ['RX3']   // case-insensitive
 */
const CUSTOM_ROW_CODE_PATTERN = /^RX(\d+)$/i;

export function nextCustomRowCodes(
  existingCodes: ReadonlyArray<string | null | undefined>,
  count: number,
): string[] {
  const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
  if (safeCount === 0) return [];
  let max = 0;
  for (const code of existingCodes) {
    if (!code) continue;
    const m = CUSTOM_ROW_CODE_PATTERN.exec(code);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return Array.from({ length: safeCount }, (_, i) => `RX${max + 1 + i}`);
}

/** True nếu row_code là dòng custom (để UI phân biệt với template rows). */
export function isCustomRowCode(code: string | null | undefined): boolean {
  return !!code && CUSTOM_ROW_CODE_PATTERN.test(code);
}
