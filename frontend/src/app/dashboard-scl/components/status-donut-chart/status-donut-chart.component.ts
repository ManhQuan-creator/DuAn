import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

/**
 * Chart 3 — Donut phân bố trạng thái hạng mục (toàn TCT).
 * Lát: Thi công xong / Đang thi công / Đấu thầu / NPSC / Đã ký HĐ / Giao tuyến.
 */
@Component({
  selector: 'app-scl-status-donut-chart',
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
export class StatusDonutChartComponent implements OnChanges {
  @Input({ required: true }) total!: SclReportRow | null;

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['total']) this.options = this.build();
  }

  private build(): EChartsCoreOption {
    const t = this.total;
    const data = [
      { name: 'Thi công xong',  value: t?.tdXongTong ?? 0,      itemStyle: { color: '#10b981' } },
      { name: 'Đang thi công',  value: t?.tdThiCongTong ?? 0,   itemStyle: { color: '#0ea5e9' } },
      { name: 'Đấu thầu',       value: t?.tdDauThau ?? 0,        itemStyle: { color: '#f59e0b' } },
      { name: 'NPSC thực hiện', value: t?.tdNpsc ?? 0,           itemStyle: { color: '#8b5cf6' } },
      { name: 'Đã ký HĐ',       value: t?.tdDaKyHd ?? 0,         itemStyle: { color: '#6366f1' } },
      { name: 'Giao tuyến',     value: t?.tdGiaoTuyenTong ?? 0,  itemStyle: { color: '#64748b' } },
    ].filter(d => d.value > 0);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}<br/><b>${p.value}</b> hạng mục (${p.percent}%)`,
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 11, color: '#334155' },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: '{d}%',
            fontSize: 11,
            fontWeight: 600,
          },
          labelLine: { length: 8, length2: 6 },
          data,
        },
      ],
    };
  }
}
