import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@tinkoff/ng-polymorpheus';
import {
  TuiDialogContext,
  TuiDataListModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import { TuiInputYearModule } from '@taiga-ui/kit';
import { CatalogService } from '../../catalog-manager/service/catalog.service';
import { CatalogItem } from '../../excel-builder/models/catalog.data';
import { PeriodType } from '../../excel-builder/models/grid-template.model';
import { SingleSelectComponent, SelectOption } from '../../shared/components/multi-select';
import {
  QUARTER_TO_MONTH,
  QUARTER_LABELS,
  HALF_YEAR_TO_MONTH,
  HALF_YEAR_LABELS,
  MONTH_VALUES,
  formatMonthLabel,
} from '../../shared/grid-core';

export interface CreateEntryDialogData {
  /** Mã biểu mẫu hiện tại (đã load từ template.code) */
  templateCode: string;
  /** companyCode của user đang login — null = được phép chọn đơn vị */
  userCompanyCode: string | null;
  /** Kỳ báo cáo của template — quyết định trường nào hiển thị trong form */
  periodType?: PeriodType;
}

export interface CreateEntryDialogResult {
  code: string;
  name: string;
  year: number;
  /** null = cả năm */
  month: number | null;
  /** 'TCT' hoặc id của CT_DIEN_LUC đã chọn */
  orgCode: string;
}

interface OrgOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-create-entry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiInputYearModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    SingleSelectComponent,
  ],
  templateUrl: './create-entry-dialog.component.html',
  styleUrls: ['./create-entry-dialog.component.scss'],
})
export class CreateEntryDialogComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);

  readonly data: CreateEntryDialogData;

  /** Ngày hiện tại — dùng để auto-fill năm/tháng */
  private readonly now = new Date();

  /** Model cho tui-input-year — number theo convention đang dùng trong excel-render */
  selectedYear: number | null = this.now.getFullYear();

  /** Báo cáo MONTH bắt buộc chọn tháng — không còn option "Cả năm" */
  readonly monthSelectOptions: SelectOption<number>[] = MONTH_VALUES.map(m => ({
    value: m,
    label: formatMonthLabel(m),
  }));
  selectedMonth: number | null = this.now.getMonth() + 1;

  /** Quý — ordinal 1..4 → map sang month 3/6/9/12 khi submit (xem QUARTER_TO_MONTH). */
  readonly quarterSelectOptions: SelectOption<number>[] = ([1, 2, 3, 4] as const).map(o => ({
    value: o,
    label: QUARTER_LABELS[o],
  }));
  selectedQuarter: number | null = null;

  /** Nửa năm — ordinal 1..2 → map sang month 6/12 (xem HALF_YEAR_TO_MONTH). */
  readonly halfYearSelectOptions: SelectOption<number>[] = ([1, 2] as const).map(o => ({
    value: o,
    label: HALF_YEAR_LABELS[o],
  }));
  selectedHalfYear: number | null = null;

  form = {
    code: '',
    name: '',
    orgCode: '',
  };

  /** Kỳ báo cáo từ template — default MONTH */
  get periodType(): PeriodType {
    return this.data.periodType ?? 'MONTH';
  }
  get isMonthMode(): boolean { return this.periodType === 'MONTH'; }
  get isQuarterMode(): boolean { return this.periodType === 'QUARTER'; }
  get isHalfYearMode(): boolean { return this.periodType === 'HALF_YEAR'; }
  get isYearMode(): boolean { return this.periodType === 'YEAR'; }

  orgOptions: OrgOption[] = [
    { value: 'TCT', label: 'TCT - Tổng công ty Điện lực miền Bắc' },
  ];

  /** Options cho `<app-single-select>` — recompute khi orgOptions đổi (sau load catalog). */
  orgSelectOptions: SelectOption<string>[] = [
    { value: 'TCT', label: 'TCT - Tổng công ty Điện lực miền Bắc' },
  ];

  constructor(
    @Inject(POLYMORPHEUS_CONTEXT)
    private readonly context: TuiDialogContext<CreateEntryDialogResult | null, CreateEntryDialogData>,
  ) {
    this.data = context.data;
    this.applyAutoFill();
  }

  ngOnInit(): void {
    this.loadOrgOptions();
  }

  /** Người dùng subsidiary không được đổi orgCode */
  get orgLocked(): boolean {
    return !!this.data.userCompanyCode;
  }

  get canSubmit(): boolean {
    if (!this.form.code.trim() || !this.form.name.trim() || !this.form.orgCode) return false;
    if (this.selectedYear == null) return false;
    if (this.isQuarterMode && this.selectedQuarter == null) return false;
    if (this.isHalfYearMode && this.selectedHalfYear == null) return false;
    if (this.isMonthMode && this.selectedMonth == null) return false;
    return true;
  }

  /** Tính month thực tế submit lên BE dựa theo periodType */
  private resolveMonthForSubmit(): number | null {
    if (this.isYearMode) return null;
    if (this.isQuarterMode) {
      const q = this.selectedQuarter;
      return q === 1 || q === 2 || q === 3 || q === 4 ? QUARTER_TO_MONTH[q] : null;
    }
    if (this.isHalfYearMode) {
      const h = this.selectedHalfYear;
      return h === 1 || h === 2 ? HALF_YEAR_TO_MONTH[h] : null;
    }
    return this.selectedMonth;
  }

  submit(): void {
    if (!this.canSubmit || this.selectedYear == null) return;
    // dueDate KHÔNG set ở đây — hạn xử lý do cấp trên giao xuống qua handler
    // "Giao chi phí cho đơn vị", không phải đơn vị tự đặt khi tạo phiên.
    this.context.completeWith({
      code: this.form.code.trim(),
      name: this.form.name.trim(),
      year: this.selectedYear,
      month: this.resolveMonthForSubmit(),
      orgCode: this.form.orgCode,
    });
  }

  cancel(): void {
    this.context.completeWith(null);
  }

  /** Cập nhật code/name khi year hoặc month đổi */
  onDateChange(): void {
    this.applyAutoFill();
  }

  /** Cập nhật code/name khi đơn vị đổi */
  onOrgChange(): void {
    this.applyAutoFill();
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Auto-fill code/name: {templateCode}_{orgCode}_{year}_{period} */
  private applyAutoFill(): void {
    const year = this.selectedYear ?? this.now.getFullYear();
    let periodPart: string;
    if (this.isYearMode) {
      periodPart = `${year}`;
    } else if (this.isQuarterMode) {
      periodPart = this.selectedQuarter != null ? `${year}_Q${this.selectedQuarter}` : `${year}`;
    } else if (this.isHalfYearMode) {
      periodPart = this.selectedHalfYear != null ? `${year}_H${this.selectedHalfYear}` : `${year}`;
    } else {
      const monthPart = this.selectedMonth == null ? 'null' : String(this.selectedMonth);
      periodPart = `${year}_${monthPart}`;
    }
    const orgPart = this.form.orgCode || 'ORG';
    this.form.code = `${this.data.templateCode}_${orgPart}_${periodPart}`;
    this.form.name = `${orgPart}_${periodPart}`;
  }

  private loadOrgOptions(): void {
    this.catalogService.getCatalogs('CT_DIEN_LUC').subscribe({
      next: (items) => {
        const pcs = (items ?? [])
          .filter((i) => i.active !== false)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map<OrgOption>((i: CatalogItem) => ({ value: i.id, label: i.name }));
        // TCT luôn ở đầu, rồi tới danh sách PC
        this.orgOptions = [
          { value: 'TCT', label: 'TCT - Tổng công ty Điện lực miền Bắc' },
          ...pcs,
        ];
        this.orgSelectOptions = this.orgOptions.map(o => ({
          value: o.value,
          label: o.label,
          searchText: o.value,
        }));
        this.resolveDefaultOrg();
      },
      error: () => this.resolveDefaultOrg(),
    });
  }

  /** Chọn sẵn orgCode khi user có companyCode, hoặc default TCT */
  private resolveDefaultOrg(): void {
    if (this.data.userCompanyCode) {
      const match = this.orgOptions.find((o) => o.value === this.data.userCompanyCode);
      this.form.orgCode = match ? match.value : this.data.userCompanyCode;
    } else if (!this.form.orgCode) {
      this.form.orgCode = 'TCT';
    }
    this.applyAutoFill();
  }
}
