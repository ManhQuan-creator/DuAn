import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiLabelModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import {
  TuiCheckboxLabeledModule,
  TuiDataListWrapperModule,
  TuiInputModule,
  TuiInputYearModule,
  TuiSelectModule,
  TuiTextareaModule,
} from '@taiga-ui/kit';
import { CatalogItem } from '../../models/catalog.data';
import { AppDialogDirective } from '../../../shared/components/app-dialog.directive';
import { WorkflowDefinitionListItem } from '../../../workflow-manager/workflow-definition.service';
import { SidebarMenuOption } from '../../../shared/sidebar-menu.service';
import { PERIOD_TYPE_OPTIONS, PeriodType } from '../../models/grid-template.model';
import { MultiSelectComponent, GroupedMultiSelectComponent, SingleSelectComponent, SelectOption } from '../../../shared/components/multi-select';

export interface AdvancedSettingsDialogData {
  code: string;
  name: string;
  processDefinitionKey?: string | null;
  reportDepartments?: string[];
  /** Mảng các SidebarMenu.menuKey đã chọn — nguồn data dropdown lấy từ bảng SIDEBAR_MENU. */
  reportFcGroups?: string[];
  /** Kỳ báo cáo: YEAR | HALF_YEAR | QUARTER | MONTH. Default = MONTH. */
  periodType?: PeriodType;
  /**
   * Năm/tháng preview để resolve placeholder ${N}/${M} trong header — chỉ là
   * trạng thái UI builder, KHÔNG persist vào template. Builder dùng giá trị
   * này để render header + export/import Excel khớp ngữ cảnh.
   */
  previewYear?: number;
  previewMonth?: number;
  /** Bật tính năng "Hạn xử lý" cho mọi entry của template. Default false. */
  useDueDate?: boolean;
}


@Component({
  selector: 'app-advanced-settings-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiInputModule,
    TuiInputYearModule,
    TuiSelectModule,
    TuiTextareaModule,
    TuiDataListModule,
    TuiDataListWrapperModule,
    TuiLabelModule,
    TuiButtonModule,
    TuiCheckboxLabeledModule,
    TuiTextfieldControllerModule,
    AppDialogDirective,
    MultiSelectComponent,
    GroupedMultiSelectComponent,
    SingleSelectComponent,
  ],
  templateUrl: './advanced-settings-dialog.component.html',
  styleUrl: './advanced-settings-dialog.component.scss',
})
export class AdvancedSettingsDialogComponent implements OnChanges {
  @Input() isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();

  @Input() title = 'Cấu hình nâng cao';

  @Input() data: AdvancedSettingsDialogData | null = null;
  @Input() workflows: WorkflowDefinitionListItem[] = [];
  @Input() reportDepartmentOptions: CatalogItem[] = [];
  /** Danh sách menu lá lấy từ SIDEBAR_MENU, dùng cho dropdown "Nhóm chức năng báo cáo". */
  @Input() sidebarMenuOptions: SidebarMenuOption[] = [];

  @Output() handleCancelEvent = new EventEmitter<void>();
  @Output() handleSaveEvent = new EventEmitter<AdvancedSettingsDialogData>();

  name = '';
  code = '';
  /** Chỉ cho phép chữ, số, gạch dưới — đồng bộ với save-template-dialog. */
  private readonly codePattern = /^[a-zA-Z0-9_]+$/;

  /** Value — chỉ giữ workflowKey (null = chưa gán quy trình) */
  selectedWorkflowKey: string | null = null;
  /** Value array — chỉ giữ id (CatalogItem.id) */
  selectedReportDepartmentIds: string[] = [];
  /** Value array — chỉ giữ menuKey (SidebarMenuOption.menuKey) */
  selectedSidebarMenuKeys: string[] = [];

  readonly periodTypeOptions = PERIOD_TYPE_OPTIONS;
  selectedPeriodType: PeriodType = 'MONTH';

  /** Bật tính năng "Hạn xử lý" cho mọi entry của template. */
  selectedUseDueDate = false;

