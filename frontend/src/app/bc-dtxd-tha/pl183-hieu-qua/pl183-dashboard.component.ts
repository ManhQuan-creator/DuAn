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
import {
  CapDienApSlice,
  PcCountItem,
  Pl183Kpi,
  Pl183Row,
  ProjectTangThietItem,
  ProjectTmdtItem,
} from './pl183.model';
import { Pl183DataService } from './pl183-data.service';

/**
 * Dashboard PL183 — Hiệu quả ĐT sau kết thúc TCT.
 * Mỗi dự án = 1 custom row (NSD tự thêm). Filter Năm + Đơn vị (PC) nhận từ page cha.
 */
@Component({
  selector: 'app-pl183-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, NoDataHintComponent],
  templateUrl: './pl183-dashboard.component.html',
  styleUrls: ['./pl183-dashboard.component.scss'],
})
export class Pl183DashboardComponent implements OnChanges {
  private readonly dataSvc = inject(Pl183DataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  @Input({ required: true }) year!: number;

  @Input()
  set selectedUnit(v: string | null) {
    this._selectedUnit.set(v);
  }
  private readonly _selectedUnit = signal<string | null>(null);

  @Output() readonly unitsAvailable = new EventEmitter<string[]>();

  readonly rows = signal<Pl183Row[]>([]);
  readonly templateId = signal<number | null>(null);
  readonly entryExists = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  /** Rows đã filter theo PC + bỏ header/rỗng. */
  readonly filteredRows = computed<Pl183Row[]>(() =>
    this.dataSvc.filterByPc(this.rows(), this._selectedUnit()));

  readonly kpi = computed<Pl183Kpi>(() => this.dataSvc.buildKpi(this.filteredRows()));
  readonly capDienAp = computed<CapDienApSlice[]>(() =>
    this.dataSvc.buildCapDienApBreakdown(this.filteredRows()));
  readonly topByTmdt = computed<ProjectTmdtItem[]>(() =>
    this.dataSvc.buildTopByTmdt(this.filteredRows()));
  readonly topByTangThiet = computed<ProjectTangThietItem[]>(() =>
    this.dataSvc.buildTopByTangThiet(this.filteredRows()));
  readonly pcCount = computed<PcCountItem[]>(() =>
    this.dataSvc.buildPcCount(this.filteredRows()));

  readonly showPcChart = computed<boolean>(() => this._selectedUnit() === null);
  readonly currentUnit = computed<string | null>(() => this._selectedUnit());

  readonly capDienApChartOptions = computed<EChartsCoreOption>(() => this.buildCapDienApChart());
  readonly tmdtChartOptions = computed<EChartsCoreOption>(() => this.buildTmdtChart());
  readonly tangThietChartOptions = computed<EChartsCoreOption>(() => this.buildTangThietChart());
  readonly pcChartOptions = computed<EChartsCoreOption>(() => this.buildPcChart());

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

  /** Format tiền có dấu (+/-) cho KPI "giá trị tăng/thiệt hại". */
  fmtSigned(v: number): string {
    if (v === 0) return '0';
    const abs = Math.abs(v).toLocaleString('vi-VN', { maximumFractionDigits: 0 });
    return v >= 0 ? `+${abs}` : `−${abs}`;
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
        this.unitsAvailable.emit(this.dataSvc.buildPcNames(rows));
      }),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu PL183');
        this.entryExists.set(false);
        this.rows.set([]);
        this.unitsAvailable.emit([]);
        this.dialog.error('Không tải được dữ liệu Hiệu quả ĐT.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────

  private buildCapDienApChart(): EChartsCoreOption {
    const data = this.capDienAp().map((s, i) => ({
      name: s.label,
      value: s.count,
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

  private buildTmdtChart(): EChartsCoreOption {
    const items = this.topByTmdt();
    const categories = items.map(i => i.duAn);
    const tmdtValues = items.map(i => i.tmdt);
    const ttValues = items.map(i => i.chiPhiTt);
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
      grid: { left: 50, right: 30, top: 20, bottom: 130 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: {
          color: '#475569', fontSize: 10, rotate: 35, interval: 0,
          formatter: (v: string) => v.length > 22 ? v.slice(0, 20) + '…' : v,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [
        {
          name: 'TMĐT BCNCKT',
          type: 'bar',
          data: tmdtValues,
          barWidth: 14,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: 'Chi phí Thực tế',
          type: 'bar',
          data: ttValues,
          barWidth: 14,
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }

  private buildTangThietChart(): EChartsCoreOption {
    const items = this.topByTangThiet();
    const categories = items.map(i => i.duAn);
    const values = items.map(i => ({
      value: i.giaTri,
      itemStyle: { color: i.giaTri >= 0 ? '#10b981' : '#ef4444' },
    }));
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) => {
          const v = p[0].value ?? 0;
          const sign = v >= 0 ? '+' : '';
          return `${p[0].name}<br/><b>${sign}${v.toLocaleString('vi-VN')} tr.đ</b>`;
        },
      },
      grid: { left: 220, right: 60, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#475569', fontSize: 11,
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k`
            : v <= -1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
        },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'category', data: categories, inverse: true,
        axisLabel: {
          color: '#475569', fontSize: 10,
          formatter: (v: string) => v.length > 30 ? v.slice(0, 28) + '…' : v,
        },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 16,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', fontSize: 11,
          formatter: (p: any) => {
            const v = p.value ?? 0;
            const sign = v >= 0 ? '+' : '';
            return `${sign}${v.toLocaleString('vi-VN')}`;
          },
        },
      }],
    };
  }

  private buildPcChart(): EChartsCoreOption {
    const items = this.pcCount();
    const categories = items.map(i => i.pc);
    const values = items.map(i => i.count);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} dự án</b>`,
      },
      grid: { left: 110, right: 50, top: 20, bottom: 30 },
      xAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: {
        type: 'category', data: categories, inverse: true,
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 18,
        itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', fontSize: 11, color: '#1e293b',
        },
      }],
    };
  }
}
