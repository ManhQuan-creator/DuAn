/**
 * Types cho dashboard PL179 - TH ĐT theo nhóm chương trình TCT.
 *
 * Template: M20 (seed V13).
 * Rows: 1 TONG_CONG + 24 PC. Mỗi row 50 metric (10 nhóm × 5 cell).
 *
 * Nhóm prefix:
 *  - cn (Cả năm 2024)        — tổng KH năm
 *  - pb (Phân bổ đầu năm)    — KH giao trước 31/3
 *  - bs (Giao bổ sung)       — giao sau 31/3
 *  - dms                     — Định mức (sub-set of bs)
 *  - mdmc                    — Mở dòng - mở chuỗi (sub-set of bs)
 *  - xt (Xuất tuyến 1+2+3)   — tổng xuất tuyến (sub-set of bs)
 *  - xt1 (Xuất tuyến đợt 1)
 *  - xt2 (Xuất tuyến đợt 2)
 *  - khac (Nhóm khác)
 *  - cl (Còn lại)
 *
 * Quan hệ: cn = pb + bs; bs = dms + mdmc + xt + khac + cl; xt = xt1 + xt2.
 * Leaf-level (đảm bảo sum = cn): pb + dms + mdmc + xt1 + xt2 + khac + cl = 7 slice.
 */

export interface Pl179Row {
  row_code: string;
  stt?: string;
  donVi?: string;

  cnSoCT?: number | string;  cnTmdt?: number | string;  cnHt?: number | string;
  cnChuaHt?: number | string; cnTyleHt?: number | string;

  pbSoCT?: number | string;  pbTmdt?: number | string;  pbHt?: number | string;
  pbChuaHt?: number | string; pbTyleHt?: number | string;

  bsSoCT?: number | string;  bsTmdt?: number | string;  bsHt?: number | string;
  bsChuaHt?: number | string; bsTyleHt?: number | string;

  dmsSoCT?: number | string; dmsTmdt?: number | string; dmsHt?: number | string;
  dmsChuaHt?: number | string; dmsTyleHt?: number | string;

  mdmcSoCT?: number | string; mdmcTmdt?: number | string; mdmcHt?: number | string;
  mdmcChuaHt?: number | string; mdmcTyleHt?: number | string;

  xtSoCT?: number | string;  xtTmdt?: number | string;  xtHt?: number | string;
  xtChuaHt?: number | string; xtTyleHt?: number | string;

  xt1SoCT?: number | string; xt1Tmdt?: number | string; xt1Ht?: number | string;
  xt1ChuaHt?: number | string; xt1TyleHt?: number | string;

  xt2SoCT?: number | string; xt2Tmdt?: number | string; xt2Ht?: number | string;
  xt2ChuaHt?: number | string; xt2TyleHt?: number | string;

  khacSoCT?: number | string; khacTmdt?: number | string; khacHt?: number | string;
  khacChuaHt?: number | string; khacTyleHt?: number | string;

  clSoCT?: number | string;  clTmdt?: number | string;  clHt?: number | string;
  clChuaHt?: number | string; clTyleHt?: number | string;

  ghiChu?: string;
  _isTypeHeader?: boolean;
  [k: string]: unknown;
}

/** Row code cố định trong V13 seed. */
export const PL179_TONG_CONG = 'TONG';

/** 7 nhóm leaf-level (sum = Cả năm) — feed donut + bar. */
export const PL179_GROUPS: Array<{
  prefix: 'pb' | 'dms' | 'mdmc' | 'xt1' | 'xt2' | 'khac' | 'cl';
  label: string;
}> = [
  { prefix: 'pb',   label: 'Phân bổ đầu năm' },
  { prefix: 'dms',  label: 'DMS' },
  { prefix: 'mdmc', label: 'MDMC' },
  { prefix: 'xt1',  label: 'Xuất tuyến đợt 1' },
  { prefix: 'xt2',  label: 'Xuất tuyến đợt 2' },
  { prefix: 'khac', label: 'Nhóm khác' },
  { prefix: 'cl',   label: 'Còn lại' },
];

export interface Pl179Kpi {
  tongSoCT: number;
  tongTmdt: number;
  tongHt: number;
  tyleHt: number | null;
  soDonViBaoCao: number; // count PC rows có cnSoCT > 0; chỉ dùng khi không filter đơn vị
}

export interface Pl179GroupBreakdown {
  prefix: string;
  label: string;
  soCT: number;
  tmdt: number;
  ht: number;
  chuaHt: number;
  tyleHt: number | null;
}

export interface Pl179UnitBreakdown {
  unit: string;
  cnSoCT: number;
  cnTmdt: number;
  cnHt: number;
  cnChuaHt: number;
  cnTyleHt: number | null;
}
