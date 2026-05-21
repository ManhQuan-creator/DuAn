import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { GridTemplateService } from '../../excel-builder/service/grid-template.service';
import { GridDataEntryDetail, GridTemplateDetail } from '../../excel-builder/models/grid-template.model';
import { DtxdProjectRow, DtxdKpi, DtxdStatusBreakdown, DtxdUnitBreakdown, DtxdLoaiHinhBreakdown } from '../model/dtxd.model';

/** orgCode HQ — 1 entry duy nhất / năm tổng hợp toàn EVNNPC.
 *  Convention hệ thống: 'TCT' (Tổng công ty) — TƯƠNG ỨNG EVNNPC nhưng dùng mã 'TCT'. */
export const HQ_ORG_CODE = 'TCT';

/** Code template seed sẵn ở migration V12 */
export const TEMPLATE_CODE_DTXD = 'DTXD_110KV_TONG_HOP';

/** Pattern nhận biết các giá trị tình trạng dự án (case-insensitive). */
const STATUS_PATTERNS = {
  daQuyetToan: /quy[ếeê]t\s*to[áa]n/i,
  dangThiCong: /(đang|đg)\s*thi\s*c[ôo]ng/i,
} as const;

interface LoadedEntry {
  template: GridTemplateDetail;
  entry: GridDataEntryDetail | null;
  rows: DtxdProjectRow[];
}

/**
 * Service domain cho module ĐTXD 110kV.
 *
 * Wrap `GridTemplateService` — lookup template theo code, load entry
 * theo (templateId, year, orgCode='TCT'), parse rowData JSON sang typed rows.
 *
 * KHÔNG tự tạo entry nếu chưa có — dashboard là read-only view. Khi không có
 * entry, trả về rows rỗng → KPI hiển thị 0, charts không có data.
 *
 * KPI builder bỏ qua header rows + tự parse số/date với format Việt Nam.
 */
@Injectable({ providedIn: 'root' })
export class DtxdDataService {
  private readonly gridSvc = inject(GridTemplateService);

  /** Load template + entry hiện hành cho năm. Trả entry=null + rows=[] nếu chưa có. */
  loadEntry(year: number): Observable<LoadedEntry> {
    return this.findTemplate(TEMPLATE_CODE_DTXD).pipe(
      switchMap(template =>
        this.gridSvc.getEntries(template.id, { year, orgCode: HQ_ORG_CODE }).pipe(
          switchMap(entries => {
            if (entries.length === 0) {
              return of<LoadedEntry>({ template, entry: null, rows: [] });
            }
            return this.gridSvc.getEntry(template.id, entries[0].id).pipe(
              map(entry => this.buildLoadedEntry(template, entry)),
            );
          }),
        ),
      ),
    );
  }

  private findTemplate(code: string): Observable<GridTemplateDetail> {
    return this.gridSvc.getTemplates().pipe(
      switchMap(list => {
        const meta = list.find(t => t.code === code);
        if (!meta) {
          return throwError(() => new Error(
            `Không tìm thấy template ${code}. Đã chạy migration V12 chưa?`,
          ));
        }
        return this.gridSvc.getTemplate(meta.id);
      }),
    );
  }