  /** Năm preview placeholder ${N} — sync với builder.previewYear */
  previewYear: number = new Date().getFullYear();
  /** Tháng preview placeholder ${M} — sync với builder.previewMonth */
  previewMonth: number = new Date().getMonth() + 1;
  /** Options dropdown tháng 1-12 */
  readonly monthOptions: SelectOption<number>[] = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1, label: `Tháng ${i + 1}`,
  }));

  readonly stringifyPeriodType = (value: PeriodType | null): string =>
    PERIOD_TYPE_OPTIONS.find(o => o.value === value)?.label ?? '';

  /** Options cho single-select "Quy trình phê duyệt". */
  workflowSelectOptions: SelectOption<string>[] = [];

  /**
   * Options cho 2 multi-select — phải là FIELD, không phải getter, để tránh
   * tạo mảng mới mỗi lần CD → vòng lặp change detection vô hạn.
   * Chỉ rebuild khi input `reportDepartmentOptions` / `sidebarMenuOptions` đổi.
   */
  reportDepartmentSelectOptions: SelectOption<string>[] = [];
  sidebarMenuSelectOptions: SelectOption<string>[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reportDepartmentOptions']) {
      this.reportDepartmentSelectOptions = this.reportDepartmentOptions.map(item => ({
        value: item.id,
        label: item.name,
      }));
    }
    if (changes['sidebarMenuOptions']) {
      this.sidebarMenuSelectOptions = this.sidebarMenuOptions.map(opt => ({
        value: opt.menuKey,
        label: opt.label,
        group: opt.parentMenuKey ?? undefined,
        groupLabel: opt.parentLabel ?? undefined,
        searchText: opt.parentLabel ?? undefined,
      }));
    }
    if (changes['workflows']) {
      this.workflowSelectOptions = (this.workflows ?? []).map(wf => ({
        value: wf.workflowKey,
        label: wf.name,
      }));
    }

    if (
      (changes['data'] ||
        changes['isOpen'] ||
        changes['workflows'] ||
        changes['reportDepartmentOptions'] ||
        changes['sidebarMenuOptions']) &&
      this.isOpen &&
      this.data
    ) {
      this.code = this.data.code;
      this.name = this.data.name;

      this.selectedWorkflowKey = this.data.processDefinitionKey ?? null;

      this.selectedReportDepartmentIds = this.data.reportDepartments
        ? [...this.data.reportDepartments]
        : [];
      this.selectedSidebarMenuKeys = this.data.reportFcGroups
        ? [...this.data.reportFcGroups]
        : [];

      this.selectedPeriodType = this.data.periodType ?? 'MONTH';
      this.previewYear = this.data.previewYear ?? new Date().getFullYear();
      this.previewMonth = this.data.previewMonth ?? (new Date().getMonth() + 1);
      this.selectedUseDueDate = this.data.useDueDate ?? false;
    }
  }

  /** True nếu mã báo cáo hợp lệ (non-empty + đúng pattern). */
  get isCodeValid(): boolean {
    const trimmed = this.code.trim();
    return trimmed.length > 0 && this.codePattern.test(trimmed);
  }

  /** True nếu tên báo cáo hợp lệ (non-empty). */
  get isNameValid(): boolean {
    return this.name.trim().length > 0;
  }

  /** Enable nút Lưu khi cả mã và tên hợp lệ. */
  get canSave(): boolean {
    return this.isCodeValid && this.isNameValid;
  }

  onClose(): void {
    this.isOpen = false;
    this.isOpenChange.emit(false);
    this.handleCancelEvent.emit();
  }

  onSave(): void {
    this.handleSaveEvent.emit({
      code: this.code,
      name: this.name.replace(/^\s+|\s+$/g, ''),
      processDefinitionKey: this.selectedWorkflowKey,
      reportDepartments: [...this.selectedReportDepartmentIds],
      reportFcGroups: [...this.selectedSidebarMenuKeys],
      periodType: this.selectedPeriodType,
      previewYear: this.previewYear,
      previewMonth: this.previewMonth,
      useDueDate: this.selectedUseDueDate,
    });
    this.onClose();
  }
}
