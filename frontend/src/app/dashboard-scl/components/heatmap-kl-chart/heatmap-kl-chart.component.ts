import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

/**
 * Chart 5 — Heatmap Khối lượng KL theo Tháng × Đơn vị.
 *
 * Hàng = tháng (T1..T6), Cột = đơn vị. Màu đậm = KL cao.
 * Tooltip hiện giá trị chính xác. Loại đơn vị có klLuyKe = 0.
 */
@Component({
  selector: 'app-scl-heatmap-kl-chart',
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
    .chart-host { height: 380px; width: 100%; }
    .echarts-instance { height: 100%; width: 100%; display: block; }
  `],
})
export class HeatmapKlChartComponent implements OnChanges {
  @Input({ required: true }) units!: SclReportRow[];

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units']) this.options = this.build();
  }

  private build(): EChartsCoreOption {
    // Loại đơn vị không có khối lượng nào (defensive — data clean rồi nhưng giữ rule)
    const rows = this.units.filter(u => (u.klLuyKe ?? 0) > 0);
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    const monthFields: Array<keyof SclReportRow> = ['klT1', 'klT2', 'klT3', 'klT4', 'klT5', 'klT6'];
    const unitNames = rows.map(u => u.donVi);

    // echarts heatmap data: [xIndex, yIndex, value]
    const data: [number, number, number][] = [];
    let maxValue = 0;
    for (let xi = 0; xi < unitNames.length; xi++) {
      for (let yi = 0; yi < months.length; yi++) {
        const v = (rows[xi][monthFields[yi]] as number | undefined) ?? 0;
        data.push([xi, yi, v]);
        if (v > maxValue) maxValue = v;
      }
    }

    return {
      tooltip: {
        position: 'top',
        formatter: (p: any) => {
          const [xi, yi, v] = p.data;
          return `<b>${unitNames[xi]}</b><br/>${months[yi]}: ${new Intl.NumberFormat('vi-VN').format(v)} trđ`;
        },
      },
      grid: { left: 8, right: 24, top: 32, bottom: 80, containLabel: true },
      xAxis: {
        type: 'category',
        data: unitNames,
        splitArea: { show: true },
        axisLabel: {
          interval: 0,
          rotate: 35,
          fontSize: 10,
          width: 90,
          overflow: 'truncate',
          color: '#475569',
        },
      },
      yAxis: {
        type: 'category',
        data: months,
        splitArea: { show: true },
        axisLabel: { fontSize: 11 },
      },
      visualMap: {
        min: 0,
        max: Math.max(1, maxValue),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        itemWidth: 14,
        itemHeight: 120,
        inRange: {
          color: ['#f0f9ff', '#7dd3fc', '#0284c7', '#0c4a6e'],
        },
        textStyle: { fontSize: 10, color: '#475569' },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' },
          },
        },
      ],
    };
  }
}
