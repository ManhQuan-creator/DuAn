import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Component, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { SingleSelectComponent, SelectOption, TreeNode, TreeSelectComponent } from '../shared/components/multi-select';
import { SclKpiCardsComponent } from './components/kpi-cards/kpi-cards.component';
import { SclDelayAlertsComponent } from './components/delay-alerts/delay-alerts.component';
import { KlMonthlyChartComponent } from './components/kl-monthly-chart/kl-monthly-chart.component';
import { HachToanTopChartComponent } from './components/hach-toan-top-chart/hach-toan-top-chart.component';
import { StatusDonutChartComponent } from './components/status-donut-chart/status-donut-chart.component';
import { UnitStructureChartComponent } from './components/unit-structure-chart/unit-structure-chart.component';
import { HeatmapKlChartComponent } from './components/heatmap-kl-chart/heatmap-kl-chart.component';
import { EfficiencyBubbleChartComponent } from './components/efficiency-bubble-chart/efficiency-bubble-chart.component';
import { SclReportService } from './service/scl-report.service';
import { AuthService } from '../auth/auth.service';

/**
 * Trang Dashboard SCL — container component.
 *
 * 2 filter toàn cục ở header:
 *  - Năm báo cáo (year picker) → `SclReportService` swap JSON data theo năm.
 *  - Đơn vị (HQ only) → KPI + Delay scope xuống 1 đơn vị; chart so sánh đa đơn vị
 *    tự ẩn khi filter active.
 */
interface OrgTreeJson {
  code: string;
  name: string;
  level: number;
  children?: OrgTreeJson[];
}

@Component({
  selector: 'app-dashboard-scl',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SingleSelectComponent,
    TreeSelectComponent,
    SclKpiCardsComponent,
    SclDelayAlertsComponent,
    KlMonthlyChartComponent,
    HachToanTopChartComponent,
    StatusDonutChartComponent,
    UnitStructureChartComponent,
    HeatmapKlChartComponent,
    EfficiencyBubbleChartComponent,
  ],
  templateUrl: './dashboard-scl.component.html',
  styleUrls: ['./dashboard-scl.component.scss'],
})
export class DashboardSclComponent {
  private readonly reportService = inject(SclReportService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  /** Danh sách năm chọn được — hiện chỉ 2025 có data, các năm khác sẽ empty. */
  readonly yearOptions: SelectOption<number>[] = [
    { value: 2023, label: '2023' },
    { value: 2024, label: '2024' },
    { value: 2025, label: '2025' },
    { value: 2026, label: '2026' },
  ];

  selectedYear = 2025;

  /** Cutoff Q1 của năm được chọn — data mẫu hiện tại là Q1/2025. */
  get cutoffDate(): string {
    return `ngày 31 tháng 3 năm ${this.selectedYear}`;
  }

  readonly kpi$ = this.reportService.kpis$;
  readonly delays$ = this.reportService.delayAlerts$;
  readonly units$ = this.reportService.units$;
  readonly total$ = this.reportService.totalRow$;
  readonly effectiveTotal$ = this.reportService.effectiveTotal$;
  readonly selectedUnit$ = this.reportService.selectedUnit$;

  /** Options cho dropdown đơn vị — map từ units$ sang SelectOption. */
  readonly unitOptions$ = this.reportService.units$.pipe(
    map((units): SelectOption<string>[] =>
      units.map(u => ({ value: u.donVi, label: u.donVi })),
    ),
  );

  /** Cây đơn vị 3 cấp load từ `assets/scl-org-tree.json`. Value = `name` (khớp `donVi` data). */
  readonly unitTree$: Observable<TreeNode<string>[]> = this.http
    .get<OrgTreeJson>('assets/scl-org-tree.json')
    .pipe(
      map(root => [this.toTreeNode(root)]),
      catchError(() => of<TreeNode<string>[]>([])),
      shareReplay(1),
    );

  private toTreeNode(o: OrgTreeJson): TreeNode<string> {
    return {
      value: o.name,
      label: o.name,
      children: o.children?.map(c => this.toTreeNode(c)),
    };
  }

  /** Số đơn vị có kế hoạch > 0 — dùng cho subtitle chart top/bottom % hạch toán. */
  readonly hachToanEligibleCount$ = this.reportService.units$.pipe(
    map(units => units.filter(u => (u.khChiPhiTong ?? 0) > 0).length),
  );

  readonly isHeadquarters = this.authService.isHeadquarters();

  selectedUnit: string | null = null;

  onUnitChange(value: string | null): void {
    this.selectedUnit = value ?? null;
    this.reportService.setSelectedUnit(this.selectedUnit);
  }

  onYearChange(value: number | null): void {
    const nextYear = value ?? 2025;
    this.selectedYear = nextYear;
    this.selectedUnit = null;
    this.reportService.setSelectedYear(nextYear);
  }
}
