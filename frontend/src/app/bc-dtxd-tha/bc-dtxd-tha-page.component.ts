import { CommonModule } from '@angular/common';
import {
  Component, OnDestroy, OnInit, computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SelectOption, SingleSelectComponent } from '../shared/components/multi-select';
import { Pl179DashboardComponent } from './pl179-nhom-chuong-trinh/pl179-dashboard.component';
import { Pl180DashboardComponent } from './pl180-giai-doan/pl180-dashboard.component';
import { Pl181DashboardComponent } from './pl181-kh-von/pl181-dashboard.component';
import { Pl182DashboardComponent } from './pl182-giam-sat/pl182-dashboard.component';
import { Pl183DashboardComponent } from './pl183-hieu-qua/pl183-dashboard.component';
import { buildYearOptions } from './shared/period-options.util';

type TabKey = 'pl179' | 'pl180' | 'pl181' | 'pl182' | 'pl183';

interface TabDef {
  key: TabKey;
  label: string;
}

const TAB_DEFS: TabDef[] = [
  { key: 'pl179', label: 'TÌNH HÌNH THĐT' },
  { key: 'pl180', label: 'TÌNH HÌNH THĐT THEO GIAI ĐOẠN' },
  { key: 'pl181', label: 'KẾ HOẠCH VỐN' },
  { key: 'pl182', label: 'GIÁM SÁT ĐẦU TƯ' },
  { key: 'pl183', label: 'HIỆU QUẢ ĐẦU TƯ' }
];

const DEFAULT_TAB: TabKey = 'pl179';

/** Tab có data theo PC — có filter Đơn vị. PL181 (theo nguồn vốn) và PL182
 *  (Biểu 3.1 cấp TCT) không có. */
const TABS_WITH_UNIT_FILTER: TabKey[] = ['pl179', 'pl180', 'pl183'];

/**
 * Page cha Báo cáo ĐTXD THA & Khác.
 *
 * Render 5 tab + 2 filter trên header (Năm chung cho cả 5 tab, Đơn vị chỉ
 * hiện khi tab active có data theo PC). Active tab nhúng sub-component
 * dashboard read-only. URL path `/bc-dtxd-tha/pl179` deep-link (route param
 * `:tab`); `/bc-dtxd-tha` redirect sang `pl179`.
 *
 * Filter Đơn vị truyền xuống 3 sub-component PL179/180/183 qua `[selectedUnit]`
 * Input. Sub-component emit `(unitsAvailable)` Output ↑ để page cha cập nhật
 * options dropdown dynamic theo data thực có.
 */
@Component({
  selector: 'app-bc-dtxd-tha-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SingleSelectComponent,
    Pl179DashboardComponent,
    Pl180DashboardComponent,
    Pl181DashboardComponent,
    Pl182DashboardComponent,
    Pl183DashboardComponent,
  ],
  templateUrl: './bc-dtxd-tha-page.component.html',
  styleUrls: ['./bc-dtxd-tha-page.component.scss'],
})
export class BcDtxdThaPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  readonly tabs = TAB_DEFS;
  readonly yearOptions: SelectOption<number>[] = buildYearOptions();
  selectedYear = new Date().getFullYear();

  /** Active tab (signal để hasUnitFilter computed react được). */
  readonly activeTab = signal<TabKey>(DEFAULT_TAB);

  /** Filter đơn vị (null = tất cả). Reset khi switch tab. */
  readonly selectedUnit = signal<string | null>(null);

  /** Options đơn vị — emit từ sub-component qua (unitsAvailable). */
  readonly availableUnits = signal<string[]>([]);

  /** Có hiển thị dropdown Đơn vị không (3 tab PL179/180/183). */
  readonly hasUnitFilter = computed<boolean>(() =>
    TABS_WITH_UNIT_FILTER.includes(this.activeTab()));

  readonly unitOptions = computed<SelectOption<string | null>[]>(() => [
    { value: null, label: 'Tất cả đơn vị' },
    ...this.availableUnits().map(u => ({ value: u, label: u })),
  ]);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(pm => {
      const tab = pm.get('tab') as TabKey | null;
      const next = (tab && TAB_DEFS.some(t => t.key === tab)) ? tab : DEFAULT_TAB;
      if (next !== this.activeTab()) {
        this.activeTab.set(next);
        // Reset unit khi đổi tab — sub-component mới sẽ emit options tương ứng
        this.selectedUnit.set(null);
        this.availableUnits.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onYearChange(year: number): void {
    this.selectedYear = year;
    // Năm đổi → reset đơn vị để load lại options
    this.selectedUnit.set(null);
    this.availableUnits.set([]);
  }

  onUnitChange(unit: string | null): void {
    this.selectedUnit.set(unit);
  }

  /** Sub-component emit options khi load data xong. */
  onUnitsAvailable(units: string[]): void {
    this.availableUnits.set(units);
  }

  selectTab(key: TabKey): void {
    if (key === this.activeTab()) return;
    this.router.navigate(['/bc-dtxd-tha', key]);
  }
}
