/**
 * Sinh chuỗi alphanumeric ngẫu nhiên độ dài cho trước.
 * Dùng làm suffix khi row_code bị trùng (rule: chỉ chữ + số).
 */
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomAlnum(length: number): string {
  if (length < 1) return '';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUMERIC.charAt(Math.floor(Math.random() * ALPHANUMERIC.length));
  }
  return out;
}

/**
 * Tạo row_code unique bằng cách thêm suffix ngẫu nhiên (mặc định 6 ký tự) khi `base` đã tồn tại.
 * So khớp `existingKeys` ignore-case. Retry tối đa `maxTries`; nếu vẫn trùng → fallback timestamp.
 *
 * Guards:
 * - `suffixLen <= 0` → trả `base` luôn (không thêm gì) để tránh infinite loop khi base đã trùng.
 * - `maxTries <= 0` → tương tự, fallback ngay.
 */
export function uniqueRowCode(
  base: string,
  existingKeys: Set<string>,
  suffixLen = 6,
  maxTries = 10,
): string {
  if (!existingKeys.has(base.toLowerCase())) return base;
  if (suffixLen <= 0 || maxTries <= 0) {
    // Không có cách thêm ký tự ngẫu nhiên → fallback timestamp ngay
    return `${base}${Date.now().toString(36)}`;
  }
  for (let i = 0; i < maxTries; i++) {
    const candidate = `${base}${randomAlnum(suffixLen)}`;
    if (!existingKeys.has(candidate.toLowerCase())) return candidate;
  }
  // Fallback: timestamp suffix — luôn unique trong run
  return `${base}${Date.now().toString(36)}`;
}
