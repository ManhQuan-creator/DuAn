import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

/**
 * Chart 1 — Line chart Khối lượng thực hiện T1 → T6 (đơn vị: triệu đồng).
 * Data: dòng TỔNG CỘNG toàn TCT. Phase 3 có thể overlay thêm đơn vị.
 */
@Component({
  selector: 'app-scl-kl-monthly-chart',
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
    .chart-host { height: 320px; width: 100%; }
    .echarts-instance { height: 100%; width: 100%; display: block; }
  `],
})
export class KlMonthlyChartComponent implements OnChanges {
  @Input({ required: true }) total!: SclReportRow | null;

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['total']) this.options = this.build();
  }

  private build(): EChartsCoreOption {
    const t = this.total;
    const series = [
      t?.klT1 ?? 0,
      t?.klT2 ?? 0,
      t?.klT3 ?? 0,
      t?.klT4 ?? 0,
      t?.klT5 ?? 0,
      t?.klT6 ?? 0,
    ];

    return {
      tooltip: {
        trigger: 'axis',
        valueFormatter: (val: any) => `${new Intl.NumberFormat('vi-VN').format(Number(val))} trđ`,
      },
      grid: { left: 48, right: 24, top: 32, bottom: 32 },
      xAxis: {
        type: 'category',
        data: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
        axisLine: { lineStyle: { color: '#cbd5e1' } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
        },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          name: 'Tổng toàn TCT',
          type: 'line',
          smooth: true,
          symbolSize: 8,
          data: series,
          lineStyle: { width: 3, color: '#0ea5e9' },
          itemStyle: { color: '#0ea5e9' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(14, 165, 233, 0.35)' },
                { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
              ],
            },
          },
        },
      ],
    };
  }
}
