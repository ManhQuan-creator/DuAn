import { SclReportRow } from '../models/scl-report.model';

/**
 * Shape raw đọc trực tiếp từ JSON Excel export 2025 (schema mới).
 * Chỉ list các field dashboard đang consume — các field khác
 * (khTamGiao*, khChinhThuc*, hm2025*, hmNet, hmDuyetChuaTrienKhai...) giữ ở raw
 * nhưng không map sang model vì UI hiện tại không dùng.
 */
interface RawSclRow {
  stt: number | null;
  donVi: string;

  khHienTaiTong?: number | null;
  khHienTai110kv?: number | null;
  khHienTaiKhac?: number | null;

  hachToanLuyKe?: number | null;

  klT12?: number | null;
  klT1?: number | null;
  klT2?: number | null;
  klT3?: number | null;
  klLuyKe?: number | null;

  hmDauNamTong?: number | null;
  hmDauNam110kvPc?: number | null;
  hmDauNam110kvTct?: number | null;
  hmDauNamTht?: number | null;
  hmDauNamKhac?: number | null;

  hmChuyenTong?: number | null;
  hmChuyen110kvPc?: number | null;
  hmChuyen110kvTct?: number | null;
  hmChuyenTht?: number | null;
  hmChuyenKhac?: number | null;

  hmBosungTong?: number | null;
  hmBosung110kvPc?: number | null;
  hmBosung110kvTct?: number | null;
  hmBosungTht?: number | null;
  hmBosungKhac?: number | null;

  hmTrienkhaiTong?: number | null;
  hmTrienkhai110kvPc?: number | null;
  hmTrienkhai110kvTct?: number | null;
  hmTrienkhaiTht?: number | null;
  hmTrienkhaiKhac?: number | null;

  hmDuyetTong?: number | null;
  hmDuyet110kvPc?: number | null;
  hmDuyet110kvTct?: number | null;
  hmDuyetTht?: number | null;
  hmDuyetKhac?: number | null;
  hmChuaDuyetTong?: number | null;

  tdDangDauThau?: number | null;
  tdDaKyHd?: number | null;
  tdGiaoTuyenTong?: number | null;
  tdGiaoTuyen110kv?: number | null;
  tdGiaoTuyenTht?: number | null;
  tdGiaoTuyenKhac?: number | null;
  tdThiCongTong?: number | null;
  tdThiCong110kv?: number | null;
  tdThiCongTht?: number | null;
  tdThiCongKhac?: number | null;
  tdXongTong?: number | null;
  tdXong110kv?: number | null;
  tdXongTht?: number | null;
  tdXongKhac?: number | null;

  htSauTong?: number | null;
  htSau110kv?: number | null;
  htSauTht?: number | null;
  htSauKhac?: number | null;

  ghiChu?: string | null;
}

const num = (v: number | null | undefined): number | undefined =>
  v == null || !Number.isFinite(v) ? undefined : v;

/**
 * Map row schema Excel export 2025 → `SclReportRow` (schema cũ UI đang dùng).
 *
 * Quy ước mapping:
 *  - Kế hoạch chi phí = **kế hoạch hiện tại** (`khHienTai*`) — phiên bản mới
 *    nhất được TCT giao. Các phiên bản trước (`khTamGiao`, `khChinhThuc`) chưa
 *    hiển thị ở UI hiện tại.
 *  - `hachToanChiPhi` ← `hachToanLuyKe` (luỹ kế đã hạch toán).
 *  - `tyLeHachToan` compute tại đây (data mới không trả sẵn).
 *  - `hmChuaDuyet` ← `hmChuaDuyetTong` (schema mới tách 110kvPc/110kvTct/Tht/Khac
 *    nhưng UI chỉ dùng tổng).
 *  - `tdDauThau` ← `tdDangDauThau` (đang đấu thầu).
 *  - Tháng KL: chart hiện có 6 slot T1..T6. Data mới chỉ có T1..T3 (cutoff Q1)
 *    + `klT12` (chuyển từ 2024). Bỏ qua `klT12` (đã tính trong `klLuyKe`);
 *    T4..T6 để undefined → chart vẽ 0 (chưa đến tháng đó, đúng sự thật).
 *  - `duKienHoanThanh` không còn trong data → undefined (chip ẩn).
 */
