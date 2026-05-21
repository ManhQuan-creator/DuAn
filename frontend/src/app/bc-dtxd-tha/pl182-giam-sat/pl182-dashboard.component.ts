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
import { NoDataHintComponent } from '../shared/no-data-hint.component';
import {
  ChamTienDoItem,
  NhomDuAnSlice,
  PhaseSlice,
  Pl182Kpi,
  Pl182Row,
  ViPhamItem,
} from './pl182.model';
import { Pl182DataService } from './pl182-data.service';

/**
 * Dashboard PL182 — TH Giám sát đánh giá ĐT TCT (Biểu 3.1 NĐ 29/2021).
 * periodType = HALF_YEAR. KHÔNG có filter đơn vị (data Biểu 3.1 cấp TCT).
 */
@Component({
  selector: 'app-pl182-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, NoDataHintComponent],
  templateUrl: './pl182-dashboard.component.html',
  styleUrls: ['./pl182-dashboard.component.scss'],
})
export class Pl182DashboardComponent implements OnChanges {
  private readonly dataSvc = inject(Pl182DataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  @Input({ required: true }) year!: number;

  readonly rows = signal<Pl182Row[]>([]);
  readonly templateId = signal<number | null>(null);
  readonly entryExists = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);

  readonly kpi = computed<Pl182Kpi>(() => this.dataSvc.buildKpi(this.rows()));
  readonly nhomDuAn = computed<NhomDuAnSlice[]>(() => this.dataSvc.buildNhomDuAn(this.rows()));
  readonly phases = computed<PhaseSlice[]>(() => this.dataSvc.buildPhases(this.rows()));
  readonly chamTienDo = computed<ChamTienDoItem[]>(() => this.dataSvc.buildChamTienDo(this.rows()));
  readonly viPham = computed<ViPhamItem[]>(() => this.dataSvc.buildViPham(this.rows()));

  readonly nhomChartOptions = computed<EChartsCoreOption>(() => this.buildNhomChart());
  readonly phasesChartOptions = computed<EChartsCoreOption>(() => this.buildPhasesChart());
  readonly chamChartOptions = computed<EChartsCoreOption>(() => this.buildChamChart());
  readonly viPhamChartOptions = computed<EChartsCoreOption>(() => this.buildViPhamChart());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['year']) this.loadData();
  }

  fmtCount(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN');
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
      }),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu PL182');
        this.entryExists.set(false);
        this.rows.set([]);
        this.dialog.error('Không tải được dữ liệu Giám sát đầu tư.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────

  private buildNhomChart(): EChartsCoreOption {
    const data = this.nhomDuAn().map(s => ({
      name: s.label, value: s.value, itemStyle: { color: s.color },
    }));
    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/><b>${p.value} DA</b> (${p.percent}%)`,
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

  private buildPhasesChart(): EChartsCoreOption {
    const phases = this.phases();
    const categories = phases.map(p => p.label);
    const values = phases.map(p => ({ value: p.value, itemStyle: { color: p.color } }));
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} DA</b>`,
      },
      grid: { left: 50, right: 30, top: 30, bottom: 40 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: { color: '#475569', fontSize: 12, fontWeight: 600 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 80,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: {
          show: true, position: 'top', fontSize: 14, fontWeight: 700, color: '#0f172a',
          formatter: (p: any) => `${p.value} DA`,
        },
      }],
    };
  }

  private buildChamChart(): EChartsCoreOption {
    const items = this.chamTienDo();
    const categories = items.map(i => i.label);
    const values = items.map(i => i.value);
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} DA</b>`,
      },
      grid: { left: 180, right: 50, top: 20, bottom: 30 },
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
        itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', fontSize: 11, color: '#1e293b',
          formatter: (p: any) => `${p.value}`,
        },
      }],
    };
  }

  private buildViPhamChart(): EChartsCoreOption {
    const items = this.viPham();
    const categories = items.map(i => i.label);
    const values = items.map(i => ({ value: i.value, itemStyle: { color: i.color } }));
    return {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value} DA</b>`,
      },
      grid: { left: 50, right: 30, top: 30, bottom: 80 },
      xAxis: {
        type: 'category', data: categories,
        axisLabel: {
          color: '#475569', fontSize: 10, rotate: 18, interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11 },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [{
        type: 'bar',
        data: values,
        barWidth: 60,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: {
          show: true, position: 'top', fontSize: 12, fontWeight: 600, color: '#0f172a',
          formatter: (p: any) => `${p.value}`,
        },
      }],
    };
  }
}
