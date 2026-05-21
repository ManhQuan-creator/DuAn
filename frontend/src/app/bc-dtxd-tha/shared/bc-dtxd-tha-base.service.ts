import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { GridTemplateService } from '../../excel-builder/service/grid-template.service';
import {
  GridDataEntryDetail,
  GridTemplateDetail,
} from '../../excel-builder/models/grid-template.model';

/** orgCode HQ — 1 entry/kỳ/template ở cấp Tổng công ty. Trùng convention dtxd-110kv. */
export const HQ_ORG_CODE = 'TCT';

/** Template code seed sẵn ở migration V13. */
export const TEMPLATE_CODES = {
  M20: 'M20',
  PL180: 'M21',
  PL181: 'M27',
  PL182: 'M19',
  PL183: 'M18',
} as const;

export type PlCode = keyof typeof TEMPLATE_CODES;

/** Generic loaded entry — sub-service cast `rows` về type cụ thể. */
export interface LoadedEntry<TRow = unknown> {
  template: GridTemplateDetail;
  entry: GridDataEntryDetail | null;
  rows: TRow[];
}

/**
 * Base service share cho 5 sub-dashboard M20-183.
 *
 * Wrap `GridTemplateService` — lookup template theo code, load entry theo
 * (templateId, year, month, orgCode='TCT'), parse rowData JSON sang generic
 * mảng row đã typed.
 *
 * KHÔNG tự tạo entry nếu chưa có — dashboard read-only. Entry chưa có → rows=[].
 */
@Injectable({ providedIn: 'root' })
export class BcDtxdThaBaseService {
  private readonly gridSvc = inject(GridTemplateService);

  /**
   * Load template + entry latest quý có data trong năm.
   *
   * Bỏ param `month` (từ đợt 2) — service tự sort entries trong năm theo
   * month desc + pick first. Áp dụng đều cho QUARTER (Q1→Q4) và HALF_YEAR (H1/H2).
   *
   * @param templateCode  Code template trong V13 (vd 'M27')
   * @param year          Năm báo cáo
   */
  loadEntry<TRow = unknown>(
    templateCode: string,
    year: number,
  ): Observable<LoadedEntry<TRow>> {
    return this.findTemplate(templateCode).pipe(
      switchMap(template =>
        this.gridSvc.getEntries(template.id, {
          year,
          orgCode: HQ_ORG_CODE,
        }).pipe(
          switchMap(entries => {
            if (entries.length === 0) {
              return of<LoadedEntry<TRow>>({ template, entry: null, rows: [] });
            }
            const latest = [...entries].sort(
              (a, b) => (b.month ?? 0) - (a.month ?? 0),
            )[0];
            return this.gridSvc.getEntry(template.id, latest.id).pipe(
              map(entry => this.buildLoadedEntry<TRow>(template, entry)),
            );
          }),
        ),
      ),
    );
  }

  /**
   * Load entry ở 1 month cụ thể (cho line chart "Tiến độ luỹ kế 4 quý" của PL181).
   * Giữ riêng để không phá `loadEntry(year)` ở dashboard chính.
   */
  loadEntryByMonth<TRow = unknown>(
    templateCode: string,
    year: number,
    month: number,
  ): Observable<LoadedEntry<TRow>> {
    return this.findTemplate(templateCode).pipe(
      switchMap(template =>
        this.gridSvc.getEntries(template.id, {
          year, month, orgCode: HQ_ORG_CODE,
        }).pipe(
          switchMap(entries => {
            if (entries.length === 0) {
              return of<LoadedEntry<TRow>>({ template, entry: null, rows: [] });
            }
            return this.gridSvc.getEntry(template.id, entries[0].id).pipe(
              map(entry => this.buildLoadedEntry<TRow>(template, entry)),
            );
          }),
        ),
      ),
    );
  }

  /** Tìm template theo code, throw nếu chưa chạy V13. */
  findTemplate(code: string): Observable<GridTemplateDetail> {
    return this.gridSvc.getTemplates().pipe(
      switchMap(list => {
        const meta = list.find(t => t.code === code);
        if (!meta) {
          return throwError(() => new Error(
            `Không tìm thấy template ${code}. Đã chạy migration V13 chưa?`,
          ));
        }
        return this.gridSvc.getTemplate(meta.id);
      }),
    );
  }

  private buildLoadedEntry<TRow>(
    template: GridTemplateDetail,
    entry: GridDataEntryDetail,
  ): LoadedEntry<TRow> {
    let rows: TRow[] = [];
    try {
      const parsed = entry.rowData ? JSON.parse(entry.rowData) : [];
      rows = Array.isArray(parsed) ? (parsed as TRow[]) : [];
    } catch {
      rows = [];
    }
    return { template, entry, rows };
  }

  /** Parse số chấp nhận comma decimal + whitespace + chuỗi rỗng + null. */
  parseNum(v: unknown): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number'
      ? v
      : Number(String(v).replace(/,/g, '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  /** Index mảng row theo `row_code` → row gốc. Bỏ qua row trùng code. */
  indexByRowCode<TRow extends { row_code?: string }>(rows: TRow[]): Map<string, TRow> {
    const map = new Map<string, TRow>();
    for (const r of rows) {
      if (r?.row_code && !map.has(r.row_code)) map.set(r.row_code, r);
    }
    return map;
  }
}
