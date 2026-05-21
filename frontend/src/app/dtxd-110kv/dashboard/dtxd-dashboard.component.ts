import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { AppDialogService } from '../../shared/dialog.service';
import { LoadingService } from '../../shared/loading.service';
import { SelectOption, SingleSelectComponent } from '../../shared/components/multi-select';
import { DtxdKpi, DtxdProjectRow } from '../model/dtxd.model';
import { DtxdDataService } from '../service/dtxd-data.service';
import { buildYearOptions } from '../utils/year-options.util';

/** Palette dùng cho các donut/pie để legend đồng nhất qua nhiều lượt re-render. */
const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#06b6d4', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16',
];

/**
 * Dashboard tổng hợp dự án ĐTXD 110kV — read-only, 2 tầng:
 *   1. KPI cards (8 chỉ số: số dự án, TMĐT, công suất, theo trạng thái + đúng/trễ KH)
 *   2. 4 biểu đồ ECharts (Tình trạng · Loại hình · Số dự án theo PC · TMĐT theo PC)
 *
 * Read-only. KHÔNG tự tạo entry — nếu năm chưa có entry, KPI=0 + charts empty.
 * NSD nhập dữ liệu qua menu khác (template gắn vào sidebar qua REPORT_FC_GROUP).
 */
@Component({
  selector: 'app-dtxd-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, SingleSelectComponent],
  templateUrl: './dtxd-dashboard.component.html',
  styleUrls: ['./dtxd-dashboard.component.scss'],
})
export class DtxdDashboardComponent implements OnInit {
  private readonly dataSvc = inject(DtxdDataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  readonly yearOptions: SelectOption<number>[] = buildYearOptions();
  selectedYear = new Date().getFullYear();

  readonly rows = signal<DtxdProjectRow[]>([]);
  readonly loadError = signal<string | null>(null);

  /** Filter đơn vị QLDA. `null` = tất cả đơn vị (mặc định). */
  readonly selectedUnit = signal<string | null>(null);

  /** Danh sách option đơn vị từ rows hiện tại + option "Tất cả". */
  readonly unitOptions = computed<SelectOption<string | null>[]>(() => {
    const units = new Set<string>();
    for (const r of this.rows()) {
      if (r?._isTypeHeader) continue;
      const u = String(r?.donViQlda ?? '').trim();
      if (u) units.add(u);
    }
    return [
      { value: null, label: 'Tất cả đơn vị' },
      ...Array.from(units).sort().map(u => ({ value: u, label: u })),
    ];
  });

  /** Rows đã filter theo `selectedUnit` (null = không filter). */
  readonly filteredRows = computed<DtxdProjectRow[]>(() => {
    const unit = this.selectedUnit();
    if (unit === null) return this.rows();
    return this.rows().filter(
      r => !r?._isTypeHeader && String(r?.donViQlda ?? '').trim() === unit,
    );
  });

  /** Chỉ hiển thị 2 chart "Phân bổ theo Đơn vị QLDA" khi không filter đơn vị. */
  readonly showUnitCharts = computed<boolean>(() => this.selectedUnit() === null);

  readonly kpi = computed<DtxdKpi>(() => this.dataSvc.buildKpi(this.filteredRows()));

  // ─── Chart options (computed) ─────────────────────────────────────────────
  readonly statusChartOptions = computed<EChartsCoreOption>(() => this.buildStatusOptions());
  readonly loaiHinhChartOptions = computed<EChartsCoreOption>(() => this.buildLoaiHinhOptions());
  readonly unitCountChartOptions = computed<EChartsCoreOption>(() => this.buildUnitCountOptions());
  readonly unitTmdtChartOptions = computed<EChartsCoreOption>(() => this.buildUnitTmdtOptions());

  ngOnInit(): void {
    this.loadData();
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.selectedUnit.set(null);
    this.loadData();
  }

  onUnitChange(unit: string | null): void {
    this.selectedUnit.set(unit);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Format helpers cho template
  // ──────────────────────────────────────────────────────────────────────────

  fmtCount(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN');
  }

  fmtMoney(v: number | null | undefined): string {
    if (v == null || v === 0) return v === 0 ? '0' : '—';
    return v.toLocaleString('vi-VN');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — Load data
  // ──────────────────────────────────────────────────────────────────────────

  private loadData(): void {
    this.loadError.set(null);
    this.loading.show();
    this.dataSvc.loadEntry(this.selectedYear).pipe(
      tap(({ rows }) => this.rows.set(rows)),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu dự án');
        this.rows.set([]);
        this.dialog.error('Không tải được dữ liệu báo cáo ĐTXD 110kV.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — Chart builders
  // ──────────────────────────────────────────────────────────────────────────

  private buildStatusOptions(): EChartsCoreOption {
    const data = this.dataSvc.buildStatusBreakdown(this.filteredRows()).map((b, i) => ({
      name: b.status,
      value: b.count,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/><b>${p.value} dự án</b> (${p.percent}%)`,
      },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{d}%', fontSize: 11, fontWeight: 600 },
        data,
      }],
    };
  }

  private buildLoaiHinhOptions(): EChartsCoreOption {
    const data = this.dataSvc.buildLoaiHinhBreakdown(this.filteredRows()).map((b, i) => ({
      name: b.loaiHinh,
      value: b.count,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/><b>${p.value} dự án</b> (${p.percent}%)`,
      },
      legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}: {c}', fontSize: 11 },
        data,
      }],
    };
  }

  private buildUnitCountOptions(): EChartsCoreOption {
    const top = this.dataSvc.buildUnitBreakdown(this.filteredRows()).slice(0, 10);
    const categories = top.map(b => b.unit);
    const counts = top.map(b => b.count);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} dự án</b>`,
      },
      grid: { left: 110, right: 40, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: counts,
        barWidth: 18,
        itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 11, color: '#1e293b' },
      }],
    };
  }

  private buildUnitTmdtOptions(): EChartsCoreOption {
    const top = this.dataSvc.buildUnitBreakdown(this.filteredRows())
      .filter(b => b.tongTmdt > 0)
      .sort((a, b) => b.tongTmdt - a.tongTmdt)
      .slice(0, 10);
    const categories = top.map(b => b.unit);
    const values = top.map(b => b.tongTmdt);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${(p[0].value ?? 0).toLocaleString('vi-VN')} triệu đồng</b>`,
      },
      grid: { left: 110, right: 80, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        inverse: true,
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 18,
        itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', fontSize: 11, color: '#1e293b',
          formatter: (p: any) => (p.value ?? 0).toLocaleString('vi-VN'),
        },
      }],
    };
  }
}
