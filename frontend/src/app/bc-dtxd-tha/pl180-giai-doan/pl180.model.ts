/**
 * Types cho dashboard PL180 - TH ĐT theo giai đoạn giao TCT.
 *
 * Template: M21 (seed V13).
 * Rows: 1 TONG_CONG + 32 đơn vị (24 PC + 8 đơn vị khác).
 * Mỗi row 15 metric: 3 nhóm × 5 cell.
 *
 * 3 nhóm:
 *  - tong   (Tổng KH 2024)
 *  - truoc  (Giao trước 1/1/2024)
 *  - trong  (Giao từ 1/1 → 31/12/2024)
 * Quan hệ: tong = truoc + trong.
 */

export interface Pl180Row {
  row_code: string;
  stt?: string;
  donVi?: string;

  tongSoCT?: number | string; tongTmdt?: number | string; tongHt?: number | string;
  tongChuaHt?: number | string; tongTyleHt?: number | string;

  truocSoCT?: number | string; truocTmdt?: number | string; truocHt?: number | string;
  truocChuaHt?: number | string; truocTyleHt?: number | string;

  trongSoCT?: number | string; trongTmdt?: number | string; trongHt?: number | string;
  trongChuaHt?: number | string; trongTyleHt?: number | string;

  ghiChu?: string;
  _isTypeHeader?: boolean;
  [k: string]: unknown;
}

export const PL180_TONG_CONG = 'TONG';

export const PL180_PHASES = [
  { prefix: 'truoc', label: 'Giao trước 1/1', color: '#3b82f6' },
  { prefix: 'trong', label: 'Giao trong năm', color: '#f59e0b' },
] as const;

export interface Pl180Kpi {
  tongSoCT: number;
  tongTmdt: number;
  truocTmdt: number;
  trongTmdt: number;
  tyleHtNam: number | null;
}

export interface Pl180PhaseBreakdown {
  prefix: string;
  label: string;
  color: string;
  soCT: number;
  tmdt: number;
  ht: number;
  chuaHt: number;
  tyleHt: number | null;
}

export interface Pl180UnitBreakdown {
  unit: string;
  tongSoCT: number;
  tongTmdt: number;
  truocTmdt: number;
  trongTmdt: number;
  tongTyleHt: number | null;
}
