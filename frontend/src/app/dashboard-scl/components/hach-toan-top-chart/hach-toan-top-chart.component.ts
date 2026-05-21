import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

interface BarItem {
  name: string;
  value: number | null;
  kind?: 'top' | 'bottom';
  isSeparator?: boolean;
}

/**
 * Chart 2 — Horizontal bar: `topCount` đơn vị tỷ lệ hạch toán cao nhất (trên)
 * + `bottomCount` đơn vị thấp nhất (dưới), cách nhau bằng dashed markLine ngang
 * qua chart (replace text "N đơn vị khác" trước đây — phần giữa bị lược chỉ
 * còn 1 đường line cách điệu).
 *
 * Màu bar theo nhóm xếp hạng: Top → xanh (#10b981), Bottom → đỏ (#ef4444).
 * Đơn vị có `khChiPhiTong = 0` (CNTT, Dịch vụ ĐL...) bị loại vì không so được %.
 */
@Component({
  selector: 'app-scl-hach-toan-top-chart',
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
export class HachToanTopChartComponent implements OnChanges {
  @Input({ required: true }) units!: SclReportRow[];
  @Input() topCount = 3;
  @Input() bottomCount = 3;

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units'] || changes['topCount'] || changes['bottomCount']) {
      this.options = this.build();
    }
  }

  private build(): EChartsCoreOption {
    const eligible = this.units
      .filter(u => (u.khChiPhiTong ?? 0) > 0 && u.tyLeHachToan != null)
      .sort((a, b) => (b.tyLeHachToan ?? 0) - (a.tyLeHachToan ?? 0));

    const top = eligible.slice(0, this.topCount);
    const bottom = this.bottomCount > 0
      ? eligible.slice(Math.max(this.topCount, eligible.length - this.bottomCount))
      : [];
    const hiddenCount = Math.max(0, eligible.length - top.length - bottom.length);

    const items: BarItem[] = [
      ...top.map(u => ({ name: u.donVi, value: (u.tyLeHachToan ?? 0) * 100, kind: 'top' as const })),
    ];
    if (hiddenCount > 0) {
      items.push({ name: `__separator_${hiddenCount}__`, value: null, isSeparator: true });
    }
    items.push(
      ...bottom.map(u => ({ name: u.donVi, value: (u.tyLeHachToan ?? 0) * 100, kind: 'bottom' as const })),
    );

    // echarts bar ngang: yAxis = category. Reverse để item đầu list (top 1) hiện ở trên cùng.
    const reversed = [...items].reverse();
    const names = reversed.map(i => i.name);
    const separatorIdx = reversed.findIndex(i => i.isSeparator);
    const data = reversed.map(i =>
      i.isSeparator
        ? { value: 0, itemStyle: { color: 'transparent' }, label: { show: false } }
        : {
            value: i.value,
            itemStyle: {
              color: i.kind === 'top' ? '#10b981' : '#ef4444',
              borderRadius: [0, 6, 6, 0],
            },
          }
    );

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p?.dataIndex;
          const item = reversed[idx];
          if (!item || item.isSeparator) return '';
          return `${item.name}<br/><strong>${Number(item.value).toFixed(1).replace('.', ',')}%</strong>`;
        },
      },
      grid: { left: 8, right: 56, top: 16, bottom: 32, containLabel: true },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          fontSize: 11,
          formatter: (value: string, idx: number) =>
            reversed[idx]?.isSeparator
              ? `{sep|${'─ '.repeat(22)}}`
              : `{normal|${value}}`,
          rich: {
            sep:    { color: '#94a3b8', fontSize: 11, width: 180, align: 'right' },
            normal: { color: '#334155', fontSize: 11, width: 180, overflow: 'truncate' },
          },
        },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data,
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) =>
              p.value ? `${Number(p.value).toFixed(1).replace('.', ',')}%` : '',
            fontSize: 11,
            color: '#334155',
          },
          markLine: separatorIdx >= 0
            ? {
                symbol: ['circle', 'circle'],
                symbolSize: 6,
                silent: true,
                lineStyle: {
                  type: 'dashed',
                  color: '#94a3b8',
                  width: 1.5,
                },
                label: { show: false },
                data: [
                  [
                    { coord: [0, separatorIdx], itemStyle: { color: '#94a3b8' } },
                    { coord: [100, separatorIdx], itemStyle: { color: '#94a3b8' } },
                  ],
                ],
              }
            : undefined,
        },
      ],
    };
  }
}
