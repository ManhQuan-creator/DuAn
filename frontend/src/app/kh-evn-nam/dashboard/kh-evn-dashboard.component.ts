import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';
import { LoadingService } from '../../shared/loading.service';
import { AppDialogService } from '../../shared/dialog.service';
import { SingleSelectComponent, SelectOption } from '../../shared/components/multi-select';
import { KhEvnDataService } from '../service/kh-evn-data.service';
import { KhSxkdKpi, KhSxkdRow, KhMucTieuRow, MucTieuGroup } from '../model/kh-evn.model';
import { buildYearOptions } from '../utils/year-options.util';

/**
 * Dashboard KH năm EVN giao — 4 tầng layout:
 *   1. KPI cards (PL1 highlights)
 *   2. SXKD charts (TTĐN, độ tin cậy, suất sự cố, đào tạo)
 *   3. ĐTXD charts (cơ cấu nguồn vốn, cơ cấu hạng mục, giá bán buôn)
 *   4. Mục tiêu định tính (PL4) — accordion 3 nhóm
 *
 * Đọc 2 entry song song (KH_SXKD_NAM + KH_MUC_TIEU_NAM) cho năm chọn,
 * project ra typed KPI + ECharts options qua `KhEvnDataService.build*()`.
 */
@Component({
  selector: 'app-kh-evn-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxEchartsDirective, SingleSelectComponent],
  templateUrl: './kh-evn-dashboard.component.html',
  styleUrls: ['./kh-evn-dashboard.component.scss'],
})
export class KhEvnDashboardComponent implements OnInit {
  private readonly dataSvc = inject(KhEvnDataService);
  private readonly loading = inject(LoadingService);
  private readonly dialog = inject(AppDialogService);

  readonly yearOptions: SelectOption<number>[] = buildYearOptions();

  selectedYear = new Date().getFullYear();

  // Signals làm state ổn định cho template (OnPush-friendly).
  readonly sxkdRows = signal<KhSxkdRow[]>([]);
  readonly mucTieuRows = signal<KhMucTieuRow[]>([]);
  readonly loadError = signal<string | null>(null);

  /** Computed KPI hiển thị ở cards tầng 1 */
  readonly kpi = computed<KhSxkdKpi>(() => this.dataSvc.buildKpi(this.sxkdRows()));

  /** Computed mục tiêu groups (3 nhóm I/II/III) cho accordion tầng 4 */
  readonly mucTieuGroups = computed<MucTieuGroup[]>(() =>
    this.dataSvc.buildMucTieuGroups(this.mucTieuRows()),
  );

  /** Trạng thái mở/đóng accordion (default mở tất cả) */
  expandedSections = new Set<string>(['SEC_MT_I', 'SEC_MT_II', 'SEC_MT_III']);

  // ──────────────────────────────────────────────────────────────────────────
  // Chart options computed — gọi 1 lần per signal change.
  // ──────────────────────────────────────────────────────────────────────────

  readonly ttdnChartOptions = computed<EChartsCoreOption>(() =>
    this.buildTtdnOptions(),
  );
  readonly suatSuCoChartOptions = computed<EChartsCoreOption>(() =>
    this.buildSuatSuCoOptions(),
  );
  readonly doTinCayChartOptions = computed<EChartsCoreOption>(() =>
    this.buildDoTinCayOptions(),
  );
  readonly daoTaoChartOptions = computed<EChartsCoreOption>(() =>
    this.buildDaoTaoOptions(),
  );
  readonly nguonVonChartOptions = computed<EChartsCoreOption>(() =>
    this.buildNguonVonOptions(),
  );
  readonly hangMucChartOptions = computed<EChartsCoreOption>(() =>
    this.buildHangMucOptions(),
  );
  readonly giaBanBuonChartOptions = computed<EChartsCoreOption>(() =>
    this.buildGiaBanBuonOptions(),
  );

  ngOnInit(): void {
    this.loadData();
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    this.loadData();
  }

