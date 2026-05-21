import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, of, shareReplay, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SclReportRow } from '../models/scl-report.model';
import { computeDelayAlerts, computeKpis, partitionTotal } from '../utils/scl-kpi.calculator';
import { normalizeSclRow } from '../utils/scl-row-normalizer';

const DEFAULT_YEAR = 2025;

/**
 * Load + expose dữ liệu SCL Dashboard theo năm.
 *
 * URL data: `assets/scl-dashboard-{year}.json`. Hiện chỉ có data 2025; khi user
 * chọn năm khác, HTTP 404 → fallback `[]` (dashboard hiển thị trạng thái rỗng).
 *
 * Filter toàn cục theo đơn vị: `selectedUnit$` = null → KPI + Delay dùng TỔNG CỘNG;
 * chọn 1 đơn vị → KPI = row của đơn vị đó, Delay chỉ còn alert của đơn vị đó.
 */
@Injectable({ providedIn: 'root' })
export class SclReportService {
  private readonly http = inject(HttpClient);

  private readonly selectedYearSubject = new BehaviorSubject<number>(DEFAULT_YEAR);
  readonly selectedYear$ = this.selectedYearSubject.asObservable();

  private readonly selectedUnitSubject = new BehaviorSubject<string | null>(null);
  readonly selectedUnit$ = this.selectedUnitSubject.asObservable();

  // JSON xuất từ Excel dùng schema mới (khHienTai*, hachToanLuyKe, tdDangDauThau,
  // klT12 + klT1..T3, hmChuaDuyetTong...). Normalize về schema cũ để không phải
  // sửa chart/KPI đã được EVNNPC thông qua.
  private readonly rows$: Observable<SclReportRow[]> = this.selectedYear$.pipe(
    switchMap(year => this.http.get<unknown[]>(`assets/scl-dashboard-${year}.json`).pipe(
      map(raw => raw.map(r => normalizeSclRow(r as any))),
      catchError(() => of<SclReportRow[]>([])),
    )),
    shareReplay(1),
  );
  private readonly partition$ = this.rows$.pipe(map(rows => partitionTotal(rows)));

  readonly totalRow$ = this.partition$.pipe(map(p => p.total));
  readonly units$ = this.partition$.pipe(map(p => p.units));

  /** Row hiệu dụng cho KPI — dòng TỔNG CỘNG hoặc row của đơn vị được chọn. */
  readonly effectiveTotal$ = combineLatest([this.partition$, this.selectedUnit$]).pipe(
    map(([p, sel]) => {
      if (!sel) return p.total;
      return p.units.find(u => u.donVi === sel) ?? p.total;
    }),
  );

  readonly kpis$ = this.effectiveTotal$.pipe(map(computeKpis));

  readonly delayAlerts$ = combineLatest([this.units$, this.selectedUnit$]).pipe(
    map(([units, sel]) => {
      const alerts = computeDelayAlerts(units);
      return sel ? alerts.filter(a => a.donVi === sel) : alerts;
    }),
  );

  setSelectedUnit(donVi: string | null): void {
    this.selectedUnitSubject.next(donVi);
  }

  setSelectedYear(year: number): void {
    // Reset unit khi đổi năm — vì danh sách đơn vị có thể khác giữa các năm.
    this.selectedUnitSubject.next(null);
    this.selectedYearSubject.next(year);
  }
}
