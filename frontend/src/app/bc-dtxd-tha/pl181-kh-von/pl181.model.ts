/**
 * Types cho dashboard PL181 - TH KH vốn TCT.
 *
 * Template hậu thuẫn: M27 (seed V13).
 * Mỗi kỳ Quý Ban KH tạo 1 entry (orgCode='TCT', month=3/6/9/12).
 * 9 rows cố định, 9 cols (TT/Nội dung + 7 số liệu).
 */

/** Shape 1 row trong rowData JSON. */
export interface Pl181Row {
  row_code: string;
  stt?: string;
  noiDung?: string;
  /** Kế hoạch vốn năm (triệu đồng) */
  khVonNam?: number | string;
  /** Thực hiện - Giá trị (triệu đồng) */
  thGtri?: number | string;
  /** Thực hiện - % so với KH */
  thTle?: number | string;
  /** Giải ngân - Giá trị (triệu đồng) */
  gnGtri?: number | string;
  /** Giải ngân - % so với KH */
  gnTle?: number | string;
  /** Tiền phải thu hồi / giảm trừ */
  thuHoiGiamTru?: number | string;
  /** Thất thoát lãng phí phát hiện trong kỳ */
  thatThoatLangPhi?: number | string;
  _isTypeHeader?: boolean;
  _isCustomRow?: boolean;
  [k: string]: unknown;
}

/**
 * Row code — alphanumeric only, KHÔNG dùng `_` để tránh xung đột với pattern
 * tham chiếu cell trong formula engine (`{rowCode}_{field}` ở tier 1 của
 * dependency-extractor). KHÔNG dùng single letter A-I (trùng excelCol).
 *
 * V13 seed phiên bản gốc dùng `MUC_I` / `I_1_1` / ... — admin cần rename
 * thủ công qua Excel Builder cho khớp value mới ở đây trước khi tạo entry.
 */
export const PL181_ROW_CODES = {
  NPC_TONG: 'NPCTONG',
  MUC_I:    'MUCI',
  I_1_1:    'MUCI11',
  I_1_2:    'MUCI12',
  MUC_II:   'MUCII',
  II_1:     'MUCII1',
  II_1_1:   'MUCII11',
  II_1_2:   'MUCII12',
  II_2:     'MUCII2',
} as const;

/** KPI cards trên dashboard. */
export interface Pl181Kpi {
  /** Tổng KH vốn năm (NPC tổng) — triệu đồng */
  tongKhVonNam: number;
  /** Tổng giá trị thực hiện — triệu đồng */
  tongTh: number;
  /** % TH/KH (compute từ giá trị nếu cell % blank) */
  thTle: number | null;
  /** Tổng giá trị giải ngân — triệu đồng */
  tongGn: number;
  /** % GN/KH */
  gnTle: number | null;
}

/** 1 phân khúc nguồn vốn (slice donut + bar). */
export interface NguonVonBreakdown {
  rowCode: string;
  label: string;
  khVonNam: number;
  thGtri: number;
  gnGtri: number;
  /** % TH/KH cho horizontal bar */
  thTle: number | null;
}

/** 1 điểm trên line "Tiến độ luỹ kế qua các quý". */
export interface QuarterProgressPoint {
  quarter: number;        // 1, 2, 3, 4
  hasData: boolean;
  thTle: number | null;
  gnTle: number | null;
}
