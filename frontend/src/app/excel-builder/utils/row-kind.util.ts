/**
 * Phân loại row trong grid Builder/Render — DRY các flag `_isTypeHeader`,
 * `_catalogField` rải rác ở nhiều callback (`rowDrag`, `editable`, `cellStyle`,
 * `cellRenderer`).
 *
 * 3 loại:
 * - `typeHeader`: row header phân nhóm (vd "DOANH THU", "CHI PHÍ") — không edit,
 *   kéo cả nhóm theo
 * - `catalogItem`: row là item từ catalog import (catalog manager) — không edit,
 *   không kéo, không xóa
 * - `manualRow`: row do user tạo qua "Thêm dòng" — full quyền edit/drag/delete
 */
export type RowKind = 'typeHeader' | 'catalogItem' | 'manualRow';

export function getRowKind(data: any): RowKind {
  if (data?._isTypeHeader) return 'typeHeader';
  if (data?._catalogField) return 'catalogItem';
  return 'manualRow';
}
