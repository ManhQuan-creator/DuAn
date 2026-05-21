/**
 * Types cho module Báo cáo tổng hợp dự án ĐTXD 110kV.
 *
 * Template hậu thuẫn: DTXD_110KV_TONG_HOP (seed V12).
 * Mỗi năm Ban QLĐT (HQ) tổng hợp 1 entry (orgCode='EVNNPC') chứa toàn bộ
 * dự án ĐTXD lưới 110kV. Mỗi dự án = 1 custom row trong rowData (RX prefix).
 */

/** rowData JSON shape cho 1 dự án */
export interface DtxdProjectRow {
  row_code: string;
  stt?: string | number;
  tenDuAn?: string;
  maDuAn?: string;
  donViQlda?: string;
  diaDiem?: string;
  chieuDai?: string;          // text vì format "2x3,5" (mạch x km)
  congSuat?: number | string;
  loaiHinh?: string;
  soQd?: string;
  ngayGiao?: string;          // ISO YYYY-MM-DD hoặc DD/MM/YYYY
  giaTmdt?: number | string;
  tinhTrang?: string;         // "Đã quyết toán" | "Đang thi công" | "Đã lựa chọn nhà thầu TVTK" | ...
  khoiCongKh?: string;
  hoanThanhKh?: string;
  khoiCongTt?: string;
  hoanThanhTt?: string;
  _isTypeHeader?: boolean;
  _isCustomRow?: boolean;
  [k: string]: unknown;
}

/** Aggregate KPI hiển thị ở cards dashboard */
export interface DtxdKpi {
  tongSoDuAn: number;
  tongTmdt: number;             // triệu đồng (sum)
  tongCongSuat: number;         // MVA (sum)
  soDaQuyetToan: number;
  soDangThiCong: number;
  soChuaKhoiCong: number;       // chưa có khoiCongTt
  soKhoiCongDungKh: number;     // khoiCongTt <= khoiCongKh
  soKhoiCongTreKh: number;      // khoiCongTt > khoiCongKh
}

/** Nhóm trạng thái dự án — feed donut chart "Tình trạng" */
export interface DtxdStatusBreakdown {
  status: string;
  count: number;
  tongTmdt: number;
}

/** Nhóm theo Đơn vị QLDA — feed bar chart "Số dự án + TMĐT theo PC" */
export interface DtxdUnitBreakdown {
  unit: string;
  count: number;
  tongTmdt: number;
}

/** Nhóm theo Loại hình công trình — feed donut chart "Loại hình" */
export interface DtxdLoaiHinhBreakdown {
  loaiHinh: string;
  count: number;
}
