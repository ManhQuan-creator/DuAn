/**
 * Types cho module KH năm EVN giao.
 *
 * 2 template hậu thuẫn:
 *  - KH_SXKD_NAM      — chỉ tiêu định lượng (PL1+PL2+PL3 tổng hợp)
 *  - KH_MUC_TIEU_NAM  — mục tiêu định tính (PL4)
 *
 * Mỗi năm Ban KH tạo 1 entry mới (orgCode='EVNNPC'), các template SCL khác
 * có thể LOOKUP qua row_code (vd LOOKUP('KH_SXKD_NAM','DIEN_TP','giaTri',0)).
 */

/** rowData JSON shape cho KH_SXKD_NAM (PL1+PL2+PL3) */
export interface KhSxkdRow {
  row_code: string;
  stt?: string;
  tenChiTieu?: string;
  donVi?: string;
  giaTri?: number | string;
  ghiChu?: string;
  _isTypeHeader?: boolean;
  _isCustomRow?: boolean;
  [k: string]: unknown;
}

/** rowData JSON shape cho KH_MUC_TIEU_NAM (PL4) */
export interface KhMucTieuRow {
  row_code: string;
  stt?: string;
  mucTieu?: string;
  chiTieuDinhLuong?: string;
  ghiChu?: string;
  _isTypeHeader?: boolean;
  [k: string]: unknown;
}

/** Aggregate KPI dùng cho dashboard cards */
export interface KhSxkdKpi {
  dienThuongPham: number | null;     // triệu kWh
  giaBanBinhQuan: number | null;     // đ/kWh
  ttdnTong: number | null;           // %
  chiPhiScl: number | null;          // triệu đồng
  maifi: number | null;              // lần
  saidi: number | null;              // phút
  saifi: number | null;              // lần
  daoTaoTongLuot: number | null;     // lượt (SUM dài hạn + ngắn hạn + e-learning)
  tongDauTu: number | null;          // triệu đồng
}

/** Cấu trúc TTĐN theo cấp điện áp — dùng cho bar chart */
export interface TtdnByCapDienAp {
  tong: number | null;
  caoAp: number | null;
  trungAp: number | null;
  haAp: number | null;
}

/** Suất sự cố — 3 chỉ số */
export interface SuatSuCo {
  duongDayKeoDai: number | null;
  duongDayThoangQua: number | null;
  tba: number | null;
}

/** Độ tin cậy cung cấp điện */
export interface DoTinCay {
  maifi: number | null;
  saidi: number | null;
  saifi: number | null;
}

/** Đào tạo — 3 loại × {lượt, chi phí} */
export interface DaoTao {
  daiHan: { luot: number | null; chiPhi: number | null };
  nganHan: { luot: number | null; chiPhi: number | null };
  eLearning: { luot: number | null; chiPhi: number | null };
}

/** Giá bán buôn EVN ↔ EVNNPC — 6 mức */
export interface GiaBanBuon {
  caoDiemT1_3: number | null;
  caoDiemT4_6: number | null;
  caoDiemT7_9: number | null;
  thapDiem: number | null;
  binhThuong: number | null;
  binhQuanKh: number | null;
}

/** Cơ cấu vốn ĐTXD — 4 nguồn + 3 hạng mục */
export interface VonDtxd {
  tongDauTu: number | null;
  luoi110kv: number | null;
  von: {
    nuocNgoai: number | null;
    vayTrongNuoc: number | null;
    tdtm: number | null;
    khcb: number | null;
  };
  hangMuc: {
    xayLap: number | null;
    thietBi: number | null;
    khac: number | null;
  };
}

/** Mục tiêu định tính grouped theo nhóm */
export interface MucTieuGroup {
  sectionCode: string;       // SEC_MT_I, SEC_MT_II, SEC_MT_III
  tieuDe: string;            // "I. NHIỆM VỤ SẢN XUẤT KINH DOANH"
  mucTieuItems: Array<{
    stt: string;
    mucTieu: string;
    chiTieuDinhLuong: string;
    ghiChu: string;
  }>;
}
