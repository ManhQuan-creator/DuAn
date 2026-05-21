/**
 * Mô hình dữ liệu báo cáo SCL 2024 — 1 record = 1 đơn vị điện lực
 * (hoặc dòng "TỔNG CỘNG" aggregate). Mapping từ Excel cột A..BR theo
 * docs/prompt-dashboard-scl-2024.md mục 3.
 *
 * Hầu hết các field numeric có thể missing trong JSON → coi = 0.
 */
export interface SclReportRow {
  stt: number | null;        // null = dòng TỔNG CỘNG
  donVi: string;

  // Kế hoạch chi phí & hạch toán (triệu VND)
  khChiPhiTong?: number;
  khChiPhi110kv?: number;
  khChiPhiKhac?: number;
  hachToanChiPhi?: number;
  tyLeHachToan?: number;     // decimal 0..1

  // Khối lượng thực hiện theo tháng
  klT1?: number; klT2?: number; klT3?: number;
  klT4?: number; klT5?: number; klT6?: number;
  klLuyKe?: number;

  // Hạng mục giao đầu năm
  hmDauNamTong?: number;
  hmDauNam110kvPc?: number; hmDauNam110kvTct?: number;
  hmDauNamTht?: number; hmDauNamKhac?: number;

  // Hạng mục chuyển từ 2023 sang
  hmChuyenTong?: number;
  hmChuyen110kvPc?: number; hmChuyen110kvTct?: number;
  hmChuyenTht?: number; hmChuyenKhac?: number;

  // Hạng mục bổ sung
  hmBosungTong?: number;
  hmBosung110kvPc?: number; hmBosung110kvTct?: number;
  hmBosungTht?: number; hmBosungKhac?: number;

  // Hạng mục dừng không triển khai
  hmDungTong?: number;
  hmDung110kvPc?: number; hmDung110kvTct?: number;
  hmDungTht?: number; hmDungKhac?: number;

  // Tổng hạng mục triển khai
  hmTrienkhaiTong?: number;
  hmTrienkhai110kvPc?: number; hmTrienkhai110kvTct?: number;
  hmTrienkhaiTht?: number; hmTrienkhaiKhac?: number;

  // Hạng mục phê duyệt PAKT-ĐT
  hmDuyetTong?: number;
  hmDuyet110kvPc?: number; hmDuyet110kvTct?: number;
  hmDuyetTht?: number; hmDuyetKhac?: number;
  hmChuaDuyet?: number;

  // Tiến độ thực hiện đến 30/6/2024
  tdDauThau?: number;
  tdNpsc?: number;
  tdDaKyHd?: number;
  tdGiaoTuyenTong?: number; tdGiaoTuyen110kv?: number; tdGiaoTuyenTht?: number; tdGiaoTuyenKhac?: number;
  tdThiCongTong?: number;   tdThiCong110kv?: number;   tdThiCongTht?: number;   tdThiCongKhac?: number;
  tdXongTong?: number;      tdXong110kv?: number;      tdXongTht?: number;      tdXongKhac?: number;

  // Hoàn thành SAU 30/6 — đơn vị chậm
  htSauTong?: number; htSau110kv?: number; htSauTht?: number; htSauKhac?: number;
  // Kế hoạch đầu năm hoàn thành SAU 30/6 (= chậm so với plan gốc)
  khSauTong?: number; khSau110kv?: number; khSauTht?: number; khSauKhac?: number;

  duKienHoanThanh?: string | null;
  ghiChu?: string;
}

/** KPI card data — computed từ TOTAL row + derived metrics. */
export interface SclKpi {
  khChiPhiTong: number;        // 💰
  hachToan: number;            // 📊
  hachToanPct: number;         // % = hachToan / khChiPhiTong
  klLuyKe: number;             // 🏗 khối lượng thực hiện luỹ kế (trđ)
  klLuyKePct: number;          // % = klLuyKe / khChiPhiTong
  conLai: number;              // 📉 còn phải thực hiện = khChiPhiTong - klLuyKe
  conLaiPct: number;           // % = conLai / khChiPhiTong
  hmTrienkhai: number;         // 📦
  tdXong: number;              // ✅
  tdXongPct: number;           // % = tdXong / hmTrienkhai
  htSau: number;               // ⚠️
  hmChuaDuyet: number;         // 🚨
}

/** Cảnh báo đơn vị chậm — render ở section 5.5. */
export interface DelayAlert {
  donVi: string;
  htSauTong: number;
  htSau110kv: number;
  htSauTht: number;
  htSauKhac: number;
  duKienHoanThanh: string | null | undefined;
  ghiChu: string | undefined;
  /** Mức độ cảnh báo: high (>10), medium (5-10), low (<5). */
  severity: 'high' | 'medium' | 'low';
}
