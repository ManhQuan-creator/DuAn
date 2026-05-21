/**
 * Các hàm format dùng cho dashboard SCL.
 *
 * Không state, không DI — thuần function. Dùng trong template với pipe-like
 * syntax hoặc gọi trực tiếp trong `valueFormatter` của AG Grid.
 */

/** "70680.77" → "70.681 trđ" (giá trị đã ở đơn vị triệu VND). */
export function formatCurrencyTrd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)} trđ`;
}

/** 0.2102 → "21,0%". Nhận giá trị DECIMAL (0..1), không phải %. */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(fractionDigits).replace('.', ',')}%`;
}

/** 1072 → "1.072". Số nguyên chia ngăn ngàn vi-VN. */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('vi-VN').format(value);
}

/** 1375840.16 → "1,376 tỷ". Cho KPI card (trđ → tỷ). */
export function formatBillionTrd(value: number | null | undefined, fractionDigits = 3): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const billions = value / 1000;
  return `${billions.toFixed(fractionDigits).replace('.', ',')} tỷ`;
}
