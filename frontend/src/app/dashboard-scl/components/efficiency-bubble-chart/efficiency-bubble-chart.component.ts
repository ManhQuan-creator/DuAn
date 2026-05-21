import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { SclReportRow } from '../../models/scl-report.model';

/**
 * Chart 6 — Bubble/Scatter "Hiệu quả đầu tư".
 *
 * - X: `khChiPhiTong` (quy mô KH chi phí, trđ)
 * - Y: `tyLeHachToan` (% hạch toán, 0-100)
 * - Bubble size: `hmTrienkhaiTong` (số HM triển khai)
 * - Màu: theo delay ratio = `htSauTong / hmTrienkhaiTong`
 *     - 0 → xanh (good), 0-15% → vàng, 15-30% → cam, >30% → đỏ
 *
 * Đơn vị "tốt" nằm góc trên-phải (KH lớn + % hạch toán cao + xanh).
 * Đơn vị "cần lưu ý" nằm góc trên-phải-đỏ (KH lớn + chậm nhiều).
 */
@Component({
  selector: 'app-scl-efficiency-bubble-chart',
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
export class EfficiencyBubbleChartComponent implements OnChanges {
  @Input({ required: true }) units!: SclReportRow[];

  options: EChartsCoreOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['units']) this.options = this.build();
  }

  private build(): EChartsCoreOption {
    const colorByDelay = (ratio: number): string => {
      if (ratio === 0) return '#10b981';            // emerald — không chậm
      if (ratio < 0.15) return '#f59e0b';           // amber
      if (ratio < 0.30) return '#fb923c';           // orange-400
      return '#ef4444';                             // red
    };

    // Mỗi đơn vị → 1 datapoint với scale bubble theo hmTrienkhaiTong
    const points = this.units
      .filter(u => (u.khChiPhiTong ?? 0) > 0 && (u.hmTrienkhaiTong ?? 0) > 0)
      .map(u => {
        const trienkhai = u.hmTrienkhaiTong ?? 0;
        const htSau = u.htSauTong ?? 0;
        const delayRatio = trienkhai > 0 ? htSau / trienkhai : 0;
        return {
          name: u.donVi,
          value: [
            u.khChiPhiTong,
            (u.tyLeHachToan ?? 0) * 100,
            trienkhai,
            delayRatio,
            htSau,
          ],
          itemStyle: { color: colorByDelay(delayRatio), opacity: 0.8 },
        };
      });

    // Bubble size scale: HM 1 → 10px, HM 200 → 60px (sqrt scale cho dễ phân biệt nhỏ)
    const maxHm = Math.max(...points.map(p => p.value[2] as number), 1);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          const [kh, pct, trienkhai, ratio, htSau] = p.data.value;
          const fmtMoney = (v: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v);
          return `
            <div style="font-weight:700;margin-bottom:4px">${p.data.name}</div>
            <div>KH chi phí: <b>${fmtMoney(kh)} trđ</b></div>
            <div>% hạch toán: <b>${pct.toFixed(1).replace('.', ',')}%</b></div>
            <div>HM triển khai: <b>${trienkhai}</b></div>
            <div>HM chậm: <b style="color:${ratio > 0.15 ? '#dc2626' : '#475569'}">${htSau} (${(ratio * 100).toFixed(1).replace('.', ',')}%)</b></div>
          `;
        },
      },
      grid: { left: 56, right: 24, top: 24, bottom: 48, containLabel: true },
      xAxis: {
        type: 'value',
        name: 'KH chi phí (trđ)',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { fontSize: 11, color: '#64748b', fontWeight: 600 },
        axisLabel: {
          formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`,
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      yAxis: {
        type: 'value',
        name: '% hạch toán',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { fontSize: 11, color: '#64748b', fontWeight: 600 },
        max: 100,
        axisLabel: { formatter: '{value}%', fontSize: 10 },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
      },
      series: [
        {
          type: 'scatter',
          data: points,
          symbolSize: (val: number[]) => {
            // val[2] = hmTrienkhaiTong; sqrt scale 12..56px
            const ratio = (val[2] as number) / maxHm;
            return 12 + Math.sqrt(ratio) * 44;
          },
          label: {
            show: true,
            formatter: (p: any) => {
              // Bỏ prefix "Công ty Điện lực " để label gọn
              return p.data.name.replace(/^Công ty Điện lực /, '');
            },
            fontSize: 10,
            color: '#1e293b',
            position: 'top',
          },
          emphasis: {
            focus: 'self',
            itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.3)' },
          },
        },
      ],
    };
  }
}
