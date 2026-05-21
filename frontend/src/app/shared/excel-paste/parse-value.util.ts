/**
 * Parse giá trị text clipboard về kiểu dữ liệu của cell target.
 * Mỗi parser trả về `null` khi input không match — caller dùng null = SKIP.
 */

/**
 * Parse number theo locale VN: `1.234,56` (dấu `.` phân nhóm, `,` decimal).
 * Chấp nhận luôn dạng thuần `1234.56` (không có group separator) để tương thích
 * khi user nhập tay hoặc copy từ nguồn khác.
 *
 * Trả về number hoặc null nếu không parse được.
 */
export function parseNumberVN(raw: string): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === '') return null;

  // Case 1: có dấu `,` → VN locale có decimal (vd "1.234,56" hoặc "123,45")
  //   → remove `.` (group sep), đổi `,` thành `.`
  // Case 2: không có `,` → có thể là
  //   - "1.234" (3 số sau dấu `.` → group sep, không phải decimal) → remove `.`
  //   - "1.23"  (≤2 số sau dấu `.` → ambiguous; coi là decimal kiểu en)
  //   - "1234"  (số nguyên)
  let normalized: string;
  if (trimmed.includes(',')) {
    normalized = trimmed.replace(/\./g, '').replace(',', '.');
  } else if (trimmed.includes('.')) {
    // Heuristic: nếu có NHIỀU dấu `.` → group sep ("1.234.567") → remove hết
    const dots = trimmed.split('.').length - 1;
    if (dots > 1) {
      normalized = trimmed.replace(/\./g, '');
    } else {
      // 1 dấu `.` — kiểm tra số chữ số sau dấu: nếu đúng 3 → group sep
      const parts = trimmed.split('.');
      if (parts[1].length === 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
        normalized = trimmed.replace('.', '');
      } else {
        normalized = trimmed; // giữ nguyên — coi là decimal
      }
    }
  } else {
    normalized = trimmed;
  }

  // Cho phép dấu âm ở đầu
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse date từ string sang ISO `yyyy-MM-dd`. Hỗ trợ các format:
 *  - yyyy-MM-dd, yyyy/MM/dd
 *  - dd-MM-yyyy, dd/MM/yyyy
 *  - m/d/yyyy  (US short — 1 hoặc 2 chữ số)
 *
 * Trả về string ISO hoặc null nếu không match format nào hoặc date không hợp lệ.
 */
export function parseDateMulti(raw: string): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;

  // yyyy-MM-dd hoặc yyyy/MM/dd
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return buildIso(+m[1], +m[2], +m[3]);

  // dd-MM-yyyy hoặc dd/MM/yyyy (day trước, có thể 1 hoặc 2 số)
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const d = +m[1];
    const mo = +m[2];
    const y = +m[3];
    // m/d/yyyy US (tháng trước): chỉ khi d > 12 → chắc chắn VN format
    // Nếu d ≤ 12 và mo ≤ 12 → ambiguous: ưu tiên VN format (dd/MM/yyyy)
    // để nhất quán với locale ứng dụng.
    if (d > 12 && mo > 12) return null;
    if (d > 12) {
      // Chắc chắn dd-MM-yyyy
      return buildIso(y, mo, d);
    }
    // Mặc định coi là VN dd/MM/yyyy (phù hợp với locale VN app)
    return buildIso(y, mo, d);
  }

  return null;
}

function buildIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  // Dùng Date để check ngày có hợp lệ không (vd 31/02 → Date sẽ chuyển tháng)
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return null;
  }
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Lookup catalog item theo label trước, không có thì thử value.
 * `items` có thể là array object { value, label } hoặc { code, name } — caller
 * truyền key tương ứng.
 *
 * Trả về value cuối (thường là `value` hoặc `code`) hoặc null nếu không match.
 */
export function lookupCatalogValue(
  raw: string,
  items: Array<{ label?: string; value?: any; name?: string; code?: any }>,
  labelKeys: Array<'label' | 'name'> = ['label', 'name'],
  valueKeys: Array<'value' | 'code'> = ['value', 'code'],
): any | null {
  if (raw == null) return null;
  const needle = String(raw).trim();
  if (needle === '') return null;
  const needleLc = needle.toLowerCase();

  // 1. Match label (case-insensitive)
  for (const item of items) {
    for (const k of labelKeys) {
      const lbl = (item as any)[k];
      if (lbl != null && String(lbl).trim().toLowerCase() === needleLc) {
        for (const vk of valueKeys) {
          const v = (item as any)[vk];
          if (v != null) return v;
        }
      }
    }
  }

  // 2. Match value (case-insensitive)
  for (const item of items) {
    for (const vk of valueKeys) {
      const v = (item as any)[vk];
      if (v != null && String(v).trim().toLowerCase() === needleLc) {
        return v;
      }
    }
  }

  return null;
}
