/** Escape ký tự đặc biệt trong colId để dùng trong CSS attribute selector. */
export function escapeCss(value: string): string {
  return String(value).replace(/["\\]/g, '\\$&');
}
