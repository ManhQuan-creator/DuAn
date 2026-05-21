/**
 * Types cho dashboard PL182 - TH Giám sát đánh giá đầu tư TCT.
 *
 * Template: M19 (seed V13, periodType=HALF_YEAR).
 * Cấu trúc: Biểu 3.1 NĐ 29/2021. 3 section I/II/III, ~30 row con.
 * 13 cols: stt, noiDung, tongCong, dtc{Tong|Qtqg|A|B|C}, ngdtc{Tong|Qtqg|A|B|C}.
 * KHÔNG có data theo PC — toàn TCT.
 */

export interface Pl182Row {
  row_code: string;
  stt?: string;
  noiDung?: string;

  tongCong?: number | string;
  dtcTong?:  number | string; dtcQtqg?: number | string;
  dtcA?: number | string; dtcB?: number | string; dtcC?: number | string;
  ngdtcTong?: number | string; ngdtcQtqg?: number | string;
  ngdtcA?: number | string; ngdtcB?: number | string; ngdtcC?: number | string;

  _isTypeHeader?: boolean;
  [k: string]: unknown;
}

/** Row codes cố định trong V13 seed. */
export const PL182_CODES = {
  // Mục I — Chuẩn bị
  I_1: 'I1',          I_2: 'II2',
  // Mục II — Thực hiện
  II_1: 'III1',        II_1_a: 'III1a',    II_1_b: 'III1b',
  II_2: 'III2',        II_3: 'III3',        II_4: 'III4',
  II_5: 'III5',        II_6: 'III6',
  II_6_a: 'III6a',    II_6_b: 'III6b',    II_6_c: 'III6c',
  II_7: 'III7',        II_8: 'III8',
  II_9: 'III9',
  II_9_a: 'III9a',    II_9_b: 'III9b',    II_9_c: 'III9c',
  II_9_d: 'III9d',    II_9_e: 'III9e',
  II_10: 'III10',      II_11: 'III11',      II_12: 'III12',  II_13: 'III13',
  // Mục III — Kết thúc
  III_1: 'III1',  III_2: 'IIII2', III_3: 'IIII3', III_4: 'IIII4',
  III_4_a: 'IIII4a', III_4_b: 'IIII4b', III_4_c: 'IIII4c',
} as const;

export interface Pl182Kpi {
  /** Số DA có quyết định ĐT trong kỳ (I.2) */
  daQuyetDinhDT: number;
  /** Số DA thực hiện ĐT trong kỳ (II.1) */
  daThucHienDT: number;
  /** Số DA đã đánh giá (II.5) */
  daDaDanhGia: number;
  /** Số DA chậm tiến độ (sum II.9.a-đ) */
  daChamTienDo: number;
  /** Số DA kết thúc đầu tư (III.1) */
  daKetThuc: number;
  /** Số DA đã quyết toán (III.3) */
  daDaQuyetToan: number;
}

export interface NhomDuAnSlice {
  label: string;
  value: number;
  color: string;
}

export interface PhaseSlice {
  label: string;
  value: number;
  color: string;
}

export interface ChamTienDoItem {
  label: string;
  value: number;
}

export interface ViPhamItem {
  label: string;
  value: number;
  color: string;
}
