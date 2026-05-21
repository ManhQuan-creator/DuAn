/**
 * Types cho dashboard PL183 - Hiệu quả ĐT sau kết thúc TCT.
 *
 * Template: M18 (seed V13).
 * KHÔNG có template rows — mỗi dự án = 1 custom row (NSD thêm qua /excel-render).
 * 24 cols comparing BCNCKT vs Thực tế.
 */

export interface Pl183Row {
  row_code: string;
  stt?: string;
  danhMucDuAn?: string;
  pc?: string;
  donViTH?: string;
  capDienAp?: string;
  qmDienBcnckt?: string; qmDienTt?: string;
  qmKhacBcnckt?: string; qmKhacTt?: string;
  tmdt?: number | string;
  chiPhiTt?: number | string;
  tienDoKh?: string; tienDoTt?: string;
  deltaAKh?: number | string; deltaATt?: number | string;
  saidiKh?: number | string;  saidiTt?: number | string;
  npvKh?: number | string;    npvTt?: number | string;
  firrKh?: number | string;   firrTt?: number | string;
  giaTriTangThiet?: number | string;
  ghiChu?: string;
  tuVanFs?: string;
  _isTypeHeader?: boolean;
  _isCustomRow?: boolean;
  [k: string]: unknown;
}

export interface Pl183Kpi {
  tongSoDuAn: number;
  tongTmdtBcnckt: number;
  tongChiPhiTt: number;
  soDaTangHieuQua: number;
  soDaThietHai: number;
  tongGiaTriTangThiet: number; // sum signed (- thiệt hại, + tăng)
}

export interface CapDienApSlice {
  label: string;
  count: number;
}

export interface ProjectTmdtItem {
  duAn: string;
  pc: string;
  tmdt: number;
  chiPhiTt: number;
}

export interface ProjectTangThietItem {
  duAn: string;
  pc: string;
  giaTri: number; // signed
}

export interface PcCountItem {
  pc: string;
  count: number;
}
