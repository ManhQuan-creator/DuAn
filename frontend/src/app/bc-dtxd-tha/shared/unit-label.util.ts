/**
 * Strip prefix "Công ty Điện lực " (và biến thể "TNHH MTV Điện lực ") khỏi
 * tên đơn vị PC để hiển thị gọn trên trục chart. Dropdown filter + tier
 * subtitle vẫn dùng tên đầy đủ để rõ ngữ cảnh.
 *
 * Vd: "Công ty Điện lực Bắc Ninh" → "Bắc Ninh".
 */
export function shortenUnitLabel(name: string | null | undefined): string {
  const s = String(name ?? '').trim();
  if (!s) return '';
  return s.replace(/^(Công ty|TNHH MTV)\s+Điện lực\s+/i, '');
}
