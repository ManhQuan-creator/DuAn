/**
 * Sinh mã dòng theo pattern `R{n}`.
 *
 * Chỉ đếm các mã match `^R\d+$` (case-insensitive). Các mã không theo pattern
 * (VD `r_name`, `DOANHTHU`) bị bỏ qua. Không reuse số đã xóa — max + 1 để
 * tránh phá tham chiếu công thức cũ.
 *
 *   nextRowCodes([], 1)                   === ['R1']
 *   nextRowCodes(['R1','R2','R3'], 2)     === ['R4','R5']
 *   nextRowCodes(['R1','R3'], 2)          === ['R4','R5']  // không reuse R2
 *   nextRowCodes(['r1','r2'], 1)          === ['R3']       // case-insensitive
 */
const ROW_CODE_PATTERN = /^R(\d+)$/i;

function maxRowNumber(existingCodes: ReadonlyArray<string | null | undefined>): number {
  let max = 0;
  for (const code of existingCodes) {
    if (!code) continue;
    const m = ROW_CODE_PATTERN.exec(code);
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

export function nextRowCodes(
  existingCodes: ReadonlyArray<string | null | undefined>,
  count: number,
): string[] {
  const start = maxRowNumber(existingCodes) + 1;
  return Array.from({ length: count }, (_, i) => `R${start + i}`);
}
