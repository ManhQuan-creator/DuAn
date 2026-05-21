import { CommonModule } from '@angular/common';
import {
  Component, computed, inject, Input, OnChanges, signal, SimpleChanges,
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
import {
  NguonVonBreakdown,
  Pl181Kpi,
  Pl181Row,
  QuarterProgressPoint,
} from './pl181.model';
import { Pl181DataService } from './pl181-data.service';

/**
 * Dashboard PL181 - TH KH vốn TCT.
 *
 * Read-only. Filter: Năm (truyền từ page cha). Service auto-pick entry quý
 * mới nhất có data. Khi entry==null → render layout KPI=0 + no-data hint banner.
 *
 * 4 chart computed từ rows snapshot:
 *  1. Donut cơ cấu nguồn vốn (theo KH năm)
 *  2. Bar nhóm TH vs GN
 *  3. Horizontal bar %TH/KH
 *  4. Line tiến độ luỹ kế qua 4 quý (ẩn khi <2 quý có data)
 */
@Component({
  selector: 'app-pl181-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, NoDataHintComponent],
  templateUrl: './pl181-dashboard.component.html',
  styleUrls: ['./pl181-dashboard.component.scss'],
})
export class Pl181DashboardComponent implements OnChanges {
  private readonly dataSvc = inject(Pl181DataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  @Input({ required: true }) year!: number;

  readonly rows = signal<Pl181Row[]>([]);
  readonly quarterProgress = signal<QuarterProgressPoint[]>([]);
  readonly loadError = signal<string | null>(null);
  readonly entryExists = signal<boolean>(false);
  readonly templateId = signal<number | null>(null);

  readonly kpi = computed<Pl181Kpi>(() => this.dataSvc.buildKpi(this.rows()));
  readonly breakdown = computed<NguonVonBreakdown[]>(() =>
    this.dataSvc.buildNguonVonBreakdown(this.rows()));

  readonly nguonVonChartOptions = computed<EChartsCoreOption>(() =>
    this.buildNguonVonChart());
  readonly thVsGnChartOptions = computed<EChartsCoreOption>(() =>
    this.buildThVsGnChart());
  readonly tyleHtChartOptions = computed<EChartsCoreOption>(() =>
    this.buildTyleHtChart());
  readonly tienDoChartOptions = computed<EChartsCoreOption>(() =>
    this.buildTienDoChart());

  /** Hiển thị chart tiến độ khi ≥ 2 quý có data. */
  readonly showTienDoChart = computed<boolean>(() =>
    this.quarterProgress().filter(p => p.hasData).length >= 2);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['year']) this.loadData();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Format helpers
  // ──────────────────────────────────────────────────────────────────────────

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
      }),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu PL181');
        this.entryExists.set(false);
        this.rows.set([]);
        this.dialog.error('Không tải được dữ liệu Kế hoạch vốn.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();

    // Load 4 quý song song cho line tiến độ
    this.dataSvc.loadAllQuarters(this.year).pipe(
      tap(points => this.quarterProgress.set(points)),
      catchError(() => {
        this.quarterProgress.set([]);
        return of(null);
      }),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Chart builders
  // ──────────────────────────────────────────────────────────────────────────

  private buildNguonVonChart(): EChartsCoreOption {
    const data = this.breakdown()
      .filter(b => b.khVonNam > 0)
      .map((b, i) => ({
        name: b.label,
        value: b.khVonNam,
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

  private buildThVsGnChart(): EChartsCoreOption {
    const breakdown = this.breakdown();
    const categories = breakdown.map(b => b.label);
    const thValues = breakdown.map(b => b.thGtri);
    const gnValues = breakdown.map(b => b.gnGtri);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const lines = [params[0].name];
          for (const p of params) {
            lines.push(`${p.marker} ${p.seriesName}: <b>${(p.value ?? 0).toLocaleString('vi-VN')}</b> tr.đ`);
          }
          return lines.join('<br/>');
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 60, right: 40, top: 20, bottom: 60 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: '#475569', fontSize: 10, interval: 0,
          formatter: (v: string) => v.length > 16 ? v.slice(0, 14) + '…' : v,
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
      series: [
        {
          name: 'Thực hiện',
          type: 'bar',
          data: thValues,
          barWidth: 20,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Giải ngân',
          type: 'bar',
          data: gnValues,
          barWidth: 20,
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }

  private buildTyleHtChart(): EChartsCoreOption {
    const breakdown = this.breakdown().filter(b => b.thTle != null);
    const categories = breakdown.map(b => b.label);
    const values = breakdown.map(b => b.thTle ?? 0);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${(p[0].value ?? 0).toFixed(2)}%</b>`,
      },
      grid: { left: 180, right: 60, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        max: 100,
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

  private buildTienDoChart(): EChartsCoreOption {
    const points = this.quarterProgress();
    const categories = points.map(p => `Q${p.quarter}`);
    const thValues = points.map(p => p.thTle);
    const gnValues = points.map(p => p.gnTle);
    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const lines = [params[0].name];
          for (const p of params) {
            if (p.value == null) continue;
            lines.push(`${p.marker} ${p.seriesName}: <b>${p.value.toFixed(2)}%</b>`);
          }
          return lines.join('<br/>');
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 30, top: 20, bottom: 50 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          name: '% Thực hiện',
          type: 'line',
          data: thValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: '% Giải ngân',
          type: 'line',
          data: gnValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#10b981' },
          itemStyle: { color: '#10b981' },
        },
      ],
    };
  }
}