export function normalizeSclRow(raw: RawSclRow): SclReportRow {
  const khTong = num(raw.khHienTaiTong) ?? 0;
  const hachToan = num(raw.hachToanLuyKe) ?? 0;

  return {
    stt: raw.stt ?? null,
    donVi: raw.donVi,

    khChiPhiTong: num(raw.khHienTaiTong),
    khChiPhi110kv: num(raw.khHienTai110kv),
    khChiPhiKhac: num(raw.khHienTaiKhac),
    hachToanChiPhi: num(raw.hachToanLuyKe),
    tyLeHachToan: khTong > 0 ? hachToan / khTong : 0,

    klT1: num(raw.klT1),
    klT2: num(raw.klT2),
    klT3: num(raw.klT3),
    klLuyKe: num(raw.klLuyKe),

    hmDauNamTong: num(raw.hmDauNamTong),
    hmDauNam110kvPc: num(raw.hmDauNam110kvPc),
    hmDauNam110kvTct: num(raw.hmDauNam110kvTct),
    hmDauNamTht: num(raw.hmDauNamTht),
    hmDauNamKhac: num(raw.hmDauNamKhac),

    hmChuyenTong: num(raw.hmChuyenTong),
    hmChuyen110kvPc: num(raw.hmChuyen110kvPc),
    hmChuyen110kvTct: num(raw.hmChuyen110kvTct),
    hmChuyenTht: num(raw.hmChuyenTht),
    hmChuyenKhac: num(raw.hmChuyenKhac),

    hmBosungTong: num(raw.hmBosungTong),
    hmBosung110kvPc: num(raw.hmBosung110kvPc),
    hmBosung110kvTct: num(raw.hmBosung110kvTct),
    hmBosungTht: num(raw.hmBosungTht),
    hmBosungKhac: num(raw.hmBosungKhac),

    hmTrienkhaiTong: num(raw.hmTrienkhaiTong),
    hmTrienkhai110kvPc: num(raw.hmTrienkhai110kvPc),
    hmTrienkhai110kvTct: num(raw.hmTrienkhai110kvTct),
    hmTrienkhaiTht: num(raw.hmTrienkhaiTht),
    hmTrienkhaiKhac: num(raw.hmTrienkhaiKhac),

    hmDuyetTong: num(raw.hmDuyetTong),
    hmDuyet110kvPc: num(raw.hmDuyet110kvPc),
    hmDuyet110kvTct: num(raw.hmDuyet110kvTct),
    hmDuyetTht: num(raw.hmDuyetTht),
    hmDuyetKhac: num(raw.hmDuyetKhac),
    hmChuaDuyet: num(raw.hmChuaDuyetTong),

    tdDauThau: num(raw.tdDangDauThau),
    tdDaKyHd: num(raw.tdDaKyHd),
    tdGiaoTuyenTong: num(raw.tdGiaoTuyenTong),
    tdGiaoTuyen110kv: num(raw.tdGiaoTuyen110kv),
    tdGiaoTuyenTht: num(raw.tdGiaoTuyenTht),
    tdGiaoTuyenKhac: num(raw.tdGiaoTuyenKhac),
    tdThiCongTong: num(raw.tdThiCongTong),
    tdThiCong110kv: num(raw.tdThiCong110kv),
    tdThiCongTht: num(raw.tdThiCongTht),
    tdThiCongKhac: num(raw.tdThiCongKhac),
    tdXongTong: num(raw.tdXongTong),
    tdXong110kv: num(raw.tdXong110kv),
    tdXongTht: num(raw.tdXongTht),
    tdXongKhac: num(raw.tdXongKhac),

    htSauTong: num(raw.htSauTong),
    htSau110kv: num(raw.htSau110kv),
    htSauTht: num(raw.htSauTht),
    htSauKhac: num(raw.htSauKhac),

    ghiChu: raw.ghiChu ?? undefined,
  };
}
