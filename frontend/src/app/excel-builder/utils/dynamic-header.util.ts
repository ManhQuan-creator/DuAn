/**
 * Resolve dynamic header placeholders against a report year.
 *
 * Supported syntax (whitespace bên trong cho phép tự do):
 *   ${N}        → year
 *   ${N-1}      → year - 1
 *   ${ N - 1 }  → year - 1   (cùng kết quả, khoảng trắng được bỏ qua)
 *   ${N+2}      → year + 2
 *
 * Example: resolveHeaderName("Vốn năm ${N-1}", 2026) === "Vốn năm 2025"
 *
 * Designed to extend later for ${M±x}, ${Q±x} without breaking syntax.
 */
const TOKEN_PATTERN = /\$\{\s*N\s*(?:([+-])\s*(\d+))?\s*\}/g;
const MONTH_PATTERN = /\$\{\s*M\s*(?:([+-])\s*(\d+))?\s*\}/g;

export function resolveHeaderName(
  raw: string | null | undefined,
  year: number | null | undefined,
  month?: number | null | undefined
): string {
  if (raw == null) return '';
  if (year == null || !Number.isFinite(year)) return raw;
  if (raw.indexOf('${') === -1) return raw;
  
  let resolved = raw.replace(TOKEN_PATTERN, (_match, op: string | undefined, num: string | undefined) => {
    if (!op || !num) return String(year);
    const delta = op === '-' ? -Number(num) : Number(num);
    return String(year + delta);
  });

  const m = month != null ? month : new Date().getMonth() + 1;
  resolved = resolved.replace(MONTH_PATTERN, (_match, op: string | undefined, num: string | undefined) => {
    if (!op || !num) return String(m);
    const offset = Number(num);
    let calculatedMonth = op === '-' ? m - offset : m + offset;
    
    while (calculatedMonth < 1) calculatedMonth += 12;
    while (calculatedMonth > 12) calculatedMonth -= 12;
    
    return String(calculatedMonth);
  });

  return resolved;
}

export function hasDynamicHeader(raw: string | null | undefined): boolean {
  return !!raw && (/\$\{\s*N\s*(?:[+-]\s*\d+)?\s*\}/.test(raw) || /\$\{\s*M\s*(?:[+-]\s*\d+)?\s*\}/.test(raw));
}

/**
 * Strip braces khỏi placeholder `${...}` — `${N}` → `N`, `${M-1}` → `M-1`,
 * `${ N + 2 }` → ` N + 2 `. Giữ nguyên nội dung + whitespace bên trong.
 *
 * Dùng cho tài liệu PRD (Ctrl+Alt+C / Ctrl+Alt+E) muốn biểu thị tên cột / tên
 * biểu mẫu theo công thức N/M thay vì giá trị năm/tháng cụ thể (vd "Năm N-1"
 * thay vì "Năm 2025").
 */
export function stripHeaderPlaceholders(raw: string | null | undefined): string {
  if (raw == null) return '';
  return raw.replace(/\$\{([^}]+)\}/g, '$1');
}
