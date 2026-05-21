import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

/**
 * Chart 4 — Stacked bar cơ cấu hạng mục theo đơn vị.
 * X: đơn vị. Stack 3 loại: 110kV (PC+TCT), THT, Khác.
 */
@Component({
  selector: 'app-scl-unit-structure-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgxEchartsDirective],
  template: `
    <div class="chart-host">
      <echarts [options]="options" class="echarts-instance" [autoResize]="true"></echarts>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .chart-host { height: 340px; width: 100%; }
    .echarts-instance { height: 100%; width: 100%; display: block; }
  `],
})
export class UnitStructureChartComponent implements OnChanges {
  @Input({ required: true }) units!: SclReportRow[];

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units']) this.options = this.build();
  }

  private build(): EChartsCoreOption {
    // Loại các đơn vị không triển khai hạng mục nào (CNTT...)
    const rows = this.units.filter(u => (u.hmTrienkhaiTong ?? 0) > 0);
    const names = rows.map(u => u.donVi);
    const v110 = rows.map(u => (u.hmTrienkhai110kvPc ?? 0) + (u.hmTrienkhai110kvTct ?? 0));
    const vTht = rows.map(u => u.hmTrienkhaiTht ?? 0);
    const vKhac = rows.map(u => u.hmTrienkhaiKhac ?? 0);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: {
        bottom: 0,
        itemWidth: 14,
        itemHeight: 14,
        textStyle: { fontSize: 12, color: '#334155' },
      },
      grid: { left: 8, right: 16, top: 16, bottom: 60, containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          interval: 0,
          rotate: 30,
          fontSize: 10,
          width: 100,
          overflow: 'truncate',
          color: '#475569',
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '110kV', type: 'bar', stack: 'total', data: v110,
          itemStyle: { color: '#6366f1' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'THT', type: 'bar', stack: 'total', data: vTht,
          itemStyle: { color: '#10b981' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Khác', type: 'bar', stack: 'total', data: vKhac,
          itemStyle: { color: '#8b5cf6' },
          emphasis: { focus: 'series' },
        },
      ],
    };
  }
}
