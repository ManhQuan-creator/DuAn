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
import { NoDataHintComponent } from '../shared/no-data-hint.component';
import { shortenUnitLabel } from '../shared/unit-label.util';
import {
  Pl180Kpi,
  Pl180PhaseBreakdown,
  Pl180Row,
  Pl180UnitBreakdown,
} from './pl180.model';
import { Pl180DataService } from './pl180-data.service';

/**
 * Dashboard PL180 — TH ĐT theo giai đoạn giao KH toàn TCT.
 * Filter Năm + Đơn vị nhận từ page cha qua Input. Khi filter PC cụ thể →
 * KPI từ row đó, ẩn 2 chart "theo đơn vị".
 */
@Component({
  selector: 'app-pl180-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, NoDataHintComponent],
  templateUrl: './pl180-dashboard.component.html',
  styleUrls: ['./pl180-dashboard.component.scss'],
})
export class Pl180DashboardComponent implements OnChanges {
  private readonly dataSvc = inject(Pl180DataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  @Input({ required: true }) year!: number;

  @Input()
  set selectedUnit(v: string | null) {
    this._selectedUnit.set(v);
  }
  private readonly _selectedUnit = signal<string | null>(null);

  @Output() readonly unitsAvailable = new EventEmitter<string[]>();

  readonly rows = signal<Pl180Row[]>([]);
  readonly templateId = signal<number | null>(null);
  readonly entryExists = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  readonly selectedRow = computed<Pl180Row | undefined>(() => {
    const unit = this._selectedUnit();
    if (unit === null) return this.dataSvc.findTongCong(this.rows());
    return this.dataSvc.findUnitRow(this.rows(), unit);
  });

  readonly kpi = computed<Pl180Kpi>(() => this.dataSvc.buildKpi(this.selectedRow()));
  readonly phaseBreakdown = computed<Pl180PhaseBreakdown[]>(() =>
    this.dataSvc.buildPhaseBreakdown(this.selectedRow()));
  readonly unitBreakdown = computed<Pl180UnitBreakdown[]>(() =>
    this.dataSvc.buildUnitBreakdown(this.rows()));

  readonly showUnitCharts = computed<boolean>(() => this._selectedUnit() === null);
  readonly currentUnit = computed<string | null>(() => this._selectedUnit());

  readonly coCauTmdtChartOptions = computed<EChartsCoreOption>(() => this.buildCoCauChart('tmdt'));
  readonly coCauSoCTChartOptions = computed<EChartsCoreOption>(() => this.buildCoCauChart('soCT'));
  readonly unitPhaseChartOptions = computed<EChartsCoreOption>(() => this.buildUnitPhaseChart());
  readonly unitTyleHtChartOptions = computed<EChartsCoreOption>(() => this.buildUnitTyleHtChart());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['year']) this.loadData();
  }

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
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu PL180');
        this.entryExists.set(false);
        this.rows.set([]);
        this.unitsAvailable.emit([]);
        this.dialog.error('Không tải được dữ liệu Giai đoạn giao KH.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────

  private buildCoCauChart(metric: 'tmdt' | 'soCT'): EChartsCoreOption {
    const data = this.phaseBreakdown().map(p => ({
      name: p.label,
      value: metric === 'tmdt' ? p.tmdt : p.soCT,
      itemStyle: { color: p.color },
    }));
    const unit = metric === 'tmdt' ? 'tr.đ' : 'CT';
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) =>
          `${p.name}<br/><b>${(p.value ?? 0).toLocaleString('vi-VN')} ${unit}</b> (${p.percent}%)`,
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
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

  private buildUnitPhaseChart(): EChartsCoreOption {
    const top = this.unitBreakdown().slice(0, 15);
    const categories = top.map(u => shortenUnitLabel(u.unit));
    const truocValues = top.map(u => u.truocTmdt);
    const trongValues = top.map(u => u.trongTmdt);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const lines = [params[0].name];
          for (const p of params) {
            lines.push(`${p.marker} ${p.seriesName}: <b>${(p.value ?? 0).toLocaleString('vi-VN')}</b> tr.đ`);
          }
          return lines.join('<br/>');
        },
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 30, top: 20, bottom: 90 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: { color: '#475569', fontSize: 10, rotate: 35, interval: 0 },
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
          name: 'Giao trước 1/1',
          type: 'bar',
          data: truocValues,
          barWidth: 14,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Giao trong năm',
          type: 'bar',
          data: trongValues,
          barWidth: 14,
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }

  private buildUnitTyleHtChart(): EChartsCoreOption {
    const top = this.unitBreakdown()
      .filter(u => u.tongTyleHt != null)
      .slice()
      .sort((a, b) => (b.tongTyleHt ?? 0) - (a.tongTyleHt ?? 0))
      .slice(0, 15);
    const categories = top.map(u => shortenUnitLabel(u.unit));
    const values = top.map(u => u.tongTyleHt ?? 0);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) =>
          `${p[0].name}<br/><b>${(p[0].value ?? 0).toFixed(2)}%</b>`,
      },
      grid: { left: 120, right: 60, top: 20, bottom: 30 },
      xAxis: {
        type: 'value', max: 100,
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => `${v}%`,
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'category', data: categories, inverse: true,
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 16,
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
}