  private buildLoadedEntry(template: GridTemplateDetail, entry: GridDataEntryDetail): LoadedEntry {
    let rows: DtxdProjectRow[] = [];
    try {
      const parsed = entry.rowData ? JSON.parse(entry.rowData) : [];
      rows = Array.isArray(parsed) ? parsed : [];
    } catch {
      rows = [];
    }
    return { template, entry, rows };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Aggregation helpers — pure projection từ rows snapshot.
  // ──────────────────────────────────────────────────────────────────────────

  /** Lọc data rows (skip header), trim falsy entries. */
  private dataRows(rows: DtxdProjectRow[]): DtxdProjectRow[] {
    return rows.filter(r => r && !r._isTypeHeader);
  }

  buildKpi(rows: DtxdProjectRow[]): DtxdKpi {
    const data = this.dataRows(rows);
    let tongTmdt = 0;
    let tongCongSuat = 0;
    let soDaQuyetToan = 0;
    let soDangThiCong = 0;
    let soChuaKhoiCong = 0;
    let soKhoiCongDungKh = 0;
    let soKhoiCongTreKh = 0;

    for (const r of data) {
      tongTmdt += this.parseNum(r.giaTmdt) ?? 0;
      tongCongSuat += this.parseNum(r.congSuat) ?? 0;

      const tt = String(r.tinhTrang ?? '');
      if (STATUS_PATTERNS.daQuyetToan.test(tt)) soDaQuyetToan++;
      else if (STATUS_PATTERNS.dangThiCong.test(tt)) soDangThiCong++;

      const kcTt = this.parseDate(r.khoiCongTt);
      const kcKh = this.parseDate(r.khoiCongKh);
      if (!kcTt) {
        soChuaKhoiCong++;
      } else if (kcKh) {
        if (kcTt.getTime() <= kcKh.getTime()) soKhoiCongDungKh++;
        else soKhoiCongTreKh++;
      }
    }

    return {
      tongSoDuAn: data.length,
      tongTmdt,
      tongCongSuat,
      soDaQuyetToan,
      soDangThiCong,
      soChuaKhoiCong,
      soKhoiCongDungKh,
      soKhoiCongTreKh,
    };
  }

  /** Đếm dự án + tổng TMĐT theo tình trạng. Sort desc theo count. */
  buildStatusBreakdown(rows: DtxdProjectRow[]): DtxdStatusBreakdown[] {
    const map = new Map<string, DtxdStatusBreakdown>();
    for (const r of this.dataRows(rows)) {
      const status = String(r.tinhTrang ?? '').trim() || '(Chưa xác định)';
      const tmdt = this.parseNum(r.giaTmdt) ?? 0;
      const cur = map.get(status);
      if (cur) {
        cur.count++;
        cur.tongTmdt += tmdt;
      } else {
        map.set(status, { status, count: 1, tongTmdt: tmdt });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  /** Đếm dự án + tổng TMĐT theo Đơn vị QLDA. Sort desc theo count. */
  buildUnitBreakdown(rows: DtxdProjectRow[]): DtxdUnitBreakdown[] {
    const map = new Map<string, DtxdUnitBreakdown>();
    for (const r of this.dataRows(rows)) {
      const unit = String(r.donViQlda ?? '').trim() || '(Chưa rõ)';
      const tmdt = this.parseNum(r.giaTmdt) ?? 0;
      const cur = map.get(unit);
      if (cur) {
        cur.count++;
        cur.tongTmdt += tmdt;
      } else {
        map.set(unit, { unit, count: 1, tongTmdt: tmdt });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  /** Đếm dự án theo Loại hình. Sort desc theo count. */
  buildLoaiHinhBreakdown(rows: DtxdProjectRow[]): DtxdLoaiHinhBreakdown[] {
    const map = new Map<string, DtxdLoaiHinhBreakdown>();
    for (const r of this.dataRows(rows)) {
      const loaiHinh = String(r.loaiHinh ?? '').trim() || '(Chưa rõ)';
      const cur = map.get(loaiHinh);
      if (cur) cur.count++;
      else map.set(loaiHinh, { loaiHinh, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  /** Parse số chấp nhận comma decimal + whitespace + chuỗi rỗng. */
  parseNum(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Parse date string. Hỗ trợ:
   *  - ISO: "YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm:ss"
   *  - VN: "DD/MM/YYYY"
   *  - Malformed: "0/M/YYYY" → null (ngày 0 không hợp lệ)
   */
  parseDate(v: unknown): Date | null {
    if (v == null || v === '') return null;
    const s = String(v).trim();

    // ISO YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const [_, y, m, d] = isoMatch;
      return this.makeDate(+y, +m, +d);
    }

    // DD/MM/YYYY (Vietnamese)
    const vnMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vnMatch) {
      const [_, d, m, y] = vnMatch;
      return this.makeDate(+y, +m, +d);
    }

    return null;
  }

  private makeDate(year: number, month: number, day: number): Date | null {
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
    const dt = new Date(year, month - 1, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
}