  toggleSection(code: string): void {
    if (this.expandedSections.has(code)) this.expandedSections.delete(code);
    else this.expandedSections.add(code);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Format helpers cho template
  // ──────────────────────────────────────────────────────────────────────────

  fmtNumber(v: number | null, fractionDigits = 0): string {
    if (v == null) return '—';
    return v.toLocaleString('vi-VN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  fmtPercent(v: number | null): string {
    if (v == null) return '—';
    return `${this.fmtNumber(v, 2)}%`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — Load data
  // ──────────────────────────────────────────────────────────────────────────

  private loadData(): void {
    this.loadError.set(null);
    this.loading.show();
    const year = this.selectedYear;
    this.dataSvc.loadOrCreateSxkdEntry(year).pipe(
      tap(({ rows }) => this.sxkdRows.set(rows)),
      switchMap(() => this.dataSvc.loadOrCreateMucTieuEntry(year)),
      tap(({ rows }) => this.mucTieuRows.set(rows)),
      catchError(err => {
        this.loadError.set(err?.message ?? 'Không tải được dữ liệu KH năm');
        this.sxkdRows.set([]);
        this.mucTieuRows.set([]);
        this.dialog.error('Không tải được dữ liệu kế hoạch năm EVN giao.');
        return of(null);
      }),
      finalize(() => this.loading.hide()),
    ).subscribe();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — Chart builders
  // ──────────────────────────────────────────────────────────────────────────

  private buildTtdnOptions(): EChartsCoreOption {
    const ttdn = this.dataSvc.buildTtdn(this.sxkdRows());
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/><b>${p[0].value ?? '—'}%</b>` },
      grid: { left: 60, right: 20, top: 30, bottom: 30 },
      xAxis: {
        type: 'category',
        data: ['Tổng', 'Cao áp', 'Trung áp', 'Hạ áp'],
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { color: '#475569', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
      series: [{
        type: 'bar',
        data: [
          { value: ttdn.tong ?? 0,    itemStyle: { color: '#ef4444' } },
          { value: ttdn.caoAp ?? 0,   itemStyle: { color: '#10b981' } },
          { value: ttdn.trungAp ?? 0, itemStyle: { color: '#0ea5e9' } },
          { value: ttdn.haAp ?? 0,    itemStyle: { color: '#f59e0b' } },
        ],
        barWidth: 36,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', formatter: (p: any) => `${p.value}%`, fontSize: 11 },
      }],
    };
  }

  private buildSuatSuCoOptions(): EChartsCoreOption {
    const ssc = this.dataSvc.buildSuatSuCo(this.sxkdRows());
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 130, right: 30, top: 20, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 11 }, splitLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: {
        type: 'category',
        data: ['ĐZ 110kV kéo dài', 'ĐZ 110kV thoáng qua', 'TBA 110kV'],
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        data: [
          { value: ssc.duongDayKeoDai ?? 0,    itemStyle: { color: '#dc2626' } },
          { value: ssc.duongDayThoangQua ?? 0, itemStyle: { color: '#f59e0b' } },
          { value: ssc.tba ?? 0,               itemStyle: { color: '#3b82f6' } },
        ],
        barWidth: 22,
        itemStyle: { borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', fontSize: 11, color: '#1e293b' },
      }],
    };
  }

  private buildDoTinCayOptions(): EChartsCoreOption {
    const dtc = this.dataSvc.buildDoTinCay(this.sxkdRows());
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: true, formatter: '{b}\n{c}', fontSize: 11 },
        data: [
          { name: 'MAIFI (lần)', value: dtc.maifi ?? 0,  itemStyle: { color: '#6366f1' } },
          { name: 'SAIDI (phút)', value: dtc.saidi ?? 0, itemStyle: { color: '#0ea5e9' } },
          { name: 'SAIFI (lần)', value: dtc.saifi ?? 0,  itemStyle: { color: '#10b981' } },
        ],
      }],
    };
  }

  private buildDaoTaoOptions(): EChartsCoreOption {
    const dt = this.dataSvc.buildDaoTao(this.sxkdRows());
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (p: any) => p.map((s: any) => `${s.seriesName}: <b>${(s.value ?? 0).toLocaleString('vi-VN')}</b>`).join('<br/>'),
      },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 70, right: 20, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: ['Lượt đào tạo', 'Chi phí (tr.đ)'],
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      yAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 11 }, splitLine: { lineStyle: { color: '#e2e8f0' } } },
      series: [
        { name: 'Dài hạn',   type: 'bar', stack: 'g', data: [dt.daiHan.luot ?? 0,   dt.daiHan.chiPhi ?? 0],   itemStyle: { color: '#8b5cf6' }, barWidth: 50 },
        { name: 'Ngắn hạn',  type: 'bar', stack: 'g', data: [dt.nganHan.luot ?? 0,  dt.nganHan.chiPhi ?? 0],  itemStyle: { color: '#0ea5e9' } },
        { name: 'E-learning',type: 'bar', stack: 'g', data: [dt.eLearning.luot ?? 0,dt.eLearning.chiPhi ?? 0],itemStyle: { color: '#f59e0b' } },
      ],
    };
  }

  private buildNguonVonOptions(): EChartsCoreOption {
    const von = this.dataSvc.buildVonDtxd(this.sxkdRows());
    const data = [
      { name: 'Vốn nước ngoài',     value: von.von.nuocNgoai ?? 0,    itemStyle: { color: '#6366f1' } },
      { name: 'Vốn vay trong nước', value: von.von.vayTrongNuoc ?? 0, itemStyle: { color: '#3b82f6' } },
      { name: 'Vốn TDTM',           value: von.von.tdtm ?? 0,         itemStyle: { color: '#f59e0b' } },
      { name: 'Vốn KHCB',           value: von.von.khcb ?? 0,         itemStyle: { color: '#10b981' } },
    ].filter(d => d.value > 0);
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: <b>${(p.value ?? 0).toLocaleString('vi-VN')} tr.đ</b> (${p.percent}%)` },
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

  private buildHangMucOptions(): EChartsCoreOption {
    const von = this.dataSvc.buildVonDtxd(this.sxkdRows());
    const data = [
      { name: 'Xây lắp',  value: von.hangMuc.xayLap ?? 0,   itemStyle: { color: '#0ea5e9' } },
      { name: 'Thiết bị', value: von.hangMuc.thietBi ?? 0,  itemStyle: { color: '#8b5cf6' } },
      { name: 'Khác',     value: von.hangMuc.khac ?? 0,     itemStyle: { color: '#64748b' } },
    ].filter(d => d.value > 0);
    return {
      tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}: <b>${(p.value ?? 0).toLocaleString('vi-VN')} tr.đ</b> (${p.percent}%)` },
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

  private buildGiaBanBuonOptions(): EChartsCoreOption {
    const gbb = this.dataSvc.buildGiaBanBuon(this.sxkdRows());
    return {
      tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/><b>${(p[0].value ?? 0).toLocaleString('vi-VN')} đ/kWh</b>` },
      grid: { left: 200, right: 60, top: 20, bottom: 30 },
      xAxis: { type: 'value', axisLabel: { color: '#475569', fontSize: 11 }, splitLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: {
        type: 'category',
        data: ['Cao điểm T1-3, 10-12', 'Cao điểm T4-6', 'Cao điểm T7-9', 'Thấp điểm', 'Bình thường', 'Bình quân KH'],
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar',
        barWidth: 18,
        data: [
          { value: gbb.caoDiemT1_3 ?? 0, itemStyle: { color: '#ef4444' } },
          { value: gbb.caoDiemT4_6 ?? 0, itemStyle: { color: '#dc2626' } },
          { value: gbb.caoDiemT7_9 ?? 0, itemStyle: { color: '#f59e0b' } },
          { value: gbb.thapDiem ?? 0,    itemStyle: { color: '#10b981' } },
          { value: gbb.binhThuong ?? 0,  itemStyle: { color: '#0ea5e9' } },
          { value: gbb.binhQuanKh ?? 0,  itemStyle: { color: '#8b5cf6' } },
        ],
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', fontSize: 11, color: '#1e293b' },
      }],
    };
  }
}
