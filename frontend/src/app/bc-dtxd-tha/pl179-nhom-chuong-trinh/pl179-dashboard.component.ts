import { CommonModule } from '@angular/common';
import {
  Component, computed, EventEmitter, inject, Input, OnChanges, Output,
  signal, SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import { AppDialogService } from '../../shared/dialog.service';
import { LoadingService } from '../../shared/loading.service';
import { CHART_COLORS } from '../shared/chart-palette.const';
import { NoDataHintComponent } from '../shared/no-data-hint.component';
import { shortenUnitLabel } from '../shared/unit-label.util';
import {
  Pl179GroupBreakdown,
  Pl179Kpi,
  Pl179Row,
  Pl179UnitBreakdown,
} from './pl179.model';
import { Pl179DataService } from './pl179-data.service';

/**
 * Dashboard PL179 — Tình hình thực hiện ĐT theo nhóm chương trình toàn TCT.
 *
 * Read-only. Filter Năm + Đơn vị nhận từ page cha qua Input. Khi filter PC
 * cụ thể → KPI từ row đó, ẩn 2 chart "theo đơn vị". Emit `(unitsAvailable)`
 * lên page cha sau khi load data để page cha update dropdown options.
 */
@Component({
  selector: 'app-pl179-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, NoDataHintComponent],
  templateUrl: './pl179-dashboard.component.html',
  styleUrls: ['./pl179-dashboard.component.scss'],
})
export class Pl179DashboardComponent implements OnChanges {
  private readonly dataSvc = inject(Pl179DataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  @Input({ required: true }) year!: number;

  /** Filter đơn vị từ page cha. null = Tất cả. */
  @Input()
  set selectedUnit(v: string | null) {
    this._selectedUnit.set(v);
  }
  private readonly _selectedUnit = signal<string | null>(null);

  /** Emit list tên đơn vị có data sau khi load — page cha update dropdown options. */
  @Output() readonly unitsAvailable = new EventEmitter<string[]>();

  readonly rows = signal<Pl179Row[]>([]);
  readonly templateId = signal<number | null>(null);
  readonly entryExists = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  /** Row đã chọn để build KPI + chart cơ cấu: TONG_CONG nếu filter null, hoặc PC row cụ thể. */
  readonly selectedRow = computed<Pl179Row | undefined>(() => {
    const unit = this._selectedUnit();
    if (unit === null) return this.dataSvc.findTongCong(this.rows());
    return this.dataSvc.findUnitRow(this.rows(), unit);
  });

  readonly kpi = computed<Pl179Kpi>(() =>
    this.dataSvc.buildKpi(this.selectedRow(), this.rows()));

  readonly groupBreakdown = computed<Pl179GroupBreakdown[]>(() =>
    this.dataSvc.buildGroupBreakdown(this.selectedRow()));

  readonly unitBreakdown = computed<Pl179UnitBreakdown[]>(() =>
    this.dataSvc.buildUnitBreakdown(this.rows()));

  /** Ẩn 2 chart "theo đơn vị" khi filter PC cụ thể. */
  readonly showUnitCharts = computed<boolean>(() => this._selectedUnit() === null);

  /** Expose để template hiển thị tier-subtitle "— [Tên PC]". */
  readonly currentUnit = computed<string | null>(() => this._selectedUnit());

  readonly coCauChartOptions = computed<EChartsCoreOption>(() => this.buildCoCauChart());
  readonly tyleHtChartOptions = computed<EChartsCoreOption>(() => this.buildTyleHtChart());
  readonly unitTmdtChartOptions = computed<EChartsCoreOption>(() => this.buildUnitTmdtChart());
  readonly unitHtChartOptions = computed<EChartsCoreOption>(() => this.buildUnitHtChart());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['year']) this.loadData();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Format helpers
  // ──────────────────────────────────────────────────────────────────────────

  fmtCount(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN');
  }

  fmtMoney(v: number | null | undefined): string {
    if (v == null) return '—';
    if (v === 0) return '0';
    return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
  }

  fmtPercent(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + '%';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Load data
  // ──────────────────────────────────────────────────────────────────────────

  private loadData(): void {
    if (this.year == null) return;
    this.loadError.set(null);
    this.loading.show();

    this.dataSvc.loadEntry(this.year).pipe(
      tap(({ template, entry, rows }) => {
        this.templateId.set(template.id);
        this.entryExists.set(entry != null);
        this.rows.set(rows);
        this.unitsAvailable.emit(this.dataSvc.buildUnitNames(rows));
      }),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu PL179');
        this.entryExists.set(false);
        this.rows.set([]);
        this.unitsAvailable.emit([]);
        this.dialog.error('Không tải được dữ liệu Nhóm chương trình.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Chart builders
  // ──────────────────────────────────────────────────────────────────────────

  private buildCoCauChart(): EChartsCoreOption {
    const data = this.groupBreakdown().map((b, i) => ({
      name: b.label,
      value: b.tmdt,
      itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
    }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) =>
          `${p.name}<br/><b>${(p.value ?? 0).toLocaleString('vi-VN')} tr.đ</b> (${p.percent}%)`,
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

  private buildTyleHtChart(): EChartsCoreOption {
    const breakdown = this.groupBreakdown()
      .filter(b => b.tyleHt != null)
      .slice()
      .sort((a, b) => (b.tyleHt ?? 0) - (a.tyleHt ?? 0));
    const categories = breakdown.map(b => b.label);
    const values = breakdown.map(b => b.tyleHt ?? 0);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: any) =>
          `${p[0].name}<br/><b>${(p[0].value ?? 0).toFixed(2)}%</b>`,
      },
      grid: { left: 160, right: 60, top: 20, bottom: 30 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => `${v}%`,
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
        itemStyle: {
          color: (params: any) => {
            const v = params.value ?? 0;
            if (v >= 80) return '#10b981';
            if (v >= 50) return '#f59e0b';
            return '#ef4444';
          },
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true, position: 'right', fontSize: 11, color: '#1e293b',
          formatter: (p: any) => `${(p.value ?? 0).toFixed(2)}%`,
        },
      }],
    };
  }

  private buildUnitTmdtChart(): EChartsCoreOption {
    const top = this.unitBreakdown().slice(0, 15);
    const categories = top.map(u => shortenUnitLabel(u.unit));
    const values = top.map(u => u.cnTmdt);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) =>
          `${p[0].name}<br/><b>${(p[0].value ?? 0).toLocaleString('vi-VN')} tr.đ</b>`,
      },
      grid: { left: 50, right: 30, top: 20, bottom: 90 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: {
          color: '#475569', fontSize: 10, rotate: 35, interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => v >= 1_000_000
            ? `${(v / 1_000_000).toFixed(1)}M`
            : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 22,
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      }],
    };
  }

  private buildUnitHtChart(): EChartsCoreOption {
    const top = this.unitBreakdown()
      .slice()
      .sort((a, b) => b.cnSoCT - a.cnSoCT)
      .slice(0, 15);
    const categories = top.map(u => shortenUnitLabel(u.unit));
    const htValues = top.map(u => u.cnHt);
    const chuaHtValues = top.map(u => u.cnChuaHt);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const lines = [params[0].name];
          let total = 0;
          for (const p of params) {
            lines.push(`${p.marker} ${p.seriesName}: <b>${p.value ?? 0}</b>`);
            total += (p.value ?? 0);
          }
          lines.push(`<i>Tổng: ${total} CT</i>`);
          return lines.join('<br/>');
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 30, top: 20, bottom: 90 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: {
          color: '#475569', fontSize: 10, rotate: 35, interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          name: 'Hoàn thành',
          type: 'bar',
          stack: 'soCT',
          data: htValues,
          itemStyle: { color: '#10b981' },
        },
        {
          name: 'Chưa hoàn thành',
          type: 'bar',
          stack: 'soCT',
          data: chuaHtValues,
          itemStyle: { color: '#cbd5e1' },
        },
      ],
    };
  }
}
