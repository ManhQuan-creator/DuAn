import { DelayAlert, SclKpi, SclReportRow } from '../models/scl-report.model';

/**
 * Helper: numeric field hay undefined → 0. Hầu hết field trong JSON có thể
 * missing (nghĩa là 0), caller cần coi null/undefined = 0 an toàn.
 */
const n = (v: number | null | undefined): number => (v == null || !Number.isFinite(v) ? 0 : v);

/** Tách dòng TỔNG CỘNG (stt=null) khỏi danh sách đơn vị. */
export function partitionTotal(rows: SclReportRow[]): {
  total: SclReportRow | null;
  units: SclReportRow[];
} {
  const total = rows.find(r => r.stt == null && r.donVi === 'TỔNG CỘNG') ?? null;
  const units = rows.filter(r => r.stt != null);
  return { total, units };
}

/** Build 6 KPI từ dòng TỔNG CỘNG — fallback về 0 nếu field missing. */
export function computeKpis(total: SclReportRow | null): SclKpi {
  if (!total) {
    return {
      khChiPhiTong: 0, hachToan: 0, hachToanPct: 0,
      klLuyKe: 0, klLuyKePct: 0,
      conLai: 0, conLaiPct: 0,
      hmTrienkhai: 0, tdXong: 0, tdXongPct: 0,
      htSau: 0, hmChuaDuyet: 0,
    };
  }

  const khChiPhiTong = n(total.khChiPhiTong);
  const hachToan = n(total.hachToanChiPhi);
  const klLuyKe = n(total.klLuyKe);
  const conLai = Math.max(0, khChiPhiTong - klLuyKe);
  const hmTrienkhai = n(total.hmTrienkhaiTong);
  const tdXong = n(total.tdXongTong);

  return {
    khChiPhiTong,
    hachToan,
    hachToanPct: khChiPhiTong > 0 ? hachToan / khChiPhiTong : 0,
    klLuyKe,
    klLuyKePct: khChiPhiTong > 0 ? klLuyKe / khChiPhiTong : 0,
    conLai,
    conLaiPct: khChiPhiTong > 0 ? conLai / khChiPhiTong : 0,
    hmTrienkhai,
    tdXong,
    tdXongPct: hmTrienkhai > 0 ? tdXong / hmTrienkhai : 0,
    htSau: n(total.htSauTong),
    hmChuaDuyet: n(total.hmChuaDuyet),
  };
}

/**
 * Sinh danh sách cảnh báo đơn vị chậm — sort desc theo số hạng mục chậm.
 * Bỏ đơn vị có `htSauTong = 0`.
 */
export function computeDelayAlerts(units: SclReportRow[]): DelayAlert[] {
  return units
    .filter(u => n(u.htSauTong) > 0)
    .map(u => {
      const tong = n(u.htSauTong);
      const severity: DelayAlert['severity'] =
        tong > 10 ? 'high' : tong >= 5 ? 'medium' : 'low';
      return {
        donVi: u.donVi,
        htSauTong: tong,
        htSau110kv: n(u.htSau110kv),
        htSauTht: n(u.htSauTht),
        htSauKhac: n(u.htSauKhac),
        duKienHoanThanh: u.duKienHoanThanh,
        ghiChu: u.ghiChu,
        severity,
      };
    })
    .sort((a, b) => b.htSauTong - a.htSauTong);
}
