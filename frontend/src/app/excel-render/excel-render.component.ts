import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ColDef, ColGroupDef, Column, GridApi, GridReadyEvent, ICellRendererParams, IRowNode, RowDragCallbackParams, ValueGetterParams } from 'ag-grid-community';
import { Observable, Subject, combineLatest, firstValueFrom, forkJoin, takeUntil } from 'rxjs';

import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { AppDialogService } from '../shared/dialog.service';
import {
  COLUMN_MIN_WIDTH,
  DEFAULT_CATALOG_COLUMN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
} from '../shared/utils/grid-column.constants';
import { CELL_STYLES, styleForFormulaError, cellFormatStyle, cellColSpan } from '../shared/utils/cell-styles.const';
import {
  FormatToolbarComponent,
  FormatTarget,
  type FormatChangeEvent,
} from '../shared/components/format-toolbar';

import { TuiDialogService } from '@taiga-ui/core';
import { TuiInputModule, TuiInputYearModule } from '@taiga-ui/kit';
import { SingleSelectComponent, SelectOption } from '../shared/components/multi-select';
import { DatePickerComponent } from '../shared/components/date-picker';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { AuthService } from '../auth/auth.service';
import { CatalogItem } from '../excel-builder/models/catalog.data';
import { DateCellRenderer, DropdownCellRenderer, FormulaCellRendererComponent, cellAddressOf } from '../excel-builder/renderers';
import { CatalogService } from '../catalog-manager/service/catalog.service';
import { CatalogTypeItem } from '../catalog-manager/models/catalog.model';
import { CellConfigDialogComponent, CellConfigInput, CellConfigResult } from '../excel-builder/dialogs/cell-config-dialog/cell-config-dialog.component';
import { DataLookupService } from '../excel-builder/service/data-lookup.service';
import { ExcelExportService, sanitizeFilename } from '../excel-builder/service/excel-export.service';
import { ImportFileDialogComponent } from '../shared/components/import-file-dialog/import-file-dialog.component';
import { FormulaTooltipComponent } from '../excel-builder/utils/formula-tooltip.component';
import { FormulaService } from '../excel-builder/service/formula.service';
import { FormulaGraphService } from '../excel-builder/service/formula-graph.service';
import { FormulaCoordinatorService } from '../excel-builder/service/formula-coordinator.service';
import { GridPermissionService } from '../excel-builder/service/grid-permission.service';
import { GridTemplateService } from '../excel-builder/service/grid-template.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { RenderActionComponent } from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import { ApprovalDialogComponent, ApprovalDialogData, ApprovalDialogResult } from '../workflow/approval-dialog/approval-dialog.component';
import { CreateEntryDialogComponent, CreateEntryDialogData, CreateEntryDialogResult } from './create-entry-dialog/create-entry-dialog.component';
import { EntryAttachmentsPanelComponent } from './entry-attachments-panel/entry-attachments-panel.component';
import { resolveHeaderName, stripHeaderPlaceholders } from '../excel-builder/utils/dynamic-header.util';
import { HistoryTimelineComponent } from '../workflow/history-timeline/history-timeline.component';
import { WorkflowHistoryItem, WorkflowTaskItem, WorkflowService } from '../workflow/workflow.service';
import {
  getStatusLabel as statusLabel,
  getStatusColor as statusColor,
  getStatusTextColor as statusTextColor,
} from '../workflow/workflow-status.util';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import { GridDataEntryListItem, GridTemplateListItem, PeriodType } from '../excel-builder/models/grid-template.model';
import { EntryRowsService } from './service/entry-rows.service';
import { findIncomingFormulaRefs } from './utils/find-incoming-formula-refs.util';
import { nextCustomRowCodes } from './utils/next-custom-row-code.util';
import {
  buildColumnDocsBody,
  buildColumnDocsText,
  extractReferencedTemplateCodes,
  type TargetTemplateInfo,
} from './utils/column-docs.util';
import { generateImportExportDoc } from './utils/import-export-doc.util';
import { SidebarMenuService } from '../shared/sidebar-menu.service';
import { GridPermission } from '../excel-builder/models/grid.permission.model';
import { TemplateButtonItem, TemplateButtonService, ButtonActionResult } from '../excel-builder/service/template-button.service';
import { RenderContextMenuComponent } from './components/render-context-menu/render-context-menu.component';
import {
  ValidationErrorPanelComponent,
  ValidationErrorEntry,
} from '../shared/components/validation-error-panel/validation-error-panel.component';
import { UndoRedoService } from '../excel-builder/service/undo-redo.service';
// parseTsv + applyPaste đã chuyển vào shared/grid-core/paste-handler.service.ts.
import {
  formatIsoDate as fmtIsoDate,
  formatCellValue as fmtCellValue,
  parseNumberInputForCell,
  cellPresetStyle as resolveCellPresetStyle,
  RENDER_ERROR_STYLE,
  getFormattedCellText as getFmtCellText,
  serializeRangeAsTsv as serializeTsv,
  createPasteHighlight,
  RangeSelectionService,
  validateCellValue,
  PasteHandlerService,
  FormatClipboardService,
  captureFormatRange,
  DEFAULT_DATA_GRID_COL_DEF,
  pushFormatUndoAction,
  clearActiveTooltip,
  cleanStaleColumnGroupFields,
  collectAllLeafFields,
  columnGroupContainsField,
  type PasteHighlightHandle,
  HALF_YEAR_TO_MONTH,
  HALF_YEAR_LABELS,
  MONTH_TO_HALF_YEAR,
  QUARTER_TO_MONTH,
  QUARTER_LABELS,
  MONTH_TO_QUARTER,
  MONTH_VALUES,
  formatMonthLabel,
  shouldShowPeriodInput,
} from '../shared/grid-core';

// --- Interfaces (local copies to avoid tight coupling) ---

interface CellValidation {
  required?: boolean;
  min?: number;
  max?: number;
  type?: 'number' | 'text' | 'date';
  minDate?: string;
  maxDate?: string;
  pattern?: string;
  errorMessage?: string;
}

interface ColumnConfig {
  headerName: string;
  field: string;
  excelCol?: string;
  formula?: string;
  width?: number;
  dataType?: 'number' | 'text' | 'date';
  validation?: CellValidation;
}

type ColumnGroupItem =
  | { type: 'field'; field: string }
  | { type: 'group'; groupId: string };

interface ColumnGroupConfig {
  groupId: string;
  headerName: string;
  columnFields: string[];
  children?: ColumnGroupConfig[];
  items?: ColumnGroupItem[];
  marryChildren?: boolean;
}

/** 1 thay đổi cell trong bulk import — đủ thông tin để apply lẫn revert. */
interface ImportValueChange {
  rowCode: string;
  field: string;
  value: any;
}

const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Convert ISO datetime từ server (vd `"2026-05-04T23:59:59.123"` hoặc `"2026-05-04T10:30:00"`)
 * sang dạng `<app-date-picker withTime>` chấp nhận: `yyyy-MM-ddTHH:mm:ss` (giây bắt buộc,
 * bỏ phần ms/zone). Null → null.
 */
function normalizeDueDateForPicker(iso: string | null): string | null {
  if (!iso) return null;
  // Cắt 19 ký tự đầu = "yyyy-MM-ddTHH:mm:ss"
  return iso.length >= 19 ? iso.slice(0, 19) : iso;
}

/** Đồng bộ items với columnFields + children, derive thứ tự cho data cũ. */
function reconcileColumnGroupItems(group: ColumnGroupConfig): void {
  const existing = group.items ?? [];
  const validFieldSet = new Set(group.columnFields ?? []);
  const validGroupSet = new Set((group.children ?? []).map((c) => c.groupId));
  const reconciled: ColumnGroupItem[] = [];
  const seenFields = new Set<string>();
  const seenGroups = new Set<string>();
  for (const it of existing) {
    if (it.type === 'field' && validFieldSet.has(it.field) && !seenFields.has(it.field)) {
      reconciled.push(it);
      seenFields.add(it.field);
    } else if (it.type === 'group' && validGroupSet.has(it.groupId) && !seenGroups.has(it.groupId)) {
      reconciled.push(it);
      seenGroups.add(it.groupId);
    }
  }
  for (const f of group.columnFields ?? []) {
    if (!seenFields.has(f)) reconciled.push({ type: 'field', field: f });
  }
  for (const c of group.children ?? []) {
    if (!seenGroups.has(c.groupId)) reconciled.push({ type: 'group', groupId: c.groupId });
  }
  group.items = reconciled;
  (group.children ?? []).forEach(reconcileColumnGroupItems);
}


// --- Main Component ---

@Component({
  selector: 'app-excel-render',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    TuiSvgModule,
    TuiInputModule,
    TuiInputYearModule,
    SingleSelectComponent,
    DatePickerComponent,
    HistoryTimelineComponent,
    AgGridWrapperComponent,
    PageHeaderComponent,
    GridHeaderComponent,
    EntryAttachmentsPanelComponent,
    FormatToolbarComponent,
    RenderContextMenuComponent,
    ValidationErrorPanelComponent,
    ImportFileDialogComponent,
    CellConfigDialogComponent,
  ],
  providers: [UndoRedoService, RangeSelectionService, PasteHandlerService, EntryRowsService],
  templateUrl: './excel-render.component.html',
  styleUrls: ['./excel-render.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ExcelRenderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  gridApi!: GridApi;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private formulaService = inject(FormulaService);
  private dataLookupService = inject(DataLookupService);
  private formulaCoordinator = inject(FormulaCoordinatorService);
  private catalogService = inject(CatalogService);
  private gridTemplateService = inject(GridTemplateService);
  private gridPermissionService = inject(GridPermissionService);
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(AppDialogService);
  private undoRedoService = inject(UndoRedoService);
  private excelExportService = inject(ExcelExportService);
  public title = '';
  public showBtnCreateNew: boolean = true;
  public btnLabelCreateNew: string = 'Thêm mới';
  public onButtonClickCreateNew: () => void = () => {
    this.promptCreateEntry();
  };
  reportType: string | null = null;
  private reportFcGroupNames = new Map<string, string>();

  // View mode
  viewMode: 'list' | 'entry' = 'list';

  // Report mode search
  allReportTemplates: GridTemplateListItem[] = [];
  reportTemplatesLoaded = false;
  reportDepartmentOptions: CatalogItem[] = [];
  selectedReportTemplate: GridTemplateListItem | null = null;
  selectedReportDepartment: CatalogItem | null = null;
  selectedReportYear: number | null = null;
  /**
   * Giá trị kỳ báo cáo NSD chọn — luôn map về cột `month` trong DB theo convention
   * của `PeriodType` (xem backend `PeriodType.java`):
   *   YEAR      → null (input bị ẩn)
   *   HALF_YEAR → 6 (H1) | 12 (H2)
   *   QUARTER   → 3 | 6 | 9 | 12 (Q1..Q4)
   *   MONTH     → 1..12
   */
  selectedReportPeriod: number | null = null;
  selectedReportStatus: string | null = 'ALL';
  readonly reportStatusOptions = [
    'ALL',
    'DRAFT',
    // 'SUBMITTED',
    // 'BKH_REVIEWED',
    // 'TXD_AUDITED',
    // 'TGD_APPROVED',
    // 'HDTV_APPROVED',
    // 'RETURNED',
    // 'APPROVED',
    // 'REJECTED',
  ];

  /** Options cho 4 single-select trong report search bar — recompute khi data thay đổi. */
  templateSelectOptions: SelectOption<GridTemplateListItem>[] = [];
  departmentSelectOptions: SelectOption<CatalogItem>[] = [];
  /**
   * Options cho input "kỳ báo cáo" — switch theo `currentReportPeriodType`.
   * Field-stored (KHÔNG getter trả array) để tránh tạo array mới mỗi CD cycle.
   */
  periodSelectOptions: SelectOption<number>[] = [];
  statusSelectOptions: SelectOption<string>[] = [];

  // Entry list
  entryList: GridDataEntryListItem[] = [];
  loadingEntries = false;
  /**
   * ColumnDefs cho danh sách phiên — populate qua `recomputeEntryColumnDefs()` mỗi
   * khi periodType đổi (template chọn / loadTemplateConfig). Field-stored để tránh
   * tạo array mới mỗi CD cycle.
   */
  entryColumnDefs: ColDef[] = [];

  // Data entry grid
  gridColDefs: (ColDef | ColGroupDef)[] = [];
  rowData: any[] = [];

  /** Default colDef từ shared — xem `DEFAULT_DATA_GRID_COL_DEF`. */
  readonly gridDefaultColDef = DEFAULT_DATA_GRID_COL_DEF;

  /**
   * Formula engine: dependency graph + topological sort + shadow store.
   * Xem `formula-graph.service.ts`. valueGetter chỉ đọc shadow O(1).
   * Phải gọi `rebuildFormulaGraph()` sau load template/entry, custom row add/delete,
   * cell config save, hoặc bất kỳ thay đổi nào ảnh hưởng topology.
   *
   * Defensive 1: grid được conditional render `@if (!loading)` → `gridApi` chưa
   * tồn tại khi load flow gọi rebuild lần đầu (subscribe callback chạy đồng bộ
   * trước khi Angular render grid + fire `gridReady`). Track pending flag, run
   * lại trong `onGridReady` khi gridApi available.
   *
   * Defensive 2: explicit `setGridOption('columnDefs', ...)` để AG Grid có
   * columnDefs mới NGAY (bypass Angular Input binding propagation).
   */
  private formulaGraph = inject(FormulaGraphService);
  private pendingFormulaRebuild = false;

  private rebuildFormulaGraph(): void {
    // Pending flag GIỮ ở component — service trả false khi grid chưa ready, component
    // tự mark pending để `onGridReady` flush. Pattern đồng bộ với Builder.
    const ok = this.formulaCoordinator.rebuild({
      gridApi: this.gridApi,
      gridColDefs: this.gridColDefs,
      colMap: this.colMap,
      columnConfigs: this.columnConfigs,
      rowData: this.rowData,
    });
    this.pendingFormulaRebuild = !ok;
  }
  /**
   * Snapshot original `_cellConfig` per rowCode + helpers (isCustomRow,
   * validateRowOrder, isCellFormulaModified) — xem [EntryRowsService](./service/entry-rows.service.ts).
   */
  private readonly entryRowsSvc = inject(EntryRowsService);
  private readonly http = inject(HttpClient);
  private readonly sidebarMenuService = inject(SidebarMenuService);

  /**
   * Chế độ "Chỉnh sửa bảng" — khi OFF, user chỉ xem grid như bình thường.
   * Khi ON (+ entry editable): right-click row để thêm/xóa, kéo thả để sắp xếp,
   * cell hiện 2 icon (copy + gear) cho phép edit formula. Không ảnh hưởng edit
   * cell inline (vẫn dùng status + permissions).
   */
  isEditMode = false;

  /** State của context menu (null = đóng). Tọa độ tính theo viewport (fixed). */
  contextMenu: {
    x: number;
    y: number;
    row: any;
    showAdd: boolean;
    showDelete: boolean;
    showResetCellConfig: boolean;
  } | null = null;

  // === Cell config dialog state (port từ Builder) ===
  editingCell: { rowNode: IRowNode; field: string } | null = null;
  isCellConfigDialogOpen = false;
  cellConfigInput: CellConfigInput | null = null;
  formulaValidation: { valid: boolean; error?: string; references?: string[] } | null = null;
  cellDropdownItems: CatalogItem[] = [];
  cellDropdownLoading = false;
  catalogTypes: CatalogTypeItem[] = [];
  colMap: { [key: string]: string } = {};
  gridHeight = '600px';

  // Template config
  columnConfigs: ColumnConfig[] = [];
  columnGroups: ColumnGroupConfig[] = [];
  templateId: number | null = null;
  templateCode = '';
  templatePeriodType: 'YEAR' | 'HALF_YEAR' | 'QUARTER' | 'MONTH' = 'MONTH';
  /** Template có bật tính năng "Hạn xử lý" không — gate cho input dialog + badge entry view. */
  templateUseDueDate = false;
  entryId: number | null = null;
  templateName = '';
  currentEntryName = '';

  // Entry period metadata (for GETDATA)
  entryYear: number = new Date().getFullYear();
  entryMonth: number | null = null;
  entryOrgCode: string | null = null;
  /** ISO datetime string từ server. Null = entry chưa có due_date. */
  entryDueDate: string | null = null;
  /** Value bind 1-way với <app-date-picker> ở entry view — display-only, hạn do cấp trên giao. */
  dueDateInputValue: string | null = null;

  /** Dialog import Excel — bind two-way với <app-import-file-dialog>. */
  isImportDialogOpen = false;
  isDownloadingImportTemplate = false;

  // State
  loading = false;
  saving = false;
  creatingEntry = false;
  deletingEntryId: number | null = null;
  validationErrors: ValidationErrorEntry[] = [];
  validationPanelExpanded = false;
  /**
   * Pending flag: khi `finishLoad` chạy mà `gridApi` đã destroyed (loading transition
   * đang re-create ag-grid), forEachNode iterate 0 rows → recalc trả empty list sai.
   * Set flag → flush trong `onGridReady` lần kế tiếp (Angular `[rowData]` đã propagate).
   * Pattern đồng bộ với `pendingFormulaRebuild` — KHÔNG dùng setTimeout race.
   */
  private pendingValidationRecalc = false;
  /** Backward compat: badge cũ refer `validationErrorCount`. */
  get validationErrorCount(): number {
    return this.validationErrors.length;
  }

  // Permissions
  permissions: GridPermission[] = [];
  private readonly authService = inject(AuthService);
  private readonly workflowService = inject(WorkflowService);
  private readonly tuiDialogService = inject(TuiDialogService);
  get currentUserId(): string {
    return this.authService.currentUser?.username || '';
  }

  // Workflow
  entryStatus = 'DRAFT';
  hasWorkflow = false;
  /** User hiện tại có quyền gửi duyệt không (kiểm tra từ WORKFLOW_SUBMITTER_CANDIDATE) */
  canSubmitEntry = false;
  /** Task Camunda đang chờ user hiện tại xử lý cho entry này (null = không có) */
  pendingTask: WorkflowTaskItem | null = null;
  approvalHistory: WorkflowHistoryItem[] = [];
  showHistory = false;
  submitting = false;

  // Attachments panel — state quản lý ở parent vì nút toggle và panel
  // không nằm chung template scope (mỗi cái có *ngIf riêng).
  attachmentsCollapsed = true;
  attachmentsFilesCount = 0;
  @ViewChild(EntryAttachmentsPanelComponent) attachmentsPanelRef?: EntryAttachmentsPanelComponent;
  toggleAttachments(): void {
    this.attachmentsCollapsed = !this.attachmentsCollapsed;
  }
  /** Nút "Đính kèm file" ở action bar — mở trực tiếp file picker của panel. */
  openUploadAttachment(): void {
    this.attachmentsPanelRef?.triggerPicker();
  }

  // Template buttons (from TEMPLATE_BUTTON table)
  templateButtons: TemplateButtonItem[] = [];
  private readonly templateButtonService = inject(TemplateButtonService);

  // Cache
  dropdownItemsCache = new Map<string, string[]>();

  // Constants
  private readonly ROW_HEIGHT = 36;
  private readonly HEADER_HEIGHT = 48;
  private readonly MIN_HEIGHT = 300;
  private readonly SCROLLBAR_HEIGHT = 17;

  // Track whether template config is already loaded (avoid re-fetch when switching views)
  private templateLoaded = false;

  get isReportMode(): boolean {
    return !!this.reportType;
  }

  get filteredReportTemplates(): GridTemplateListItem[] {
    return this.allReportTemplates.filter((template) => {
      const matchType = this.reportType
        ? (template.reportFcGroups ?? []).includes(this.reportType)
        : true;
      const matchDepartment = this.selectedReportDepartment
        ? (template.reportDepartments ?? []).includes(this.selectedReportDepartment.id)
        : true;

      return matchType && matchDepartment;
    });
  }

  get displayHeaderTitle(): string {
    if (this.isReportMode && this.viewMode === 'list') {
      const typeName = (this.reportType && this.reportFcGroupNames.get(this.reportType)) || this.reportType;
      return this.selectedReportTemplate?.name || `Báo cáo ${typeName}`;
    }

    return this.headerTitle;
  }

  get displayBreadcrumbs(): PageHeaderBreadcrumb[] {
    if (this.isReportMode) {
      return [
        { label: 'Trang chủ', link: '' },
        { label: 'Báo cáo', link: '' },
        { label: (this.reportType && this.reportFcGroupNames.get(this.reportType)) || this.reportType || 'Danh sách báo cáo', link: '' },
      ];
    }

    return this.breadcrumbs;
  }

  /** Rebuild template options khi `allReportTemplates` hoặc `reportType`/`selectedReportDepartment` đổi. */
  private recomputeTemplateOptions(): void {
    this.templateSelectOptions = this.filteredReportTemplates.map(t => ({
      value: t,
      label: `${t.code} - ${t.name}`,
      searchText: `${t.code} ${t.name}`,
    }));
  }

  /** Rebuild department options 1 lần sau khi catalog load. */
  private recomputeDepartmentOptions(): void {
    this.departmentSelectOptions = this.reportDepartmentOptions.map(d => ({
      value: d,
      label: d.name,
      searchText: `${d.id} ${d.name}`,
    }));
  }

  /** Build status options 1 lần. 'ALL' nằm trong list (không dùng clearable). */
  private recomputeStatusOptions(): void {
    this.statusSelectOptions = this.reportStatusOptions.map(s => ({
      value: s,
      label: s === 'ALL' ? 'Tất cả trạng thái' : this.getStatusLabel(s),
    }));
  }

  /** Kỳ báo cáo của template đang chọn — fallback MONTH khi chưa chọn. */
  get currentReportPeriodType(): PeriodType {
    return this.selectedReportTemplate?.periodType ?? 'MONTH';
  }

  /** Ẩn input kỳ khi template báo cáo theo năm (không cần chọn tháng/quý). */
  get showReportPeriodInput(): boolean {
    return shouldShowPeriodInput(this.currentReportPeriodType);
  }

  get reportPeriodLabel(): string {
    switch (this.currentReportPeriodType) {
      case 'HALF_YEAR': return 'Kỳ 6 tháng';
      case 'QUARTER':   return 'Quý';
      case 'MONTH':
      default:          return 'Tháng kế hoạch';
    }
  }

  get reportPeriodPlaceholder(): string {
    switch (this.currentReportPeriodType) {
      case 'HALF_YEAR': return 'Chọn kỳ 6 tháng';
      case 'QUARTER':   return 'Chọn quý';
      case 'MONTH':
      default:          return 'Chọn tháng kế hoạch';
    }
  }

  get reportPeriodClearLabel(): string {
    switch (this.currentReportPeriodType) {
      case 'HALF_YEAR': return 'Tất cả kỳ 6 tháng';
      case 'QUARTER':   return 'Tất cả quý';
      case 'MONTH':
      default:          return 'Tất cả tháng';
    }
  }

  /**
   * Rebuild options cho input "kỳ báo cáo" theo `currentReportPeriodType`.
   * Gọi mỗi khi `selectedReportTemplate` đổi (URL load, user chọn dropdown, reset).
   * Convention value = giá trị lưu cột `month` (xem doc của `selectedReportPeriod`).
   */
  private recomputePeriodOptions(): void {
    switch (this.currentReportPeriodType) {
      case 'YEAR':
        this.periodSelectOptions = [];
        break;
      case 'HALF_YEAR':
        this.periodSelectOptions = ([1, 2] as const).map(o => ({
          value: HALF_YEAR_TO_MONTH[o],
          label: HALF_YEAR_LABELS[o],
        }));
        break;
      case 'QUARTER':
        this.periodSelectOptions = ([1, 2, 3, 4] as const).map(o => ({
          value: QUARTER_TO_MONTH[o],
          label: QUARTER_LABELS[o],
        }));
        break;
      case 'MONTH':
      default:
        this.periodSelectOptions = MONTH_VALUES.map(m => ({
          value: m,
          label: formatMonthLabel(m),
        }));
        break;
    }
  }

  /**
   * Kỳ hiệu lực để build columnDefs danh sách phiên:
   *  - Report mode: ưu tiên `selectedReportTemplate.periodType` (có sẵn ngay từ list API,
   *    KHÔNG phải đợi load detail → grid update đồng bộ với filter bar khi đổi template)
   *  - Direct mode: fallback `templatePeriodType` (load qua loadTemplateConfig)
   */
  private get effectiveListPeriodType(): PeriodType {
    return this.selectedReportTemplate?.periodType ?? this.templatePeriodType;
  }

  private getPeriodColumnHeader(p: PeriodType): string {
    switch (p) {
      case 'HALF_YEAR': return 'Kỳ 6 tháng';
      case 'QUARTER':   return 'Quý';
      case 'MONTH':
      default:          return 'Tháng';
    }
  }

  /** Format value cột kỳ theo periodType. month=null → '—' (defensive, normally hidden). */
  private formatPeriodCellValue(month: number | null | undefined, p: PeriodType): string {
    if (month == null) return '—';
    switch (p) {
      case 'HALF_YEAR': {
        const ord = MONTH_TO_HALF_YEAR[month];
        return ord != null ? HALF_YEAR_LABELS[ord] : `T${month}`;
      }
      case 'QUARTER': {
        const ord = MONTH_TO_QUARTER[month];
        return ord != null ? QUARTER_LABELS[ord] : `T${month}`;
      }
      case 'MONTH':
      default:
        return formatMonthLabel(month);
    }
  }

  /**
   * Rebuild columnDefs cho lưới danh sách phiên theo periodType hiện tại.
   * Gọi mỗi khi `selectedReportTemplate` hoặc `templatePeriodType` đổi.
   */
  private recomputeEntryColumnDefs(): void {
    const periodType = this.effectiveListPeriodType;
    this.entryColumnDefs = [
      {
        colId: 'select',
        headerName: '',
        width: 48,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        checkboxSelection: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: true,
        lockPosition: 'left',
      },
      {
        headerName: 'STT',
        colId: 'stt',
        width: 64,
        pinned: 'left',
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: 'left',
        valueGetter: (params: ValueGetterParams) => {
          const idx = params.node?.rowIndex;
          if (idx == null) return '';
          const api = params.api;
          if (api.getGridOption('pagination') === true) {
            return (
              api.paginationGetCurrentPage() * api.paginationGetPageSize() +
              idx + 1
            );
          }
          return idx + 1;
        },
        cellStyle: { textAlign: 'center' },
      },
      {
        headerName: 'Đơn vị',
        field: 'orgCode',
        flex: 0.8,
        minWidth: 100,
        sortable: true,
        filter: true,
        valueFormatter: (p: any) => p.value || 'TCT',
      },
      {
        headerName: 'Năm',
        field: 'year',
        flex: 0.6,
        minWidth: 80,
        sortable: true,
        filter: true,
      },
      {
        headerName: this.getPeriodColumnHeader(periodType),
        field: 'month',
        hide: periodType === 'YEAR',
        flex: 0.8,
        minWidth: 110,
        sortable: true,
        filter: true,
        valueFormatter: (p: any) => this.formatPeriodCellValue(p.value, periodType),
      },
      {
        headerName: 'Trạng thái',
        field: 'status',
        flex: 1.2,
        minWidth: 130,
        sortable: true,
        filter: true,
        cellRenderer: (params: ICellRendererParams) => {
          const v = params.value || 'DRAFT';
          const bg = this.getStatusColor(v);
          const color = this.getStatusTextColor(v);
          const label = this.getStatusLabel(v);
          return `<span style="background:${bg};color:${color};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:500;">${label}</span>`;
        },
      },
      {
        headerName: 'Người tạo',
        field: 'createdBy',
        flex: 1,
        minWidth: 120,
        sortable: true,
      },
      {
        headerName: 'Ngày tạo',
        field: 'createdAt',
        flex: 1.3,
        minWidth: 150,
        sortable: true,
        valueFormatter: (p: any) =>
          p.value
            ? new Date(p.value).toLocaleDateString('vi-VN') +
              ' ' +
              new Date(p.value).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
      },
      {
        headerName: 'Thao tác',
        width: 120,
        pinned: 'right',
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: 'right',
        cellRenderer: RenderActionComponent,
        cellRendererParams: {
          onRender: (data: any) => {
            const entry = this.entryList.find((e) => e.id === data?.id);
            if (entry) this.openEntry(entry);
          },
          onDelete: (data: any) => {
            const entry = this.entryList.find((e) => e.id === data?.id);
            if (entry) this.deleteEntryFromList(entry);
          },
          isActionLoading: (id: number) => this.deletingEntryId === id,
          showEdit: false,
          showPublish: false,
        },
      },
    ];
  }

  /**
   * Tên biểu mẫu sau khi resolve placeholder ${N±x}.
   *  - Entry view: dùng `entryYear` để kết quả khớp dữ liệu đang xem.
   *  - List view (chưa chọn entry): fallback năm hiện tại.
   */
  get resolvedTemplateName(): string {
    const year =
      this.viewMode === 'entry' && this.entryYear != null
        ? this.entryYear
        : new Date().getFullYear();
    const month =
      this.viewMode === 'entry' && this.entryMonth != null
        ? this.entryMonth
        : new Date().getMonth() + 1;
    return resolveHeaderName(this.templateName, year, month);
  }

  get headerTitle(): string {
    return this.resolvedTemplateName || 'Nhập liệu';
  }

  get breadcrumbs(): PageHeaderBreadcrumb[] {
    return [
      { label: 'Trang chủ', link: '' },
      { label: 'Quản lý biểu mẫu', link: '' },
      { label: this.resolvedTemplateName || 'Nhập liệu', link: '' },
    ];
  }

  get entryBreadcrumbs(): PageHeaderBreadcrumb[] {
    const resolvedName = this.resolvedTemplateName;
    const entryLabel = this.currentEntryName || resolvedName || 'Nhập liệu';
    if (this.isReportMode) {
      const reportTypeName =
        (this.reportType && this.reportFcGroupNames.get(this.reportType)) ||
        this.reportType ||
        'Danh sách báo cáo';
      const reportTypePath = this.reportType ? `/report/${this.reportType}` : '';
      const items: PageHeaderBreadcrumb[] = [
        { label: 'Trang chủ', link: '' },
        { label: 'Báo cáo', link: '' },
        { label: reportTypeName, link: reportTypePath },
      ];
      if (resolvedName) {
        items.push({ label: resolvedName, link: '' });
      }
      items.push({ label: entryLabel, link: '' });
      return items;
    }
    return [
      { label: 'Trang chủ', link: '' },
      { label: 'Quản lý biểu mẫu', link: '' },
      { label: resolvedName || 'Nhập liệu', link: '' },
      { label: entryLabel, link: '' },
    ];
  }

  ngOnInit(): void {
    // Populate columnDefs danh sách phiên với default periodType (MONTH).
    // Sau khi template/selectedReportTemplate load xong sẽ rebuild theo periodType thực tế.
    this.recomputeEntryColumnDefs();

    // Load cached map menuKey → label từ SIDEBAR_MENU (dùng cho breadcrumb "Nhóm chức năng báo cáo") — chỉ gọi API 1 lần
    this.catalogService.getReportFcGroupMap()
      .pipe(takeUntil(this.destroy$))
      .subscribe(m => this.reportFcGroupNames = m);

    // Load catalog types cho Cell Config Dialog (tab Dropdown). Chỉ load 1 lần khi
    // mount; user vào edit-table mode bất kỳ lúc nào cũng có sẵn options.
    this.catalogService.getCatalogTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe((types) => { this.catalogTypes = types; });

    combineLatest([this.route.paramMap, this.route.queryParams])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([paramMap, params]) => {
        const nextReportType = paramMap.get('type');
        const reportTypeChanged = nextReportType !== this.reportType;

        if (reportTypeChanged) {
          this.resetReportSearchState();
        }

        this.reportType = nextReportType;
        if (reportTypeChanged && this.reportTemplatesLoaded) {
          this.recomputeTemplateOptions();
        }
        const tid = params['templateId'];
        const eid = params['entryId'];
        const newTemplateId = tid ? +tid : null;
        const newEntryId = eid ? +eid : null;

        if (newTemplateId !== this.templateId) {
            // templateId thay đổi (sidebar navigate) → reset để load lại config mới
          this.templateLoaded = false;
          this.templateName = '';
          this.title = '';
          this.currentEntryName = '';
          }

        // Reset state per-entry khi chuyển sang entry khác (hoặc thoát entry view).
        // `isEditMode`, context menu, attachments panel, range selection đều là
        // state cục bộ của từng entry — nếu không reset thì chuyển page vẫn giữ
        // trạng thái cũ.
        if (newEntryId !== this.entryId) {
          this.isEditMode = false;
          this.contextMenu = null;
          this.attachmentsCollapsed = true;
          this.attachmentsFilesCount = 0;
          this.clearRangeSelection();
        }

        this.templateId = newTemplateId;
        this.entryId = newEntryId;

        if (this.isReportMode) {
          if (!this.reportTemplatesLoaded) {
            this.loadReportModeData();
            return;
          }

          if (this.syncReportTemplateSelection()) {
            return;
          }
        }

        if (!this.templateId) {
          this.viewMode = 'list';
          this.entryList = [];
          this.loadingEntries = false;
          return;
        }

        if (this.entryId) {
          this.viewMode = 'entry';
          this.loadTemplateAndEntry(this.templateId, this.entryId);
          this.loadTemplateButtons(this.templateId);
        } else {
          this.viewMode = 'list';
          this.loadTemplateConfig(this.templateId);
          this.loadEntries();
        }
      });
  }

  // ===== Workflow Methods =====

  /** Task hiện tại là revision (bị trả lại để sửa) hay approval (duyệt) */
  get isRevisionTask(): boolean {
    return !!this.pendingTask?.taskDefinitionKey?.startsWith('revision_from_');
  }

  /** Gửi lại sau khi bị trả lại (complete revision task với action RESUBMIT) */
  resubmitEntry(): void {
    if (!this.pendingTask) return;
    this.dialog.confirm({
      title: 'Gửi lại phê duyệt',
      message: 'Bạn đã sửa xong và muốn gửi lại để phê duyệt?',
      confirmText: 'Gửi lại',
      cancelText: 'Hủy',
    }).subscribe((confirmed) => {
      if (!confirmed || !this.pendingTask) return;
      this.workflowService
        .completeTask(this.pendingTask.taskId, 'RESUBMIT', '')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.dialog.success('Đã gửi lại thành công');
            if (res?.redirectUrl) {
              this.router.navigateByUrl(res.redirectUrl);
            } else {
              this.refreshAfterWorkflowAction();
            }
          },
          error: (err: any) => this.dialog.error(err.error?.message || 'Không thể gửi lại'),
        });
    });
  }

  submitForApproval(): void {
    if (!this.templateId || !this.entryId) return;
    this.dialog
      .confirm({
        title: 'Gửi phê duyệt',
        message: 'Bạn có chắc chắn muốn gửi phiên nhập liệu này để phê duyệt?',
        confirmText: 'Gửi',
        cancelText: 'Hủy',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.submitting = true;
          this.workflowService
            .submitEntry(this.templateId!, this.entryId!)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.submitting = false;
                this.dialog.success('Đã gửi phê duyệt thành công');
                // Reload entry để cập nhật status + pending task
                this.refreshAfterWorkflowAction();
              },
              error: (error: any) => {
                this.submitting = false;
                this.dialog.error(error.error?.message || 'Không thể gửi phê duyệt');
              },
            });
        }
      });
  }

  openApprovalAction(): void {
    if (!this.templateId || !this.entryId || !this.pendingTask) return;
    const taskId = this.pendingTask.taskId;
    const taskName = this.pendingTask.taskName || this.currentEntryName;

    this.tuiDialogService
      .open<ApprovalDialogResult | null>(
        new PolymorpheusComponent(ApprovalDialogComponent),
        {
          data: { taskName, entryId: this.entryId } as ApprovalDialogData,
          dismissible: true,
          size: 's',
          label: '',
        },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        this.workflowService
          .completeTask(taskId, result.action, result.comment)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.dialog.success('Đã xử lý thành công');
              if (res?.redirectUrl) {
                this.router.navigateByUrl(res.redirectUrl);
              } else {
                this.refreshAfterWorkflowAction();
              }
            },
            error: (error: any) => this.dialog.error(error.error?.message || 'Không thể xử lý'),
          });
      });
  }

  toggleHistory(): void {
    this.showHistory = !this.showHistory;
  }

  /** Reload entry status + pending task + history sau mỗi workflow action (submit/approve/resubmit) */
  private refreshAfterWorkflowAction(): void {
    if (!this.templateId || !this.entryId) return;
    // Reload entry để lấy status mới từ DB
    this.gridTemplateService.getEntry(this.templateId, this.entryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entry) => {
          this.entryStatus = entry.status || 'DRAFT';
          // Sau khi có status mới → load pending task
          this.loadPendingTask();
        },
        error: () => {
          this.loadPendingTask();
        },
      });
    this.loadApprovalHistory(this.templateId, this.entryId);
  }

  /** Kiểm tra user hiện tại có task Camunda đang chờ cho entry này không */
  private loadPendingTask(): void {
    if (!this.hasWorkflow || !this.entryId) {
      this.pendingTask = null;
      return;
    }
    // Chỉ check khi đã hoàn thành hoặc bị từ chối → không có task
    const s = this.entryStatus;
    if (s === 'DRAFT' || s === 'APPROVED' || s === 'REJECTED') {
      this.pendingTask = null;
      return;
    }
    this.workflowService.getMyTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.pendingTask = tasks.find(t => t.entryId === this.entryId) ?? null;
        },
        error: () => { this.pendingTask = null; },
      });
  }

  private loadApprovalHistory(templateId: number, entryId: number): void {
    this.workflowService
      .getEntryHistory(templateId, entryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => (this.approvalHistory = history),
        error: (error: any) => {
          this.approvalHistory = [];
          this.dialog.error(error.error?.message || 'Không thể tải lịch sử phê duyệt');
        },
      });
  }

  getStatusLabel(status: string): string {
    return statusLabel(status);
  }

  getStatusColor(status: string): string {
    return statusColor(status);
  }

  getStatusTextColor(status: string): string {
    return statusTextColor(status);
  }

  ngOnDestroy(): void {
    this.formulaService.setEntryContext(null);
    this.clearPasteHighlight();
    this.rangeSelectionSvc.detach();
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(params: GridReadyEvent): void {
    this.gridApi = params.api;
    this.formulaService.setGridApi(params.api);
    // Nếu load flow đã gọi rebuildFormulaGraph trước khi grid ready (grid render
    // sau loading=false → onGridReady fire sau finishLoad), giờ chạy lại với
    // gridApi sẵn sàng → build DAG + recompute shadow store.
    if (this.pendingFormulaRebuild) {
      // RACE FIX: Angular Input binding `[rowData]`/`[columnDefs]` có thể chưa
      // propagate khi gridReady fire (race với async ag-grid init + microtask CD).
      // Defensive: explicit setGridOption sync data vào grid TRƯỚC `forEachNode`
      // được dùng trong `formulaGraph.recomputeAll`. Tránh `#NOROW!` cho mọi cell.
      // Chạy 1 lần ở pending flush nên không gây flicker.
      if (this.gridColDefs.length > 0) {
        this.gridApi.setGridOption('columnDefs', this.gridColDefs);
      }
      if (this.rowData.length > 0) {
        this.gridApi.setGridOption('rowData', [...this.rowData]);
      }
      this.rebuildFormulaGraph();
    }
    // Flush pending validation recalc (deferred từ finishLoad khi gridApi destroyed).
    if (this.pendingValidationRecalc) {
      this.pendingValidationRecalc = false;
      this.recalcValidationErrors();
    }
    // Flush pending auto-sync (deferred từ finishLoad khi gridApi chưa ready).
    this.tryAutoSyncFormulas();
    // AG Grid event `cellContextMenu` — reliable hơn DOM traversal,
    // đảm bảo nhận đúng event right-click bất kể nested DOM của cell editor.
    this.gridApi.addEventListener('cellContextMenu', (e: any) => this.handleCellContextMenu(e));

    // Range selection (Excel-style): drag chuột trái hoặc Shift+Click để chọn nhiều ô.
    this.rangeSelectionSvc.attach({
      gridApi: this.gridApi,
      styleId: 'range-selection-highlight-style',
      onChange: () => this.cdr.detectChanges(),
    });
    this.gridApi.addEventListener('cellMouseDown', (e: any) => this.rangeSelectionSvc.onCellMouseDown(e));
    this.gridApi.addEventListener('cellMouseOver', (e: any) => this.rangeSelectionSvc.onCellMouseOver(e));

    // Paste handler: Render gate `canEditRows` + cell-level permission, không sync local rowData.
    this.pasteHandler.attach({
      gridApi: this.gridApi,
      dialog: this.dialog,
      catalogService: this.catalogService,
      destroy$: this.destroy$,
      undoRedoService: this.undoRedoService,
      pasteHighlight: this.pasteHighlight,
      dropdownItemsCache: this.dropdownItemsCache,
      getColumnConfigs: () => this.columnConfigs,
      canPaste: () => this.canEditRows,
      canEditCell: (field, rowCode) => this.canEdit(field, rowCode),
      validateCell: (f, v, rd) => this.validateCell(f, v, rd),
      recalcValidationErrors: () => this.recalcValidationErrors(),
      getRangeBounds: () => this.rangeSelectionSvc.bounds(),
    });

    // Toolbar Format: cập nhật nút active khi user đổi cell focus.
    this.gridApi.addEventListener('cellFocused', () => this.cdr.detectChanges());

    // Shortcut Ctrl+B / Ctrl+I — gate cả permission lẫn toolbar đang hiện
    // (đóng toolbar = ý đồ user không muốn format → shortcut cũng tắt).
    this.gridApi.addEventListener('cellKeyDown', (e: any) => {
      if (!this.canEditRows || this.formatBarCollapsed) return;
      const ev: KeyboardEvent | undefined = e?.event;
      if (!ev || !(ev.ctrlKey || ev.metaKey)) return;
      const k = ev.key.toLowerCase();
      if (k === 'b') {
        ev.preventDefault();
        this.formatToolbar?.toggleBoolean('bold');
      } else if (k === 'i') {
        ev.preventDefault();
        this.formatToolbar?.toggleBoolean('italic');
      }
    });
  }

  // ============================
  // LIST VIEW
  // ============================

  private resetReportSearchState(): void {
    this.selectedReportTemplate = null;
    this.selectedReportDepartment = null;
    this.selectedReportYear = null;
    this.selectedReportPeriod = null;
    this.selectedReportStatus = 'ALL';
    this.entryList = [];
    this.loadingEntries = false;
    this.recomputePeriodOptions();
    this.recomputeEntryColumnDefs();
  }

  private loadReportModeData(): void {
    this.reportTemplatesLoaded = false;
    forkJoin({
      departments: this.catalogService.getCatalogs('REPORT_DEPARTMENT'),
      templates: this.gridTemplateService.getTemplates(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ departments, templates }) => {
          this.reportDepartmentOptions = departments;
          this.allReportTemplates = templates;
          this.reportTemplatesLoaded = true;
          this.recomputeDepartmentOptions();
          this.recomputeTemplateOptions();
          this.recomputeStatusOptions();
          this.recomputePeriodOptions();
          this.recomputeEntryColumnDefs();
          if (this.syncReportTemplateSelection()) {
            return;
          }
          // Continue loading template/entry from URL query params
          if (this.templateId) {
            if (this.entryId) {
              this.viewMode = 'entry';
              this.loadTemplateAndEntry(this.templateId, this.entryId);
              this.loadTemplateButtons(this.templateId);
            } else {
              this.viewMode = 'list';
              this.loadTemplateConfig(this.templateId);
              this.loadEntries();
            }
          }
        },
        error: (err) => {
          this.reportDepartmentOptions = [];
          this.allReportTemplates = [];
          this.reportTemplatesLoaded = true;
          this.entryList = [];
          this.loadingEntries = false;
          this.dialog.error(
            'Lỗi tải danh mục báo cáo: ' +
              (err.error?.message || err.message),
          );
        },
      });
  }

  private syncReportTemplateSelection(): boolean {
    if (!this.isReportMode) {
      return false;
    }

    // Ưu tiên URL: nếu URL chỉ định templateId, tìm trong toàn bộ allReportTemplates
    // (không filter theo selectedReportDepartment) để KHÔNG strip entryId trong các flow
    // navigate trực tiếp như button action redirect (vd /report/X?templateId=Y&entryId=Z).
    // Trước đây dùng `filteredReportTemplates`, nhưng filter dept vẫn giữ giá trị từ
    // phiên trước khi reportType không đổi → có thể loại template đích → fallback
    // navigate strip entryId.
    if (this.templateId != null) {
      const matchedAnywhere =
        this.allReportTemplates.find(
          (template) => template.id === this.templateId,
        ) ?? null;
      if (matchedAnywhere) {
        this.selectedReportTemplate = matchedAnywhere;
        this.recomputePeriodOptions();
        this.recomputeEntryColumnDefs();
        return false;
      }
    }

    if (this.filteredReportTemplates.length === 0) {
      this.selectedReportTemplate = null;
      this.templateId = null;
      this.entryList = [];
      this.templateName = '';
      this.title = '';
      this.currentEntryName = '';

      if (this.route.snapshot.queryParamMap.has('templateId')) {
        this.router.navigate([], {
          queryParams: { templateId: null, entryId: null },
          queryParamsHandling: 'merge',
        });
        return true;
      }

      return false;
    }

    this.selectedReportTemplate = this.filteredReportTemplates[0];
    this.onReportTemplateChange(this.selectedReportTemplate);
    return true;
  }

  onReportTemplateChange(template: GridTemplateListItem | null): void {
    this.selectedReportTemplate = template;
    // Đổi template → kỳ báo cáo có thể đổi (year/half_year/quarter/month).
    // Reset trường kỳ + rebuild options. KHÔNG động vào năm/lĩnh vực/trạng thái
    // vì 3 trường này không phụ thuộc periodType.
    this.selectedReportPeriod = null;
    this.recomputePeriodOptions();
    this.recomputeEntryColumnDefs();
    const nextTemplateId = template?.id ?? null;

    if (this.templateId === nextTemplateId && !this.entryId) {
      if (this.templateId != null) {
        this.loadTemplateConfig(this.templateId);
        this.loadEntries();
      }
      return;
    }

    this.router.navigate([], {
      queryParams: { templateId: nextTemplateId, entryId: null },
      queryParamsHandling: 'merge',
    });
  }

  onReportDepartmentChange(): void {
    // Department đổi → templateSelectOptions phải lọc lại theo department mới
    this.recomputeTemplateOptions();
    const currentTemplateId = this.templateId;
    const redirected = this.syncReportTemplateSelection();

    if (!redirected && currentTemplateId != null && this.templateId === currentTemplateId) {
      this.loadEntries();
    }
  }

  onReportEntryFiltersChange(): void {
    if (this.viewMode === 'list' && this.templateId != null) {
      this.loadEntries();
    }
  }

  /**
   * Reset toàn bộ bộ lọc tìm kiếm (template + dept + year + month + status) về mặc định
   * và tìm kiếm lại. Strip `templateId`/`entryId` khỏi URL → ngOnInit subscribe sẽ chạy
   * `syncReportTemplateSelection` để pick template đầu tiên + reload entries với filter
   * trống. Nếu URL đã không còn templateId, gọi tay vì navigate sẽ no-op.
   */
  clearReportFilters(): void {
    this.resetReportSearchState();
    this.recomputeTemplateOptions();
    const hadTemplate = this.route.snapshot.queryParamMap.has('templateId') ||
      this.route.snapshot.queryParamMap.has('entryId');
    if (hadTemplate) {
      this.router.navigate([], {
        queryParams: { templateId: null, entryId: null },
        queryParamsHandling: 'merge',
      });
    } else {
      this.syncReportTemplateSelection();
    }
  }

  private loadEntries(): void {
    if (!this.templateId) {
      this.entryList = [];
      this.loadingEntries = false;
      return;
    }
    this.loadingEntries = true;
    this.gridTemplateService
      .getEntries(
        this.templateId,
        this.isReportMode
          ? {
              year: this.selectedReportYear ?? undefined,
              month: this.selectedReportPeriod ?? undefined,
            }
          : undefined,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.entryList =
            this.isReportMode && this.selectedReportStatus !== 'ALL'
              ? list.filter((entry) => entry.status === this.selectedReportStatus)
              : list;
          this.loadingEntries = false;
        },
        error: () => (this.loadingEntries = false),
      });
  }

  /** Load only template name (for list view header) */
  private loadTemplateConfig(id: number): void {
    if (this.templateLoaded) return;
    this.gridTemplateService
      .getTemplate(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.templateName = detail.name;
          this.templateCode = detail.code;
          this.templatePeriodType = (detail.periodType as any) ?? 'MONTH';
          this.templateUseDueDate = detail.useDueDate ?? false;
          // Direct mode (selectedReportTemplate=null) cũng dùng templatePeriodType
          // để render header/value cột kỳ trong list view.
          this.recomputeEntryColumnDefs();
          this.title = detail.name;
          try {
            this.columnConfigs = JSON.parse(detail.columnConfigs || '[]');
          } catch {
            this.columnConfigs = [];
          }
          try {
            this.columnGroups = JSON.parse(detail.columnGroups || '[]');
          } catch {
            this.columnGroups = [];
          }
          this.columnGroups.forEach(reconcileColumnGroupItems);
          this.hasWorkflow = !!detail.processDefinitionKey;
          // Kiểm tra quyền gửi duyệt từ WORKFLOW_SUBMITTER_CANDIDATE
          if (this.hasWorkflow && this.templateId) {
            this.workflowService.canSubmit(this.templateId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (can) => this.canSubmitEntry = can,
                error: () => this.canSubmitEntry = false,
              });
          }
          this.templateLoaded = true;
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi tải biểu mẫu: ' + (err.error?.message || err.message),
          );
        },
      });
  }

  private loadTemplateButtons(templateId: number): void {
    this.templateButtonService.getByTemplateId(templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (buttons: any[]) => {
          this.templateButtons = buttons
            .filter(b => b.active !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        },
        error: () => { /* silent — buttons are optional */ },
      });
  }

  onTemplateButtonClick(btn: TemplateButtonItem): void {
    // SAVE vẫn xử lý local vì cần gửi rowData từ grid
    if (btn.buttonKey === 'SAVE') {
      this.saveEntry();
      return;
    }

    // IMPORT cũng xử lý local — đọc file, mapping path n-cấp, apply qua setDataValue
    if (btn.buttonKey === 'IMPORT') {
      this.importExcel();
      return;
    }

    // Case 2: Chỉ điều hướng, không có handler → route ngay, không gọi BE
    if (!btn.actionHandlerKey && btn.navigationUrl) {
      this.navigateFromButton(btn, null);
      return;
    }

    // Case 1 & 3: gọi BE handler, sau đó (nếu success) có thể điều hướng
    this.executeButtonOnBackend(btn, undefined);
  }

  /**
   * Gọi BE handler + xử lý result (toast + navigate hoặc refresh status).
   * Tách helper để các flow có input runtime cũng reuse được.
   */
  private executeButtonOnBackend(btn: TemplateButtonItem, params: Record<string, any> | undefined): void {
    this.templateButtonService.executeAction({
      templateId: this.templateId!,
      entryId: this.entryId ?? null,
      buttonKey: btn.buttonKey,
      params,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: ButtonActionResult) => {
        switch (result.status) {
          case 'success': this.dialog.success(result.message); break;
          case 'warning': this.dialog.warning(result.message); break;
          case 'error':   this.dialog.error(result.message); break;
          default:        this.dialog.info(result.message); break;
        }
        if (result.status !== 'success') return;

        // Ưu tiên 1: redirectUrl từ BE (override URL template)
        // Ưu tiên 2: navigationUrl template của nút, resolve placeholder từ context + result.data
        const didNavigate = this.navigateFromButton(btn, result);
        if (!didNavigate) {
          // Handler có thể đã đổi status entry (vd: DISTRIBUTED) →
          // refresh để các nút phụ thuộc status (SAVE, SUBMIT…) ẩn/hiện đúng.
          this.refreshAfterWorkflowAction();
        }
      },
      error: (err) => {
        this.dialog.error(err.error?.message || `Lỗi thực thi nút ${btn.buttonKey}`);
      },
    });
  }

  /**
   * Điều hướng theo cấu hình nút + result (nếu có).
   * Ưu tiên: result.redirectUrl (override) > btn.navigationUrl (template).
   * Trả true nếu đã navigate, false nếu không có URL để điều hướng.
   */
  private navigateFromButton(btn: TemplateButtonItem, result: ButtonActionResult | null): boolean {
    const overrideUrl = result?.redirectUrl?.trim();
    let finalUrl: string | null = null;

    if (overrideUrl) {
      finalUrl = overrideUrl;
    } else if (btn.navigationUrl?.trim()) {
      finalUrl = this.interpolateUrl(btn.navigationUrl.trim(), result?.data);
    }

    if (!finalUrl) return false;

    const target = btn.navigationTarget === '_blank' ? '_blank' : '_self';
    if (target === '_blank') {
      window.open(finalUrl, '_blank');
    } else {
      this.router.navigateByUrl(finalUrl);
    }
    return true;
  }

  /**
   * Resolve placeholder trong URL template.
   * Hỗ trợ:
   *   - {templateId}, {entryId}, {row_code} — từ context hiện tại
   *   - {$data.xxx} / {$data.nested.key} — từ responseData do handler trả về
   * Placeholder không resolve được sẽ bị thay bằng chuỗi rỗng.
   */
  private interpolateUrl(template: string, responseData: any): string {
    const ctx: Record<string, unknown> = {
      templateId: this.templateId ?? '',
      entryId: this.entryId ?? '',
      row_code: '',
    };
    return template.replace(/\{([^}]+)\}/g, (_, raw: string) => {
      const key = raw.trim();
      if (key.startsWith('$data.')) {
        const path = key.slice('$data.'.length).split('.');
        let cur: any = responseData;
        for (const p of path) {
          if (cur == null || typeof cur !== 'object') return '';
          cur = cur[p];
        }
        return cur == null ? '' : String(cur);
      }
      const v = ctx[key];
      return v == null ? '' : String(v);
    });
  }

  /** Nút có hiển thị hay không — dựa vào phân quyền + trạng thái entry */
  isButtonVisible(btn: TemplateButtonItem): boolean {
    // 1) Phân quyền: nếu backend trả allowed=false → ẩn
    if (btn.allowed === false) return false;

    const key = btn.buttonKey;
    const s = this.entryStatus;

    // 2) Các nút workflow → ẩn (đã có nút riêng: "Gửi duyệt", pendingTask)
    if (key === 'SUBMIT') return false;
    if (key.startsWith('APPROVE')) return false;

    // 3) SAVE — chỉ hiện khi DRAFT hoặc RETURNED
    if (key === 'SAVE') return s === 'DRAFT' || s === 'RETURNED';

    // 4) visibleStatuses cấu hình động — ưu tiên cao nhất cho custom button
    if (btn.visibleStatuses && !this.matchStatusCsv(btn.visibleStatuses, s)) return false;

    // 5) Tất cả nút khác (VIEW, EXPORT, custom buttons) — luôn hiện nếu allowed
    return true;
  }

  /** Nút có bị disable hay không — dựa vào cấu hình disabledStatuses */
  isButtonDisabled(btn: TemplateButtonItem): boolean {
    return !!btn.disabledStatuses && this.matchStatusCsv(btn.disabledStatuses, this.entryStatus);
  }

  private matchStatusCsv(csv: string, status: string): boolean {
    const normalized = (status || '').trim().toUpperCase();
    return csv.split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .includes(normalized);
  }

  /** Label nút — xử lý trạng thái submitting */
  getButtonLabel(btn: TemplateButtonItem): string {
    if (btn.buttonKey === 'SUBMIT' && this.submitting) return 'Đang gửi...';
    return btn.buttonLabel;
  }

  // getButtonAppearance(buttonKey: string): string {
  //   // Chuẩn hóa: chỉ dùng 3 appearance — primary (SAVE/CTA chính),
  //   // accent (duyệt), secondary (còn lại). Tránh trộn flat/outline cho nhất quán.
  //   if (buttonKey === 'SAVE')              return 'primary';
  //   if (buttonKey?.startsWith('APPROVE'))  return 'accent';
  //   return 'secondary';
  // }

  openEntry(entry: GridDataEntryListItem): void {
    this.ngZone.run(() => {
      this.router.navigate([], {
        queryParams: { templateId: this.templateId, entryId: entry.id },
        queryParamsHandling: 'merge',
      });
    });
  }

  promptCreateEntry(): void {
    if (!this.templateId) {
      this.dialog.error('Chưa xác định được biểu mẫu');
      return;
    }

    const data: CreateEntryDialogData = {
      templateCode: this.templateCode || '',
      userCompanyCode: this.authService.currentUser?.companyCode ?? null,
      periodType: this.templatePeriodType,
    };

    this.tuiDialogService
      .open<CreateEntryDialogResult | null>(
        new PolymorpheusComponent(CreateEntryDialogComponent),
        { data, dismissible: true, size: 'm', label: '' },
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;

        this.creatingEntry = true;
        this.gridTemplateService
          .createEntry(this.templateId!, {
            entryCode: result.code,
            entryName: result.name,
            orgCode: result.orgCode,
            year: result.year,
            month: result.month,
            rowData: '[]',
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (entry) => {
              this.creatingEntry = false;
              this.router.navigate([], {
                queryParams: { templateId: this.templateId, entryId: entry.id },
                queryParamsHandling: 'merge',
              });
            },
            error: (err) => {
              this.creatingEntry = false;
              this.dialog.error(
                'Lỗi tạo phiên: ' + (err.error?.message || err.message),
              );
            },
          });
      });
  }

  deleteEntryFromList(entry: GridDataEntryListItem): void {
    this.ngZone.run(() => {
      this.dialog
        .confirm({
          title: 'Xóa phiên',
          message: `Bạn chắc chắn muốn xóa phiên "${entry.entryName || entry.entryCode}"?`,
          status: 'error',
          confirmText: 'Xóa',
          cancelText: 'Hủy',
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe((confirmed) => {
          if (!confirmed) return;
          this.deletingEntryId = entry.id;
          this.gridTemplateService
            .deleteEntry(this.templateId!, entry.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.deletingEntryId = null;
                this.dialog.success(
                  'Đã xóa phiên thành công',
                );
                this.loadEntries();
              },
              error: (err) => {
                this.deletingEntryId = null;
                this.dialog.error(
                  'Lỗi xóa: ' + (err.error?.message || err.message),
                );
              },
            });
        });
    });
  }

  goBackToList(): void {
    this.router.navigate([], {
      queryParams: { templateId: this.templateId, entryId: null },
      queryParamsHandling: 'merge',
    });
  }
  // ============================
  // ENTRY VIEW
  // ============================

  private loadTemplateAndEntry(templateId: number, entryId: number): void {
    this.undoRedoService.clear();
    this.loading = true;
    this.gridTemplateService
      .getTemplate(templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.templateName = detail.name;
          this.templateCode = detail.code;
          this.templatePeriodType = (detail.periodType as any) ?? 'MONTH';
          this.templateUseDueDate = detail.useDueDate ?? false;
          this.hasWorkflow = !!detail.processDefinitionKey;
          // Kiểm tra quyền gửi duyệt
          if (this.hasWorkflow && templateId) {
            this.workflowService.canSubmit(templateId)
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (can) => this.canSubmitEntry = can,
                error: () => this.canSubmitEntry = false,
              });
          }
          this.templateLoaded = true;

          try {
            this.columnConfigs = JSON.parse(detail.columnConfigs || '[]');
          } catch {
            this.columnConfigs = [];
          }
          try {
            this.columnGroups = JSON.parse(detail.columnGroups || '[]');
          } catch {
            this.columnGroups = [];
          }
          this.columnGroups.forEach(reconcileColumnGroupItems);

          // Parse template rows
          this.rowData = (detail.rows || []).map((r) => {
            const row: any = { row_code: r.rowCode, row_name: r.rowName };
            if (r.isTypeHeader) row._isTypeHeader = true;
            if (r.catalogField) row._catalogField = r.catalogField;
            try {
              const data = JSON.parse(r.rowData || '{}');
              Object.assign(row, data);
            } catch {}
            if (r.cellConfig) {
              try {
                row._cellConfig = JSON.parse(r.cellConfig);
              } catch {}
            }
            return row;
          });

          // Load entry and overlay values
          this.loadEntryData(templateId, entryId);
        },
        error: (err) => {
          this.loading = false;
          this.dialog.error(
            'Lỗi tải biểu mẫu: ' +
              (err.error?.message || err.message),
          );
        },
      });
  }

  private loadEntryData(templateId: number, entryId: number): void {
    this.gridTemplateService
      .getEntry(templateId, entryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (entry) => {
          this.currentEntryName = entry.entryName || entry.entryCode;
          this.entryYear = entry.year;
          this.entryMonth = entry.month;
          this.entryOrgCode = entry.orgCode;
          this.entryDueDate = entry.dueDate ?? null;
          this.dueDateInputValue = normalizeDueDateForPicker(entry.dueDate ?? null);
          this.entryStatus = entry.status || 'DRAFT';
          // Load approval history + pending task
          this.loadApprovalHistory(templateId, entryId);
          this.loadPendingTask();

          this.entryRowsSvc.reset();

          // Entry.rowData là source of truth: snapshot độc lập với template
          // (BE clone từ template lúc tạo entry, sau đó FE save full state).
          // Custom rows (RX) sống chung trong rowData với flag `_isCustomRow=true`;
          // KHÔNG còn `customRows` JSON tách riêng (V10 đã merge vào rowData).
          let entryRows: any[] = [];
          try {
            entryRows = JSON.parse(entry.rowData || '[]');
          } catch {
            entryRows = [];
          }
          this.rowData = entryRows.map((r) => ({ ...r }));
          // Snapshot original `_cellConfig` cho delta badge + reset row helper.
          this.entryRowsSvc.captureOriginal(this.rowData);

          // GETDATA preload + setEntryContext + finishLoad (sets rowData + rebuilds graph).
          this.preloadGetdataAndContinue();
        },
        error: () => this.preloadGetdataAndContinue(),
      });
  }

  // =========================================================================
  // CUSTOM ROWS (Option A — dòng động per-entry)
  // =========================================================================

  // parseCustomRows / injectCustomRowsInto / buildCustomRowObject đã chuyển vào CustomRowsService.

  /** Entry có đang ở trạng thái cho phép sửa không? Match với gate readonly của attachments panel. */
  get isEntryEditable(): boolean {
    return (
      this.entryStatus === 'DRAFT' ||
      this.entryStatus === 'RETURNED' ||
      this.entryStatus === 'DISTRIBUTED'
    );
  }

  /**
   * Trạng thái cho phép toggle "Chỉnh sửa dòng" — đồng bộ với visibility của nút SAVE
   * (xem isButtonVisible cho key='SAVE'). Vì thêm/xóa dòng là một dạng thay đổi
   * cần save được → chỉ cho phép ở DRAFT hoặc RETURNED.
   */
  get canEditRows(): boolean {
    return this.entryStatus === 'DRAFT' || this.entryStatus === 'RETURNED';
  }

  // === FORMAT TOOLBAR ===

  /** Mặc định ẩn toolbar; user bật qua nút "Định dạng" trong render-actions. */
  formatBarCollapsed = true;

  @ViewChild('formatToolbar') formatToolbar?: FormatToolbarComponent;

  /** Range bounds expose cho <app-format-toolbar>. */
  rangeBoundsFn = () => this.rangeBounds();

  /** Per-cell gating: bỏ qua header, locked cells, cell user không edit được. */
  canApplyFmtFn = (ctx: FormatTarget): boolean => {
    if (ctx.node.data?._isTypeHeader) return false;
    return this.canEdit(ctx.field, ctx.node.data?.row_code || '');
  };

  /**
   * Toolbar phát event sau mỗi thao tác format/merge → push undo gộp qua shared
   * helper. Render không có `syncRowData` (Builder mới cần) → bỏ `afterApplyNode`.
   */
  onFormatChanged(payload: FormatChangeEvent): void {
    if (!payload?.changes?.length) return;
    pushFormatUndoAction({
      changes: payload.changes,
      gridApi: this.gridApi,
      undoBridge: this.undoRedoService,
    });
  }

  /**
   * Handler: thêm `count` dòng MỚI ngay dưới row nguồn — splice vào `rowData`
   * tại vị trí source + 1. Mỗi row mới có flag `_isCustomRow=true` + cell defaults
   * theo dataType cột. Cấm thêm dưới typeHeader. Toàn batch gom 1 undo.
   */
  addRowsBelow(sourceRow: any, count: number): void {
    if (!this.canEditRows) return;
    if (sourceRow?._isTypeHeader) return;
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    if (safeCount === 0) return;

    const allCodes = this.rowData.map((r) => r?.row_code).filter(Boolean) as string[];
    const codes = nextCustomRowCodes(allCodes, safeCount);
    const newRows = codes.map((code) => this.buildEmptyCustomRow(code));

    const idx = this.rowData.findIndex(
      (r) => r === sourceRow || r?.row_code === sourceRow?.row_code,
    );
    const insertAt = idx === -1 ? this.rowData.length : idx + 1;
    this.rowData.splice(insertAt, 0, ...newRows);
    this.pushRowDataToGrid();

    const description = newRows.length === 1
      ? `Thêm dòng ${codes[0]}`
      : `Thêm ${newRows.length} dòng (${codes[0]}–${codes[codes.length - 1]})`;

    this.undoRedoService.pushUndo({
      type: 'add_custom_row',
      description,
      undo: () => {
        const set = new Set(codes);
        this.rowData = this.rowData.filter((r) => !set.has(r?.row_code));
        this.pushRowDataToGrid();
      },
      redo: () => {
        // Chèn lại từ phiên bản clone — tránh share reference giữa các lần redo.
        this.rowData.splice(insertAt, 0, ...newRows.map((r) => ({ ...r })));
        this.pushRowDataToGrid();
      },
    });
  }

  /**
   * Handler: xóa BẤT KỲ row nào (template-cloned hoặc custom) trừ typeHeader.
   * Trước khi xóa: scan formulas trong rowData → nếu có cells reference đến
   * `row.row_code` → confirm dialog warn user (KHÔNG cản, chỉ cảnh báo).
   */
  deleteRow(row: any): void {
    if (!this.canEditRows) return;
    if (row?._isTypeHeader) return;
    if (!row?.row_code) return;

    const refs = findIncomingFormulaRefs(
      row.row_code,
      this.rowData,
      this.columnConfigs,
      this.colMap,
    );
    if (refs.length > 0) {
      const lines = refs.slice(0, 10)
        .map((r) => `• ${r.rowCode}.${r.field}  →  ${r.formula}`).join('\n');
      const more = refs.length > 10 ? `\n... và ${refs.length - 10} công thức khác` : '';
      this.dialog.confirm({
        title: `Xóa dòng ${row.row_code}?`,
        status: 'warning',
        message:
          `Có ${refs.length} công thức đang tham chiếu đến dòng này:\n${lines}${more}\n\n` +
          `Nếu xóa, các công thức trên có thể trả #NOROW! hoặc tổng bị thiếu. Tiếp tục?`,
        confirmText: 'Vẫn xóa',
        cancelText: 'Hủy',
      }).pipe(takeUntil(this.destroy$)).subscribe((ok) => {
        if (ok) this.performDeleteRow(row);
      });
    } else {
      this.performDeleteRow(row);
    }
  }

  private performDeleteRow(row: any): void {
    const idx = this.rowData.findIndex((r) => r === row || r?.row_code === row.row_code);
    if (idx === -1) return;
    const removed = this.rowData[idx];
    this.rowData.splice(idx, 1);
    this.pushRowDataToGrid();

    this.undoRedoService.pushUndo({
      type: 'delete_row',
      description: `Xóa dòng ${row.row_code}`,
      undo: () => { this.rowData.splice(idx, 0, removed); this.pushRowDataToGrid(); },
      redo: () => { this.rowData.splice(idx, 1); this.pushRowDataToGrid(); },
    });
  }

  /**
   * Handler: AG Grid `rowDragEnd` — đọc visual order từ grid, validate, apply
   * vào `this.rowData`. Push 1 undo cho cả batch reorder.
   */
  onRowDragEnd(): void {
    if (!this.canEditRows) return;
    const visualOrder: any[] = [];
    this.gridApi?.forEachNode((node) => {
      if (node.data) visualOrder.push(node.data);
    });

    const validation = this.entryRowsSvc.validateRowOrder(visualOrder);
    if (!validation.ok) {
      this.pushRowDataToGrid();
      this.dialog.warning(`Không thể sắp xếp: ${validation.reason}`);
      return;
    }

    const before = this.rowData.slice();
    if (this.areRowOrdersEqual(before, visualOrder)) return;

    const after = visualOrder.slice();
    this.rowData = after;
    this.pushRowDataToGrid();

    this.undoRedoService.pushUndo({
      type: 'reorder_row',
      description: 'Sắp xếp lại bảng',
      undo: () => { this.rowData = before.slice(); this.pushRowDataToGrid(); },
      redo: () => { this.rowData = after.slice(); this.pushRowDataToGrid(); },
    });
  }

  /** Build empty custom row với cell defaults theo dataType từng cột. */
  private buildEmptyCustomRow(rowCode: string): any {
    const row: any = { row_code: rowCode, row_name: rowCode, _isCustomRow: true };
    for (const c of this.columnConfigs) {
      if (c.formula) continue;
      row[c.field] = c.dataType === 'date' || c.dataType === 'text' ? '' : null;
    }
    return row;
  }

  /**
   * Single source of truth cho push grid sau mutate `rowData`:
   *  - Set rowData mới qua AG Grid API (clone array để AG Grid invalidate).
   *  - Rebuild formula graph (rowOrder đổi → aggregate ranges có thể đổi).
   *  - Refresh cells force để re-eval valueGetter + cell renderer.
   *  - Recalc validation list (cells mới có required empty → invalid).
   */
  private pushRowDataToGrid(): void {
    this.gridApi?.setGridOption('rowData', [...this.rowData]);
    this.rebuildFormulaGraph();
    this.gridApi?.refreshCells({ force: true });
    this.recalcValidationErrors();
  }

  private areRowOrdersEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]?.row_code !== b[i]?.row_code) return false;
    }
    return true;
  }

  // ===== CELL CONFIG DIALOG (edit formula per-cell ở entry) =====

  /**
   * User click gear icon trong cell renderer → mở Cell Config Dialog với data
   * hiện tại của cell. Bind `cellConfigInput` cho dialog đọc; sau Save sẽ trigger
   * `onCellConfigSave`. Port direct từ excel-builder.
   */
  openCellConfigDialog(rowNode: IRowNode, field: string): void {
    if (!this.canEditRows) return;
    this.editingCell = { rowNode, field };
    const isFormulaCol = !!this.columnConfigs.find((c) => c.field === field)?.formula;
    const col = this.columnConfigs.find((c) => c.field === field);
    const cellCfg = rowNode.data?._cellConfig?.[field];
    const isDateColumn = col?.dataType === 'date' || !!cellCfg?.datePicker;

    this.cellConfigInput = {
      field,
      cellConfig: cellCfg ? { ...cellCfg } : null,
      isFormulaCol,
      isDateColumn,
    };
    this.formulaValidation = null;
    this.cellDropdownItems = [];
    this.cellDropdownLoading = false;
    this.isCellConfigDialogOpen = true;
    this.cdr.detectChanges();
  }

  /** User click copy icon → copy `${rowCode}_${field}` lên clipboard. */
  private async copyCellAddressToClipboard(node: IRowNode, field: string): Promise<void> {
    const address = cellAddressOf(node.data?.row_code, field);
    try {
      await navigator.clipboard.writeText(address);
      this.dialog.success(`Đã copy: ${address}`);
    } catch {
      this.dialog.warning(`Không thể copy. Địa chỉ cell: ${address}`);
    }
  }

  /**
   * Hidden dev/BA shortcut Ctrl+Alt+C → copy danh sách cột template (kèm kiểu
   * dữ liệu + công thức đã dịch field→headerName + LOOKUP enrichment) cho tài
   * liệu PRD. KHÔNG có UI hint cho NSD — chỉ team dev/BA biết phím tắt.
   *
   * Flow: extract templateCodes referenced từ formulas → fetch metadata target
   * templates (parallel) → build text với enrichment.
   */
  private async copyColumnDocsToClipboard(): Promise<void> {
    try {
      const codes = extractReferencedTemplateCodes({
        columnConfigs: this.columnConfigs,
        rowData: this.rowData,
      });
      const targetTemplates = await this.fetchTargetTemplatesByCode(codes);
      const text = buildColumnDocsText({
        templateName: this.templateName || 'Không tên',
        columnConfigs: this.columnConfigs,
        columnGroups: this.columnGroups,
        rowData: this.rowData,
        targetTemplates,
      });
      await navigator.clipboard.writeText(text);
      this.dialog.success('Đã copy danh sách cột vào clipboard (cho tài liệu PRD)');
    } catch (err) {
      console.warn('[copyColumnDocs] failed', err);
      this.dialog.warning('Không thể copy. Hãy thử lại hoặc check quyền clipboard của trình duyệt.');
    }
  }

  /**
   * Cache metadata target templates (LOOKUP family) cho phiên hiện tại — tránh
   * fetch lại khi user bấm Ctrl+Alt+C nhiều lần. Key = templateCode.
   */
  private targetTemplatesCache = new Map<string, TargetTemplateInfo>();

  /**
   * Fetch metadata target templates theo `templateCode`. 2 bước: list để map
   * code → id, rồi `getTemplate(id)` parallel. Code không tồn tại → skip (giữ
   * formula nguyên không enrich).
   */
  private async fetchTargetTemplatesByCode(
    codes: Set<string>,
  ): Promise<Map<string, TargetTemplateInfo>> {
    const result = new Map<string, TargetTemplateInfo>();
    const need: string[] = [];
    for (const code of codes) {
      const cached = this.targetTemplatesCache.get(code);
      if (cached) result.set(code, cached);
      else need.push(code);
    }
    if (need.length === 0) return result;

    const list = await firstValueFrom(this.gridTemplateService.getTemplates());
    const idByCode = new Map<string, number>();
    for (const t of list) idByCode.set(t.code, t.id);

    await Promise.all(
      need.map(async (code) => {
        const id = idByCode.get(code);
        if (id == null) return;
        try {
          const detail = await firstValueFrom(this.gridTemplateService.getTemplate(id));
          const info = this.toTargetTemplateInfo(detail);
          this.targetTemplatesCache.set(code, info);
          result.set(code, info);
        } catch (e) {
          console.warn('[copyColumnDocs] fetch target template failed', code, e);
        }
      }),
    );
    return result;
  }

  /**
   * Hidden dev/BA shortcut Ctrl+Alt+E → generate file `.md` tài liệu mô tả 7
   * chức năng (Tìm kiếm / Thêm mới / Xem / Cập nhật / Xóa / Nhập / Xuất Excel)
   * cho biểu mẫu hiện tại. Template: `assets/docs/import_export.md`. Thay 7
   * placeholder: menuName, parentMenuName, templateName, columnsList,
   * defaultTemplateLabel, otherTemplatesList, templatesCount.
   * Trigger blob download — KHÔNG copy clipboard.
   */
  private async generateImportExportDocFile(): Promise<void> {
    try {
      const template = await firstValueFrom(
        this.http.get('assets/docs/import_export.md', { responseType: 'text' }),
      );

      // ${menuName} — menu sidebar level NSD click.
      const menuName =
        (this.reportType && this.reportFcGroupNames.get(this.reportType)) ||
        this.reportType ||
        '';

      // ${parentMenuName} — menu cha trong cây sidebar (qua SidebarMenuOption).
      let parentMenuName = '';
      if (this.reportType) {
        try {
          const menuOptions = await firstValueFrom(
            this.sidebarMenuService.getMenuOptionsForFcGroup(),
          );
          parentMenuName = menuOptions.find((o) => o.menuKey === this.reportType)?.parentLabel ?? '';
        } catch (e) {
          console.warn('[generateImportExportDoc] fetch sidebar options failed', e);
        }
      }

      // ${defaultTemplateLabel}, ${otherTemplatesList}, ${templatesCount}.
      // + Fetch detail từng template để build columnsList per loop iteration.
      let defaultTemplateLabel = '';
      let otherTemplatesList = '';
      let templatesCount = '0';
      let sameGroup: Array<{ id: number; code: string; name: string; reportFcGroups?: string[] }> = [];
      if (this.reportType) {
        try {
          const allTemplates = await firstValueFrom(
            this.gridTemplateService.getTemplates(),
          );
          sameGroup = allTemplates.filter((t) =>
            (t.reportFcGroups || []).includes(this.reportType!),
          );
          const fmt = (t: { code: string; name: string }) => `${t.code} - ${t.name}`;
          defaultTemplateLabel = sameGroup[0] ? fmt(sameGroup[0]) : '';
          otherTemplatesList = sameGroup.slice(1).map(fmt).join(', ');
          templatesCount = String(sameGroup.length);
        } catch (e) {
          console.warn('[generateImportExportDoc] fetch templates list failed', e);
        }
      }

      // Build perTemplate values — fetch detail từng template parallel.
      const perTemplate = await Promise.all(
        sameGroup.map(async (t) => {
          try {
            const detail = await firstValueFrom(this.gridTemplateService.getTemplate(t.id));
            const colCfgs = JSON.parse(detail.columnConfigs || '[]');
            const colGroups = JSON.parse(detail.columnGroups || '[]');
            const codes = extractReferencedTemplateCodes({
              columnConfigs: colCfgs,
              rowData: [],
            });
            const targets = await this.fetchTargetTemplatesByCode(codes);
            const body = buildColumnDocsBody({
              columnConfigs: colCfgs,
              columnGroups: colGroups,
              rowData: [], // KHÔNG fetch entry → cell-level formula bỏ
              targetTemplates: targets,
            });
            return {
              templateName: stripHeaderPlaceholders(detail.name),
              columnsBlock: body.split('\n').join('<br />\n'),
              currentTemplateLabel: `${detail.code} - ${detail.name}`,
            };
          } catch (e) {
            console.warn('[generateImportExportDoc] fetch detail failed', t.code, e);
            return {
              templateName: stripHeaderPlaceholders(t.name),
              columnsBlock: '',
              currentTemplateLabel: `${t.code} - ${t.name}`,
            };
          }
        }),
      );

      const doc = generateImportExportDoc({
        template,
        shared: {
          menuName,
          parentMenuName,
          defaultTemplateLabel,
          otherTemplatesList,
          templatesCount,
        },
        perTemplate,
      });
      const filename = `mo-ta-chuc-nang-${this.reportType || 'bieu-mau'}-${this.templateId ?? 0}.md`;
      this.downloadTextFile(doc, filename, 'text/markdown');
      this.dialog.success(`Đã tạo tài liệu: ${filename}`);
    } catch (err) {
      console.warn('[generateImportExportDoc] failed', err);
      this.dialog.warning('Không thể tạo tài liệu. Kiểm tra console để biết chi tiết.');
    }
  }

  /** Trigger browser download cho text content — pattern grid-dump-debug.component. */
  private downloadTextFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** Convert `GridTemplateDetail` → `TargetTemplateInfo` (sync). Dùng cho tài
   *  liệu PRD (Ctrl+Alt+C/E) — strip placeholder `${N}`/`${M}` thành literal
   *  thay vì resolve giá trị năm/tháng cụ thể. */
  private toTargetTemplateInfo(detail: any): TargetTemplateInfo {
    const cols: Array<{ field?: string; headerName?: string }> =
      JSON.parse(detail.columnConfigs || '[]');
    const fieldToHeader = new Map<string, string>();
    for (const c of cols) {
      if (c.field && c.headerName) {
        fieldToHeader.set(c.field, stripHeaderPlaceholders(c.headerName));
      }
    }
    const rowCodeToName = new Map<string, string>();
    for (const r of (detail.rows ?? []) as Array<{ rowCode?: string; rowName?: string }>) {
      if (r.rowCode) rowCodeToName.set(r.rowCode, r.rowName || r.rowCode);
    }
    return { name: stripHeaderPlaceholders(detail.name || ''), fieldToHeader, rowCodeToName };
  }

  /** Dialog catalog type select đổi → load items qua catalogService (lazy). */
  onCellDropdownCatalogTypeChange(catalogType: CatalogTypeItem | null): void {
    this.cellDropdownItems = [];
    if (catalogType) {
      this.cellDropdownLoading = true;
      this.catalogService
        .getCatalogs(catalogType.type)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (items) => {
            this.cellDropdownItems = items;
            this.cellDropdownLoading = false;
          },
          error: () => (this.cellDropdownLoading = false),
        });
    }
  }

  /**
   * User Save dialog → mutate `_cellConfig[field]` theo tab đã chọn, clear keys
   * khác (formula/dropdown/datePicker mutual-exclusive), reset value khi switch
   * type, rebuild graph, push undo.
   */
  onCellConfigSave(result: CellConfigResult): void {
    if (!this.editingCell || !this.editingCell.rowNode.data) return;
    const { rowNode, field } = this.editingCell;
    const beforeData = JSON.parse(JSON.stringify(rowNode.data));
    const rowData = { ...rowNode.data };

    if (!rowData._cellConfig) rowData._cellConfig = {};
    if (!rowData._cellConfig[field]) rowData._cellConfig[field] = {};

    const prevCfg = rowNode.data?._cellConfig?.[field];
    const prevType = prevCfg?.datePicker ? 'datepicker'
      : prevCfg?.dropdown ? 'dropdown'
      : prevCfg?.formula ? 'formula' : 'none';

    if (result.tab === 'formula') {
      delete rowData._cellConfig[field].dropdown;
      delete rowData._cellConfig[field].datePicker;
      if (result.formula) {
        rowData._cellConfig[field].formula = result.formula;
        if (prevType !== 'formula') rowData[field] = null;
      } else {
        delete rowData._cellConfig[field].formula;
        if (prevType !== 'none') {
          const col = this.columnConfigs.find((c) => c.field === field);
          rowData[field] = col?.dataType === 'date' ? '' : null;
        }
      }
    } else if (result.tab === 'dropdown') {
      delete rowData._cellConfig[field].formula;
      delete rowData._cellConfig[field].datePicker;
      if (result.dropdown) {
        rowData._cellConfig[field].dropdown = result.dropdown;
        const itemNames = this.cellDropdownItems.map((i) => i.name);
        this.dropdownItemsCache.set(result.dropdown.catalogType, itemNames);
        if (prevType !== 'dropdown') rowData[field] = '';
      } else {
        delete rowData._cellConfig[field].dropdown;
        if (prevType === 'dropdown') {
          const col = this.columnConfigs.find((c) => c.field === field);
          rowData[field] = col?.dataType === 'date' ? '' : null;
        }
      }
    } else if (result.tab === 'datepicker') {
      delete rowData._cellConfig[field].formula;
      delete rowData._cellConfig[field].dropdown;
      if (result.datePicker) {
        rowData._cellConfig[field].datePicker = true;
        if (prevType !== 'datepicker') rowData[field] = '';
      } else {
        delete rowData._cellConfig[field].datePicker;
        if (prevType === 'datepicker') {
          const col = this.columnConfigs.find((c) => c.field === field);
          rowData[field] = col?.dataType === 'date' ? '' : null;
        }
      }
    } else if (result.tab === 'validation') {
      if (result.validation && Object.keys(result.validation).length > 0) {
        rowData._cellConfig[field].validation = result.validation;
      } else {
        delete rowData._cellConfig[field].validation;
      }
    }

    if (rowData._cellConfig[field] && Object.keys(rowData._cellConfig[field]).length === 0) {
      delete rowData._cellConfig[field];
    }
    if (rowData._cellConfig && Object.keys(rowData._cellConfig).length === 0) {
      delete rowData._cellConfig;
    }

    this.applyCellRowData(rowNode, rowData);
    const afterData = JSON.parse(JSON.stringify(rowData));
    const rowCode = rowData.row_code;

    this.undoRedoService.pushUndo({
      type: 'cell_config_save',
      description: `Sửa cell ${rowCode}.${field}`,
      undo: () => this.applyCellRowDataByCode(rowCode, beforeData),
      redo: () => this.applyCellRowDataByCode(rowCode, afterData),
    });

    this.editingCell = null;
  }

  /** User Clear → xóa toàn bộ `_cellConfig[field]`, reset value về default cột. */
  onCellConfigClear(): void {
    if (!this.editingCell || !this.editingCell.rowNode.data) return;
    const { rowNode, field } = this.editingCell;
    const beforeData = JSON.parse(JSON.stringify(rowNode.data));
    const rowData = { ...rowNode.data };

    const prevCfg = rowData._cellConfig?.[field];
    if (prevCfg?.formula || prevCfg?.dropdown || prevCfg?.datePicker) {
      const col = this.columnConfigs.find((c) => c.field === field);
      rowData[field] = col?.dataType === 'date' ? '' : null;
    }
    if (rowData._cellConfig) {
      delete rowData._cellConfig[field];
      if (Object.keys(rowData._cellConfig).length === 0) delete rowData._cellConfig;
    }

    this.applyCellRowData(rowNode, rowData);
    const afterData = JSON.parse(JSON.stringify(rowData));
    const rowCode = rowData.row_code;

    this.undoRedoService.pushUndo({
      type: 'cell_config_clear',
      description: `Xóa config cell ${rowCode}.${field}`,
      undo: () => this.applyCellRowDataByCode(rowCode, beforeData),
      redo: () => this.applyCellRowDataByCode(rowCode, afterData),
    });

    this.editingCell = null;
  }

  /**
   * Apply rowData mới cho 1 node + sync `this.rowData` + redraw row + refresh
   * cells + rebuild formula graph + recalc validation. Single source cho cell
   * config save/clear/reset paths.
   */
  private applyCellRowData(rowNode: IRowNode, rowData: any): void {
    rowNode.setData(rowData);
    const idx = this.rowData.findIndex((r) => r?.row_code === rowData.row_code);
    if (idx !== -1) this.rowData[idx] = rowData;
    this.formulaCoordinator.preloadGetdataAndThen(this.buildPreloadInput(), () => {
      this.rebuildFormulaGraph();
      this.gridApi?.redrawRows({ rowNodes: [rowNode] });
      const columnsToRefresh = this.columnConfigs.map((c) => c.field);
      this.gridApi?.refreshCells({ columns: columnsToRefresh, force: true });
      this.recalcValidationErrors();
    });
  }

  /** Apply rowData by rowCode (cho undo/redo path khi node ref có thể stale). */
  private applyCellRowDataByCode(rowCode: string, rowData: any): void {
    const node = this.findNodeByRowCode(rowCode);
    if (node) this.applyCellRowData(node, JSON.parse(JSON.stringify(rowData)));
  }

  // ===== EditMode toggle =====

  toggleEditMode(): void {
    if (!this.canEditRows) return;
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) this.closeContextMenu();
    // Rebuild để cột "Mã dòng" prepend/remove theo state. AG Grid push columnDefs
    // qua Angular CD (binding `[columnDefs]`) nên không gọi setGridOption.
    this.buildGridDefinitions();
    // Re-evaluate cellRendererSelector — toggle ON/OFF đổi giữa
    // FormulaCellRenderer (icon copy + gear) và default renderer.
    this.gridApi?.refreshCells({ force: true });
  }

  // ===== Right-click context menu =====

  /**
   * Handler cho AG Grid event `cellContextMenu` (đăng ký trong onGridReady).
   * Nhận trực tiếp row data + native MouseEvent từ AG Grid nên tin cậy hơn
   * cách DOM traversal trước đây (vốn fragile với cell editor popup + zoom transform).
   */
  private handleCellContextMenu(agEvent: any): void {
    if (!this.isEditMode || !this.canEditRows) return;
    const row = agEvent?.data;
    if (!row) return;

    // Edit-table mode: cho thêm/xóa BẤT KỲ row trừ typeHeader (section boundary cố định).
    const isHeader = !!row._isTypeHeader;
    const showAdd = !isHeader;
    const showDelete = !isHeader && !!row.row_code;
    const showResetCellConfig =
      !isHeader && this.entryRowsSvc.hasOriginalCellConfig(row.row_code) && this.hasCellConfigDelta(row);
    if (!showAdd && !showDelete && !showResetCellConfig) return;

    const mouseEvent = agEvent.event as MouseEvent | undefined;
    if (mouseEvent && typeof mouseEvent.preventDefault === 'function') {
      mouseEvent.preventDefault();
    }
    const x = mouseEvent?.clientX ?? 0;
    const y = mouseEvent?.clientY ?? 0;
    // Angular zone: AG Grid emit event có thể chạy ngoài zone → chạy trong zone
    // để CD pick up thay đổi `contextMenu` ngay lập tức.
    this.ngZone.run(() => {
      this.contextMenu = { x, y, row, showAdd, showDelete, showResetCellConfig };
    });
  }

  /** True nếu `row._cellConfig` đã thay đổi vs original snapshot (deep compare JSON). */
  private hasCellConfigDelta(row: any): boolean {
    const orig = this.entryRowsSvc.getOriginalCellConfig(row.row_code);
    return JSON.stringify(orig ?? null) !== JSON.stringify(row._cellConfig ?? null);
  }

  /**
   * Wrapper `(contextmenu)` handler giữ lại để preventDefault browser native
   * menu khi custom menu sẽ hiển thị (AG Grid event chạy sau contextmenu bubble,
   * nên cần chặn sớm ở đây nếu editmode ON).
   */
  onGridContextMenu(event: MouseEvent): void {
    if (this.isEditMode && this.canEditRows) {
      event.preventDefault();
    }
  }

  closeContextMenu(): void {
    this.contextMenu = null;
  }

  /** User click item "Thêm dòng dưới" trong context menu (số lượng từ inline input). */
  onContextMenuAddBelow(count: number): void {
    if (!this.contextMenu) return;
    const row = this.contextMenu.row;
    this.closeContextMenu();
    this.addRowsBelow(row, count);
  }

  /** User click item "Xóa dòng" trong context menu. */
  onContextMenuDelete(): void {
    if (!this.contextMenu) return;
    const row = this.contextMenu.row;
    this.closeContextMenu();
    this.deleteRow(row);
  }

  /** User click item "Khôi phục công thức theo mẫu gốc" — reset row._cellConfig về snapshot. */
  onContextMenuResetCellConfig(): void {
    if (!this.contextMenu) return;
    const row = this.contextMenu.row;
    this.closeContextMenu();
    this.resetRowCellConfig(row);
  }

  /**
   * Reset `row._cellConfig` về snapshot gốc của `loadEntryData`. Push undo cho
   * nhanh chóng revert. Chỉ áp dụng cho row có original snapshot — context menu
   * `showResetCellConfig` đã gate trước.
   */
  private resetRowCellConfig(row: any): void {
    if (!this.canEditRows) return;
    if (!row?.row_code) return;
    const node = this.findNodeByRowCode(row.row_code);
    if (!node) return;
    const orig = this.entryRowsSvc.getOriginalCellConfig(row.row_code);
    const before = node.data._cellConfig
      ? JSON.parse(JSON.stringify(node.data._cellConfig))
      : undefined;
    const after = orig ? JSON.parse(JSON.stringify(orig)) : undefined;

    this.applyRowCellConfig(node, after);
    this.undoRedoService.pushUndo({
      type: 'reset_row_cell_config',
      description: `Khôi phục công thức gốc của ${row.row_code}`,
      undo: () => this.applyRowCellConfig(node, before),
      redo: () => this.applyRowCellConfig(node, after),
    });
  }

  /**
   * Apply `_cellConfig` mới (hoặc remove nếu undefined) cho node. Rebuild graph
   * + refresh cells + recalc validation. Dùng cho cả undo/redo path của reset.
   */
  private applyRowCellConfig(node: IRowNode, cellConfig: any | undefined): void {
    const data = { ...node.data };
    if (cellConfig) data._cellConfig = JSON.parse(JSON.stringify(cellConfig));
    else delete data._cellConfig;
    node.setData(data);
    // Sync local rowData để serialize đúng + cellClassRules đọc đúng state.
    const idx = this.rowData.findIndex((r) => r?.row_code === node.data?.row_code);
    if (idx !== -1) this.rowData[idx] = data;
    this.rebuildFormulaGraph();
    this.gridApi?.refreshCells({ force: true });
    this.recalcValidationErrors();
  }

  // Đóng menu khi click ra ngoài hoặc ESC
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeContextMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeContextMenu();
    this.clearRangeSelection();
  }

  // Đóng khi cuộn hoặc resize để tránh menu "lơ lửng" sai vị trí so với row
  @HostListener('window:wheel')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.closeContextMenu();
  }

  /**
   * Scan all formulas for GETDATA calls, batch-preload lookup data, then continue loading.
   */
  private preloadGetdataAndContinue(): void {
    this.formulaCoordinator.preloadGetdataAndThen(this.buildPreloadInput(), () => this.checkAutoLoad());
  }

  /**
   * Build input cho `formulaCoordinator.preloadGetdataAndThen`. Single source of truth
   * cho mọi preload call ở Render → tránh tái xuất bug "thiếu `orgCode`" (lịch sử:
   * `applyCellRowData` + `preloadGetdataAndContinue` từng truyền thiếu, LOOKUPENTRY
   * trả `#NOORG!` ngay sau cell config save mặc dù entry có orgCode đúng).
   *
   * BẮT BUỘC: thêm field mới của `FormulaCoordinatorPreloadInput` PHẢI chỉnh ở đây,
   * KHÔNG inline tại call site.
   */
  private buildPreloadInput() {
    return {
      columnConfigs: this.columnConfigs,
      rowData: this.rowData,
      year: this.entryYear,
      month: this.entryMonth,
      orgCode: this.entryOrgCode,
      destroy$: this.destroy$,
    };
  }

  // [removed] Auto-load catalog rows — autoLoad đã bỏ. checkAutoLoad giờ chỉ finishLoad.
  private checkAutoLoad(): void {
    this.finishLoad();
  }

  private finishLoad(): void {
    this.buildGridDefinitions();
    // Set columnDefs/rowData trực tiếp qua API — Angular CD chưa propagate `[columnDefs]`
    // tới AG Grid khi finishLoad chạy đồng bộ trong subscribe callback.
    //
    // Skip nếu grid đã destroyed (loading transition đang destroy ag-grid) — Angular
    // sẽ tự bind lại qua `[rowData]`/`[columnDefs]` Input khi grid render lại sau
    // `loading = false`. `rebuildFormulaGraph` sẽ pending tới `onGridReady` mới.
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.gridApi.setGridOption('columnDefs', this.gridColDefs);
      this.gridApi.setGridOption('rowData', [...this.rowData]);
    }
    // Build dep graph + recompute mọi formula sau khi rowData + columns sẵn sàng.
    this.rebuildFormulaGraph();
    this.loadPermissions();
    this.loading = false;
    // F5 fix: tính validation list ngay nếu grid healthy (đã setGridOption rowData).
    // Else mark pending — onGridReady tiếp theo sẽ flush. Tránh setTimeout race.
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.recalcValidationErrors();
    } else {
      this.pendingValidationRecalc = true;
    }
    // Mark auto-sync pending — nếu shadow store có value khác rowData persisted
    // → silent save sau khi grid ready. Đảm bảo LOOKUP cross-entry đọc đúng giá
    // trị formula compute được. Trigger ngay nếu grid healthy, else chờ onGridReady.
    this.pendingAutoSync = true;
    this.tryAutoSyncFormulas();
    // Recompute banner state — user không edit được sẽ thấy cảnh báo entry chưa
    // đồng bộ. Đối với user edit được, auto-sync vừa fire ở trên sẽ tự reset state.
    this.refreshUnsyncedFormulaState();
  }

  private loadPermissions(): void {
    if (!this.templateId) {
      this.permissions = [];
      return;
    }
    this.gridPermissionService
      .getPermissions(this.templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((perms) => {
        this.permissions = perms;
        this.buildGridDefinitions();
        if (this.gridApi) this.gridApi.refreshCells({ force: true });
      });
  }

  // --- Inherit cell config from type headers ---

  private inheritCellConfig(rows: any[]): void {
    let currentHeaderConfig: any = null;
    for (const row of rows) {
      if (row._isTypeHeader) {
        currentHeaderConfig = row._cellConfig || null;
      } else if (currentHeaderConfig) {
        if (!row._cellConfig) row._cellConfig = {};
        for (const field of Object.keys(currentHeaderConfig)) {
          if (!row._cellConfig[field]) {
            const inherited = { ...currentHeaderConfig[field] };
            delete inherited.formula; // formula is cell-specific, don't inherit
            if (Object.keys(inherited).length > 0) {
              row._cellConfig[field] = inherited;
            }
          }
        }
      }
    }
  }

  // --- Build Grid ---

  private buildGridDefinitions(): void {
    this.colMap = {};
    this.columnConfigs.forEach((c) => {
      if (c.excelCol) this.colMap[c.excelCol] = c.field;
    });

    const colDefMap = new Map<string, ColDef>();
    this.columnConfigs.forEach((config) => {
      colDefMap.set(config.field, this.buildSingleColDef(config));
    });

    // Dọn stale references đệ quy ở mọi cấp (lá trực tiếp + lá nested đều cần clean)
    const validFields = new Set(this.columnConfigs.map((c) => c.field));
    cleanStaleColumnGroupFields(this.columnGroups, validFields);
    this.columnGroups.forEach(reconcileColumnGroupItems);

    // Thu thập tất cả leaf fields ở mọi cấp (cả trực tiếp lẫn nested)
    const groupedFields = collectAllLeafFields(this.columnGroups);

    // Build ColGroupDef đệ quy theo thứ tự items (xen kẽ leaf + sub-group)
    const buildGroupDef = (group: ColumnGroupConfig): ColGroupDef => {
      const childMap = new Map<string, ColumnGroupConfig>();
      (group.children ?? []).forEach((c) => childMap.set(c.groupId, c));
      const items = group.items ?? [];
      const children: (ColDef | ColGroupDef)[] = [];
      for (const it of items) {
        if (it.type === 'field') {
          const def = colDefMap.get(it.field);
          if (def) children.push(def);
        } else {
          const sub = childMap.get(it.groupId);
          if (sub) children.push(buildGroupDef(sub));
        }
      }
      return { groupId: group.groupId, headerName: resolveHeaderName(group.headerName, this.entryYear, this.entryMonth), marryChildren: group.marryChildren ?? false, children } as ColGroupDef;
    };

    // Render dành cho người nhập liệu — mặc định ẩn cột "Mã dòng".
    // Khi user bật "Chỉnh sửa dòng" (`isEditMode=true`) → prepend cột read-only
    // để user thấy mã dòng đang thao tác (thêm/xoá/copy-paste range cần biết
    // mã để tham chiếu trong formula). `row_code` vẫn nằm trong rowData → formula
    // không bị ảnh hưởng dù cột có hiển thị hay không.
    const result: (ColDef | ColGroupDef)[] = [];
    if (this.isEditMode) {
      result.push(this.buildRowCodeReadOnlyColDef());
    }

    const emittedRootGroups = new Set<string>();
    this.columnConfigs.forEach((config) => {
      if (groupedFields.has(config.field)) {
        const rootGroup = this.columnGroups.find((g) => columnGroupContainsField(g, config.field));
        if (rootGroup && !emittedRootGroups.has(rootGroup.groupId)) {
          emittedRootGroups.add(rootGroup.groupId);
          const colGroupDef = buildGroupDef(rootGroup);
          if ((colGroupDef.children?.length ?? 0) > 0) result.push(colGroupDef);
        }
      } else {
        result.push(colDefMap.get(config.field)!);
      }
    });

    this.gridColDefs = result;
    // KHÔNG gọi setGridOption('columnDefs', ...) — Angular CD tự đẩy qua `[columnDefs]`.
    this.recalcGridHeight();
  }

  /**
   * ColDef cho cột "Mã dòng" ở Render — read-only display, pinned-left.
   * Chỉ hiển thị khi `isEditMode=true` để user identify dòng đang thao tác.
   *
   * KHÔNG editable (row_code là identity, đổi sẽ break formula refs).
   * `rowDrag` bật cho MỌI row trừ typeHeader trong edit-table mode — user tự do
   * sắp xếp template-cloned + custom rows trong scope của entry (snapshot model).
   */
  private buildRowCodeReadOnlyColDef(): ColDef {
    return {
      field: 'row_code',
      headerName: 'Mã dòng',
      width: DEFAULT_COLUMN_WIDTH,
      minWidth: COLUMN_MIN_WIDTH,
      pinned: 'left',
      sortable: false,
      filter: false,
      editable: false,
      suppressMovable: true,
      rowDrag: (params: RowDragCallbackParams) =>
        this.canEditRows && this.isEditMode && !params.data?._isTypeHeader,
      cellStyle: () => ({ ...CELL_STYLES.ROW_CODE_NORMAL }),
    };
  }

  /** Tooltip header — `DataField: X - mã cột excel: Y`. Bỏ phần excel nếu không có. */
  private buildHeaderTooltip(config: ColumnConfig): string {
    const base = `DataField: ${config.field}`;
    return config.excelCol ? `${base} - m\u00E3 c\u1ED9t excel: ${config.excelCol}` : base;
  }

  // ============================================================
  // Column definition builders — tách thành 3 micro-method theo loại cột
  // ============================================================

  private buildSingleColDef(config: ColumnConfig): ColDef {
    const isFormula = !!config.formula;
    const isDate = config.dataType === 'date' && !isFormula;

    const colDef: any = {
      field: config.field,
      headerName: resolveHeaderName(config.headerName, this.entryYear, this.entryMonth),
      width: config.width ?? DEFAULT_COLUMN_WIDTH,
      minWidth: COLUMN_MIN_WIDTH,
      sortable: true,
      resizable: true,
      filter: true,
      userData: { formula: config.formula, excelCol: config.excelCol },
      headerTooltip: this.buildHeaderTooltip(config),
      tooltipComponent: FormulaTooltipComponent,
    };

    if (isFormula) this.applyFormulaColDef(colDef, config);
    else if (isDate) this.applyDateColDef(colDef, config);
    else this.applyDataColDef(colDef, config);

    // Merge ngang: anchor cell có colSpan > 1 sẽ đè qua các cột hidden bên phải.
    colDef.colSpan = (params: any) => cellColSpan(params.data?._cellConfig?.[config.field]);

    // Delta badge: cell có formula thay đổi vs original snapshot → corner orange triangle.
    colDef.cellClassRules = {
      ...(colDef.cellClassRules || {}),
      'cell-formula-delta': (params: any) =>
        this.entryRowsSvc.isCellFormulaModified(
          params.data?.row_code,
          config.field,
          params.data?._cellConfig,
        ),
    };

    return colDef;
  }

  /** Cột công thức: read-only, evaluate formula qua valueGetter. */
  private applyFormulaColDef(colDef: any, config: ColumnConfig): void {
    colDef.editable = false;
    colDef.cellClass = 'bg-gray-50 font-mono text-blue-600';
    colDef.tooltipValueGetter = (params: any) => {
      if (typeof params.value === 'string' && params.value.startsWith('#')) return params.value;
      return 'trigger';
    };

    colDef.valueGetter = (params: ValueGetterParams) => {
      const cellCfg = params.data?._cellConfig?.[config.field];
      if (cellCfg?.dropdown || cellCfg?.datePicker) return params.data?.[config.field];
      const formulaToUse = cellCfg?.formula || config.formula;
      if (!formulaToUse) return params.data?.[config.field];
      const shadowVal = this.formulaGraph.getValue(params.data?.row_code, config.field);
      return shadowVal !== undefined ? shadowVal : params.data?.[config.field];
    };

    colDef.valueFormatter = (p: any) => this.formatCellValue(p, config);
    colDef.cellStyle = (params: any) => this.styleFormulaCell(params, config);
    colDef.cellRendererSelector = (params: any) => this.cellRendererSelectorByCellCfg(params, config.field);
  }

  /** Cột ngày tháng: native date picker; tooltip cho validation. */
  private applyDateColDef(colDef: any, config: ColumnConfig): void {
    colDef.editable = false;
    colDef.valueFormatter = (p: any) => this.formatIsoDate(p.value);
    colDef.cellStyle = (params: any) => {
      const vr = this.validateCell(config.field, params.value, params.data || {});
      const fmt = cellFormatStyle(params.data?._cellConfig?.[config.field]);
      const base = vr.valid ? CELL_STYLES.DATE : CELL_STYLES.DATE_INVALID;
      return { ...base, ...fmt };
    };
    colDef.cellRendererSelector = (params: any) => {
      const hasDropdown = !!params.data?._cellConfig?.[config.field]?.dropdown;
      if (hasDropdown) {
        return {
          component: DropdownCellRenderer,
          params: { field: config.field, getDropdownValues: this.getDropdownValues },
        };
      }
      return { component: DateCellRenderer, params: { field: config.field } };
    };
    colDef.cellRenderer = DateCellRenderer;
    // Date cell KHÔNG show tooltip — border đỏ + app-validation-error-panel đã đủ
    // signal. Tooltip validation từng bị stale do AG Grid lifecycle.
    colDef.tooltipValueGetter = () => '';
  }

  /** Cột data thường: editable theo permission + cell config. */
  private applyDataColDef(colDef: any, config: ColumnConfig): void {
    colDef.editable = (params: any) => {
      const cellCfg = params.data?._cellConfig?.[config.field];
      if (cellCfg?.formula || cellCfg?.dropdown || cellCfg?.datePicker) return false;
      return this.canEdit(config.field, params.data?.row_code || '');
    };

    colDef.tooltipValueGetter = (params: any) => {
      // Formula error: trả error code (`#XXX!`) để tooltip render description.
      if (typeof params.value === 'string' && params.value.startsWith('#')) return params.value;
      // Trigger tooltip cho:
      //   - Cell có formula/dropdown/datePicker metadata
      //   - Cell có format truncation (decimals/percent) → hiển thị "Giá trị gốc"
      // Validation invalid KHÔNG show tooltip — đã có border đỏ + app-validation-error-panel.
      const cellCfg = params.data?._cellConfig?.[config.field];
      const fmt = cellCfg?.format;
      const hasFormatTruncation = fmt && (fmt.decimals != null || fmt.percent);
      return cellCfg?.formula || cellCfg?.dropdown || cellCfg?.datePicker || hasFormatTruncation
        ? 'trigger' : '';
    };

    colDef.valueGetter = (params: ValueGetterParams) => {
      const cellFormula = params.data?._cellConfig?.[config.field]?.formula;
      if (!cellFormula) return params.data?.[config.field];
      const shadowVal = this.formulaGraph.getValue(params.data?.row_code, config.field);
      return shadowVal !== undefined ? shadowVal : params.data?.[config.field];
    };

    colDef.valueSetter = (params: any) => {
      if (config.dataType === 'text') {
        params.data[config.field] = params.newValue ?? '';
        return true;
      }
      // Cell có format=% → auto ÷100 (Excel "Auto Percent Entry"): user nhập "10"
      // hoặc "10%" → store raw 0.1; display layer tự ×100 và append %.
      const cellFmt = params.data?._cellConfig?.[config.field]?.format;
      const raw = params.newValue;
      const isEmpty = raw === '' || raw == null;
      const parsed = parseNumberInputForCell(raw, cellFmt);
      // Input không rỗng nhưng parse fail → user gõ text vào cột số. Reject để
      // AG Grid revert giá trị cũ + toast warning.
      if (!isEmpty && parsed === null) {
        this.dialog.warning(`Cột "${config.headerName}" chỉ nhận giá trị số. Bạn vừa nhập "${raw}".`);
        return false;
      }
      params.data[config.field] = parsed;
      return true;
    };

    colDef.valueFormatter = (p: any) => this.formatCellValue(p, config);
    colDef.cellStyle = (params: any) => this.styleDataCell(params, config);
    colDef.cellRendererSelector = (params: any) => this.cellRendererSelectorByCellCfg(params, config.field);
    colDef.onCellValueChanged = (params: any) => {
      // Topo-sort + shadow store: BFS reverse-deps → recompute đúng cells affected
      // → refresh đúng tập columns. Eval order deterministic theo topo, không có
      // recursion lúc render → không thể có false-positive #CIRCULAR! như kiến trúc cũ.
      const rowCode = params.data?.row_code;
      if (!rowCode) return;
      this.formulaGraph.setData(rowCode, config.field, params.newValue);
      const fieldsToRefresh = this.formulaGraph.getDependentFields(rowCode, config.field);
      if (fieldsToRefresh.length > 0) {
        params.api.refreshCells({ columns: fieldsToRefresh, force: true });
      }
    };
  }

  // ============================================================
  // Helpers cho colDef micro-builders — share giữa formula/data branches
  // ============================================================

  private formatCellValue(p: any, config: ColumnConfig): string {
    return fmtCellValue(p, config);
  }

  private formatIsoDate(value: any): string {
    return fmtIsoDate(value);
  }

  /**
   * Class highlight theo khoảng cách đến due_date — chỉ áp khi quá hạn / sắp đến hạn:
   *   --overdue : đã quá hạn (đỏ)
   *   --soon    : còn ≤ 3 ngày (vàng)
   *   không class : còn > 3 ngày hoặc chưa có hạn (style mặc định, không highlight)
   */
  get dueDateHighlightClass(): string {
    if (!this.entryDueDate) return '';
    const diffDays = (new Date(this.entryDueDate).getTime() - Date.now()) / 86_400_000;
    if (diffDays < 0) return 'due-date-control--overdue';
    if (diffDays <= 3) return 'due-date-control--soon';
    return '';
  }

  /**
   * Cho phép edit "Hạn xử lý" trên entry view khi entry còn ở trạng thái có thể chỉnh sửa
   * (DRAFT/RETURNED) VÀ template bật `useDueDate`. Sau DISTRIBUTED → readOnly.
   *
   * Pattern: TCT set hạn ngay tại entry 304 trước khi bấm "Giao chi phí cho đơn vị"
   * (handler đọc {@code source.dueDate} thay vì popup nhập).
   */
  get canEditDueDate(): boolean {
    return this.templateUseDueDate && this.canEditRows;
  }

  /**
   * Persist dueDate ngay khi user thay đổi date picker — tránh mất hạn nếu user chưa
   * bấm Save trước khi click "Giao chi phí". Empty value = không gửi (giữ giá trị cũ),
   * vì hiện chưa có UX cho clear hạn.
   */
  onDueDateChange(value: string | null): void {
    if (!this.templateId || !this.entryId) return;
    if (!this.canEditDueDate) return;
    if (!value) return;
    if (value === this.entryDueDate) return;

    this.gridTemplateService
      .updateEntry(this.templateId, this.entryId, { dueDate: value })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.entryDueDate = value;
          this.dueDateInputValue = normalizeDueDateForPicker(value);
          this.dialog.success('Đã cập nhật hạn xử lý.');
        },
        error: (err) => {
          this.dueDateInputValue = normalizeDueDateForPicker(this.entryDueDate);
          this.dialog.error(
            'Lỗi cập nhật hạn xử lý: ' + (err.error?.message || err.message),
          );
        },
      });
  }

  private cellPresetStyle(params: any, config: ColumnConfig, cellCfg: any): any | null {
    return resolveCellPresetStyle(params, config, cellCfg, RENDER_ERROR_STYLE);
  }

  /** Style cell trong cột FORMULA. WARNING (#NODATA!/#NOROW!) khác ERROR. */
  private styleFormulaCell(params: any, config: ColumnConfig): any {
    const cellCfg = params.data?._cellConfig?.[config.field];
    const fmt = cellFormatStyle(cellCfg);
    const preset = this.cellPresetStyle(params, config, cellCfg);
    if (preset) return { ...preset, ...fmt };
    return Object.keys(fmt).length ? fmt : null;
  }

  /**
   * Style cell trong cột DATA. Priority: formula error > validation invalid > preset > lock > normal.
   *
   * Validation invalid border PHẢI merge với preset bg (dropdown/datePicker giữ màu nền) — red
   * border là tín hiệu critical, không thể bị che bởi preset.
   */
  private styleDataCell(params: any, config: ColumnConfig): any {
    const cellCfg = params.data?._cellConfig?.[config.field];
    const fmt = cellFormatStyle(cellCfg);

    // Formula error (#XXX!) priority cao nhất.
    if (typeof params.value === 'string' && params.value.startsWith('#')) {
      const errorBase = this.cellPresetStyle(params, config, cellCfg) || CELL_STYLES.ERROR;
      return { ...errorBase, ...fmt };
    }

    const canEditCell = this.canEdit(config.field, params.data?.row_code || '');
    const vr = this.validateCell(config.field, params.value, params.data || {});

    if (!vr.valid) {
      const base =
        this.cellPresetStyle(params, config, cellCfg) ||
        (canEditCell ? CELL_STYLES.DATA_NORMAL : CELL_STYLES.LOCKED_CELL);
      return { ...base, ...CELL_STYLES.VALIDATION_INVALID_BORDER, ...fmt };
    }

    const preset = this.cellPresetStyle(params, config, cellCfg);
    if (preset) return { ...preset, ...fmt };
    if (!canEditCell) return { ...CELL_STYLES.LOCKED_CELL, ...fmt };
    return { ...CELL_STYLES.DATA_NORMAL, ...fmt };
  }

  /**
   * Selector cho renderer dựa trên `_cellConfig`:
   *  - datePicker / dropdown override luôn ưu tiên (giữ inline editor).
   *  - Edit-table mode ON + non-typeHeader → swap sang `FormulaCellRendererComponent`
   *    (icon copy + gear) để user mở Cell Config Dialog edit formula.
   *  - Còn lại: default renderer (text/number).
   */
  private cellRendererSelectorByCellCfg(params: any, field: string): any {
    const cellCfg = params.data?._cellConfig?.[field];
    if (cellCfg?.datePicker) return { component: DateCellRenderer, params: { field } };
    if (cellCfg?.dropdown) {
      return { component: DropdownCellRenderer, params: { field, getDropdownValues: this.getDropdownValues } };
    }
    if (this.isEditMode && this.canEditRows && !params.data?._isTypeHeader) {
      return {
        component: FormulaCellRendererComponent,
        params: {
          field,
          openConfigDialog: (node: IRowNode, f: string) => this.openCellConfigDialog(node, f),
          copyCellAddress: (node: IRowNode, f: string) => this.copyCellAddressToClipboard(node, f),
        },
      };
    }
    return undefined;
  }

  // --- Helpers ---

  getDropdownValues = (field: string, data: any): Promise<string[]> => {
    const dropdown = data?._cellConfig?.[field]?.dropdown;
    if (!dropdown) return Promise.resolve([]);
    const cached = this.dropdownItemsCache.get(dropdown.catalogType);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve) => {
      this.catalogService
        .getCatalogs(dropdown.catalogType)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (items) => {
            const names = items.map((i) => i.name);
            this.dropdownItemsCache.set(dropdown.catalogType, names);
            resolve(names);
          },
          error: () => resolve([]),
        });
    });
  };

  validateCell(
    field: string,
    value: any,
    rowData: any,
  ): { valid: boolean; message?: string } {
    const colValidation = this.columnConfigs.find(
      (c) => c.field === field,
    )?.validation;
    const cellValidation = rowData._cellConfig?.[field]?.validation;
    const rule = cellValidation || colValidation;
    return validateCellValue(value, rule);
  }

  canEdit(field: string, rowCode: string): boolean {
    if (this.permissions.length === 0) return true;

    for (const p of this.permissions) {
      if (p.permissionType === 'LOCK') {
        if (p.level === 'COLUMN' && p.targetField === field) return false;
        if (p.level === 'ROW' && p.targetRowCode === rowCode) return false;
        if (
          p.level === 'CELL' &&
          p.targetField === field &&
          p.targetRowCode === rowCode
        )
          return false;
      }
      if (p.permissionType === 'DENY' && p.userId === this.currentUserId) {
        if (p.level === 'COLUMN' && p.targetField === field) return false;
        if (p.level === 'ROW' && p.targetRowCode === rowCode) return false;
        if (
          p.level === 'CELL' &&
          p.targetField === field &&
          p.targetRowCode === rowCode
        )
          return false;
      }
    }

    const allowPerms = this.permissions.filter(
      (p) =>
        p.permissionType === 'ALLOW' &&
        ((p.level === 'COLUMN' && p.targetField === field) ||
          (p.level === 'ROW' && p.targetRowCode === rowCode) ||
          (p.level === 'CELL' &&
            p.targetField === field &&
            p.targetRowCode === rowCode)),
    );
    if (allowPerms.length > 0) {
      return allowPerms.some(
        (p) => !p.userId || p.userId === this.currentUserId,
      );
    }

    return true;
  }

  isRowLocked(rowCode: string): boolean {
    return this.permissions.some(
      (p) =>
        p.permissionType === 'LOCK' &&
        p.level === 'ROW' &&
        p.targetRowCode === rowCode,
    );
  }

  getRowStyle = (params: any): Record<string, string> | undefined => {
    if (params.data?._isTypeHeader) return { ...CELL_STYLES.TYPE_HEADER };
    if (params.data?.row_code && this.isRowLocked(params.data.row_code)) {
      return { ...CELL_STYLES.LOCKED_ROW };
    }
    return undefined;
  };

  private calcGroupDepth(groups: ColumnGroupConfig[] = this.columnGroups): number {
    if (!groups || groups.length === 0) return 0;
    let max = 0;
    for (const g of groups) {
      const hasLeaves = (g.columnFields?.length ?? 0) > 0;
      const childDepth = g.children && g.children.length > 0 ? 1 + this.calcGroupDepth(g.children) : 0;
      max = Math.max(max, Math.max(hasLeaves ? 1 : 0, childDepth));
    }
    return max;
  }

  private recalcGridHeight(): void {
    const rowCount = this.rowData.length;
    const depth = this.calcGroupDepth();
    const headerH = depth > 0 ? 48 * (depth + 1) : this.HEADER_HEIGHT;
    const maxHeight = window.innerHeight - 200;
    const contentH =
      headerH + rowCount * this.ROW_HEIGHT + this.SCROLLBAR_HEIGHT;
    this.gridHeight =
      Math.max(this.MIN_HEIGHT, Math.min(maxHeight, contentH)) + 'px';
  }

  recalcValidationErrors(): void {
    const errors: ValidationErrorEntry[] = [];
    this.gridApi?.forEachNode((node) => {
      if (!node.data) return;
      for (const config of this.columnConfigs) {
        if (config.formula) continue;
        const result = this.validateCell(
          config.field,
          node.data[config.field],
          node.data,
        );
        if (!result.valid) {
          errors.push({
            rowCode: node.data.row_code || '',
            rowName: node.data.row_name || node.data.row_code || '',
            field: config.field,
            columnName: config.headerName || config.field,
            message: result.message || 'Giá trị không hợp lệ',
          });
        }
      }
    });
    this.validationErrors = errors;
  }

  onValidationPanelToggle(): void {
    this.validationPanelExpanded = !this.validationPanelExpanded;
  }

  /** Click 1 entry trong panel → focus + ensure visible cell tương ứng. */
  onValidationEntryClick(entry: ValidationErrorEntry): void {
    if (!this.gridApi) return;
    let rowIndex: number | null = null;
    this.gridApi.forEachNode((node) => {
      if (node.data?.row_code === entry.rowCode && rowIndex === null) {
        rowIndex = node.rowIndex ?? null;
      }
    });
    if (rowIndex == null) return;
    this.gridApi.ensureIndexVisible(rowIndex, 'middle');
    this.gridApi.ensureColumnVisible(entry.field, 'middle');
    this.gridApi.setFocusedCell(rowIndex, entry.field);
  }

  // --- Keyboard handler (Backspace/Delete + Ctrl+Z/Y/Shift+Z) ---
  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.classList.contains('ag-cell-edit-input');

    const key = event.key.toLowerCase();
    const code = event.code;

    // Hidden dev/BA shortcut: Ctrl+Alt+C → copy danh sách cột (PRD docs).
    // KHÔNG có UI hint — chỉ dev/BA biết. Skip khi đang edit input/cell.
    if (
      event.ctrlKey &&
      event.altKey &&
      !event.shiftKey &&
      code === 'KeyC' &&
      !isEditing &&
      this.columnConfigs?.length > 0
    ) {
      event.preventDefault();
      this.copyColumnDocsToClipboard();
      return;
    }

    // Hidden dev/BA shortcut: Ctrl+Alt+E → generate file .md tài liệu Nhập/Xuất
    // Excel (template ở assets/docs/import_export.md, thay ${1}/${2}/${3}).
    if (
      event.ctrlKey &&
      event.altKey &&
      !event.shiftKey &&
      code === 'KeyE' &&
      !isEditing &&
      this.columnConfigs?.length > 0
    ) {
      event.preventDefault();
      this.generateImportExportDocFile();
      return;
    }

    // Chỉ phản hồi Undo/Redo khi grid có focused cell (không đụng các component khác)
    const hasFocus = !!this.gridApi?.getFocusedCell();

    // Ctrl + Z (Undo) — không phải Shift
    if (event.ctrlKey && (code === 'KeyZ' || key === 'z') && !event.shiftKey) {
      if (!isEditing && hasFocus) {
        event.preventDefault();
        this.undoRedoService.undo();
      }
      return;
    }
    // Ctrl + Y hoặc Ctrl + Shift + Z (Redo)
    if (
      event.ctrlKey &&
      (code === 'KeyY' || key === 'y' || ((code === 'KeyZ' || key === 'z') && event.shiftKey))
    ) {
      if (!isEditing && hasFocus) {
        event.preventDefault();
        this.undoRedoService.redo();
      }
      return;
    }

    // Bắt phím Backspace hoặc Delete
    const isDeleteKey = key === 'backspace' || key === 'delete' || code === 'Backspace' || code === 'Delete';
    if (isDeleteKey) {
      if (!isEditing) {
        const focusedCell = this.gridApi?.getFocusedCell();
        if (focusedCell) {
          event.preventDefault();
          event.stopPropagation();

          type PendingChange = { node: IRowNode; field: string; oldValue: any };
          const pendingChanges = new Map<string, PendingChange>();
          const displayedColumns = this.gridApi.getAllDisplayedColumns();

          const collectChange = (node: IRowNode, column: Column): void => {
            const field = column.getColId();
            if (!node?.data || field === 'row_code') return;

            const colDef = column.getColDef();
            let isEditable = false;
            if (typeof colDef.editable === 'function') {
              isEditable = (colDef.editable as any)({
                data: node.data,
                node,
                colDef,
                column,
                api: this.gridApi,
                context: null,
              });
            } else {
              isEditable = !!colDef.editable;
            }
            if (!isEditable) return;

            const oldValue = node.data[field];
            if (oldValue === null || oldValue === undefined || oldValue === '') return;
            const key = `${node.rowIndex ?? 'row'}::${field}`;
            pendingChanges.set(key, { node, field, oldValue });
          };

          const b = this.rangeBounds();
          if (b && this.rangeCellCount() > 1) {
            for (let r = b.r0; r <= b.r1; r++) {
              const rowNode = this.gridApi.getDisplayedRowAtIndex(r);
              if (!rowNode) continue;
              for (let c = b.c0; c <= b.c1; c++) {
                const column = displayedColumns[c];
                if (!column) continue;
                collectChange(rowNode, column);
              }
            }
          } else {
            const selectedNodes = this.gridApi.getSelectedNodes();
            const isFocusedRowSelected = selectedNodes.some((n) => n.rowIndex === focusedCell.rowIndex);
            const nodesToClear =
              isFocusedRowSelected && selectedNodes.length > 0
                ? selectedNodes
                : [this.gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex)].filter(
                    (n): n is IRowNode => !!n,
                  );
            nodesToClear.forEach((node) => collectChange(node, focusedCell.column));
            // collectChange tự skip row_code + cell empty + cell uneditable, nên
            // không cần check thừa: pendingChanges.size === 0 sẽ rơi vào nhánh
            // `if (changes.length > 0)` phía dưới bỏ qua tự nhiên.
          }

          const changes = Array.from(pendingChanges.values());
          if (changes.length > 0) {
            const newValue = null;
            const rowNodes = Array.from(new Set(changes.map((ch) => ch.node)));
            const columns = Array.from(new Set(changes.map((ch) => ch.field)));
            const refreshScope = { force: true, rowNodes, columns };

            this.undoRedoService.isBulkOperation = true;
            try {
              changes.forEach((ch) => ch.node.setDataValue(ch.field, newValue));
            } finally {
              this.undoRedoService.isBulkOperation = false;
            }
            this.undoRedoService.pushUndo({
              type: 'cell_delete',
              description: changes.length === 1 ? `Xóa ô ${changes[0].field}` : `Xóa ${changes.length} ô`,
              undo: () => {
                this.undoRedoService.isBulkOperation = true;
                try {
                  changes.forEach((ch) => ch.node.setDataValue(ch.field, ch.oldValue));
                } finally {
                  this.undoRedoService.isBulkOperation = false;
                }
                this.gridApi?.refreshCells(refreshScope);
                this.recalcValidationErrors();
              },
              redo: () => {
                this.undoRedoService.isBulkOperation = true;
                try {
                  changes.forEach((ch) => ch.node.setDataValue(ch.field, newValue));
                } finally {
                  this.undoRedoService.isBulkOperation = false;
                }
                this.gridApi?.refreshCells(refreshScope);
                this.recalcValidationErrors();
              },
            });
            this.recalcValidationErrors();
            this.gridApi.refreshCells(refreshScope);
          }
        }
      }
    }
  }

  onCellValueChanged(event: any): void {
    // Phần PUSH UNDO chỉ track user edit thật (source === 'edit'). AG Grid fires
    // cellValueChanged cho nhiều nguồn: 'edit' (user commit), 'rowData' (setData),
    // 'api', 'undo'/'redo' (AG Grid native — KHÔNG dùng), 'paste' (Enterprise)...
    // Nếu push cho mọi source, undo của chúng ta sẽ push chính nó → loop vô hạn.
    if (
      event.source === 'edit' &&
      !this.undoRedoService.isExecuting &&
      !this.undoRedoService.isBulkOperation
    ) {
      const { node, colDef, oldValue, newValue } = event;
      if (oldValue !== newValue) {
        const field: string = colDef.field || colDef.colId;
        this.undoRedoService.pushUndo({
          type: 'cell_edit',
          description: `Sửa ô ${field}`,
          undo: () => node.setDataValue(field, oldValue),
          redo: () => node.setDataValue(field, newValue),
        });
      }
    }

    // RECALC VALIDATION cho mọi source non-bulk — date picker dùng `setDataValue()` fires
    // source='api' (KHÔNG 'edit'). Skip bulk (paste handler tự gọi recalc cuối flow).
    if (
      !this.undoRedoService.isBulkOperation &&
      this.gridApi &&
      !this.gridApi.isDestroyed()
    ) {
      this.recalcValidationErrors();
      const colId = event.colDef?.field || event.colDef?.colId;
      if (event.node && colId) {
        this.gridApi.refreshCells({ rowNodes: [event.node], columns: [colId], force: true });
      }
      // FORCE clear tooltip popup. AG Grid KHÔNG tự destroy `.ag-tooltip-custom` khi cell
      // refresh — nếu user giữ chuột trên cell vừa đổi value, tooltip vẫn hiện message
      // cũ. Xoá DOM → next hover → AG Grid tạo tooltip mới → agInit chạy với value mới.
      clearActiveTooltip();
    }
  }

  // --- Import Excel (data only — không thêm row mới) ---

  /** Mở dialog chọn file. Submit/cancel xử lý qua `onImportFileSubmit` / `closeImportDialog`. */
  importExcel(): void {
    if (!this.gridApi || !this.canEditRows) {
      this.dialog.warning('Không thể import ở trạng thái hiện tại');
      return;
    }
    this.isImportDialogOpen = true;
  }

  /** User chọn file + bấm "Nhập file" → đóng dialog + chạy import flow. */
  async onImportFileSubmit(file: File | null): Promise<void> {
    this.isImportDialogOpen = false;
    if (!file) return;
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      this.dialog.warning('File quá lớn (tối đa 5MB)');
      return;
    }
    await this.runImport(file);
  }

  /**
   * Tải template Excel kèm rows entry hiện tại (với formula đã resolve về giá trị
   * qua shadow store). Filename = tên biểu mẫu đã resolve placeholder + sanitize.
   * User dùng để xem reference data trước khi sửa offline rồi import lại.
   */
  async onDownloadImportTemplate(): Promise<void> {
    if (this.isDownloadingImportTemplate) return;
    this.isDownloadingImportTemplate = true;
    try {
      const resolved = resolveHeaderName(this.templateName, this.entryYear, this.entryMonth) || 'Báo cáo';
      const fileName = sanitizeFilename(resolved);
      const snapshot = this.snapshotRowDataForExport();
      await this.excelExportService.exportGrid(
        this.columnConfigs,
        this.columnGroups,
        snapshot,
        fileName,
        this.entryYear,
        this.entryMonth,
        resolved,
      );
    } catch (e: any) {
      this.dialog.error('Lỗi tải template: ' + (e.message || e));
    } finally {
      this.isDownloadingImportTemplate = false;
    }
  }

  /**
   * Snapshot `rowData` cho export — overlay formula values từ shadow store.
   * Xem chú thích chi tiết ở `excel-builder.snapshotRowDataForExport`.
   */
  private snapshotRowDataForExport(): any[] {
    if (!this.gridApi) return [...this.rowData];
    return this.rowData.map(row => {
      const out: any = { ...row };
      if (!row.row_code) return out;
      const node = this.gridApi!.getRowNode(String(row.row_code));
      if (!node) return out;
      for (const col of this.columnConfigs) {
        try {
          const v = this.gridApi!.getCellValue({ rowNode: node, colKey: col.field });
          if (v !== undefined) out[col.field] = v;
        } catch { /* AG Grid lifecycle race — fallback row[field] đã có */ }
      }
      return out;
    });
  }

  /** Body chính của import — đọc file, match cells, confirm, apply qua undo/redo. */
  private async runImport(file: File): Promise<void> {
    let result: Awaited<ReturnType<ExcelExportService['importGrid']>>;
    try {
      result = await this.excelExportService.importGrid(
        file, this.columnConfigs, this.columnGroups, this.entryYear, this.entryMonth,
      );
    } catch (e: any) {
      this.dialog.error('Lỗi đọc file: ' + (e.message || e));
      return;
    }

    const { matchedRows, unmatchedCols, rowCodeUnresolved } = result;
    if (matchedRows.length === 0) {
      this.dialog.warning('Không tìm thấy dữ liệu phù hợp trong file');
      return;
    }

    // Entry rowData đã có sẵn row_code từ template — nếu file Excel KHÔNG có cột
    // Mã dòng, fallback match theo POSITION (row Excel thứ N → rowData[N]).
    if (rowCodeUnresolved) this.assignRowCodesByPosition(matchedRows);

    const existingByCode = new Map<string, any>();
    this.rowData.forEach(r => { if (r.row_code) existingByCode.set(r.row_code, r); });
    const applicable = matchedRows.filter(r => r.row_code && existingByCode.has(r.row_code));
    const skipped = matchedRows.length - applicable.length;
    if (applicable.length === 0) {
      this.dialog.warning('Không có mã dòng nào trong file khớp dữ liệu hiện tại');
      return;
    }

    const msg = this.buildImportConfirmMessage(applicable.length, skipped, rowCodeUnresolved, unmatchedCols);
    this.dialog
      .confirm({
        title: 'Import dữ liệu',
        message: msg + '\n\nÁp dụng?',
        status: 'info',
        confirmText: 'Áp dụng',
        cancelText: 'Hủy',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const formulaFields = new Set(
          this.columnConfigs.filter(c => !!c.formula).map(c => c.field),
        );
        const { oldValues, newValues } = this.collectImportChanges(applicable, formulaFields);
        if (newValues.length === 0) {
          this.dialog.info('Không có giá trị nào thay đổi');
          return;
        }
        this.applyBulkImportValues(newValues);
        this.undoRedoService.pushUndo({
          type: 'bulk_import',
          description: `Import ${applicable.length} dòng từ Excel`,
          undo: () => this.applyBulkImportValues(oldValues),
          redo: () => this.applyBulkImportValues(newValues),
        });
        this.dialog.success(`Đã cập nhật ${applicable.length} dòng`);
      });
  }

  /** Gán row_code từ rowData theo thứ tự cho rows import thiếu (rows dư bỏ qua). */
  private assignRowCodesByPosition(matchedRows: any[]): void {
    const orderedExisting = this.rowData.filter(r => r.row_code);
    matchedRows.forEach((row, idx) => {
      if (idx < orderedExisting.length) row.row_code = orderedExisting[idx].row_code;
    });
  }

  private buildImportConfirmMessage(
    applicableCount: number,
    skipped: number,
    rowCodeUnresolved: boolean,
    unmatchedCols: string[],
  ): string {
    let msg = `Sẽ cập nhật ${applicableCount} dòng.`;
    if (rowCodeUnresolved) {
      msg += `\n(File không có cột Mã dòng — match theo thứ tự dòng)`;
    }
    if (skipped > 0) {
      const reason = rowCodeUnresolved ? 'vượt quá số dòng hiện tại' : 'mã dòng không tồn tại';
      msg += `\nBỏ qua ${skipped} dòng (${reason}).`;
    }
    if (unmatchedCols.length > 0) {
      msg += `\nCột không match: ${unmatchedCols.join(', ')}`;
    }
    return msg;
  }

  /** Snapshot diff giữa rows import và rowData hiện tại — pure, KHÔNG mutate grid. */
  private collectImportChanges(
    applicable: any[],
    formulaFields: Set<string>,
  ): { oldValues: ImportValueChange[]; newValues: ImportValueChange[] } {
    const oldValues: ImportValueChange[] = [];
    const newValues: ImportValueChange[] = [];
    for (const imported of applicable) {
      const node = this.findNodeByRowCode(imported.row_code);
      if (!node) continue;
      for (const [field, val] of Object.entries(imported)) {
        if (field === 'row_code') continue;
        if (formulaFields.has(field)) continue;
        const oldVal = node.data ? node.data[field] : undefined;
        if (oldVal === val) continue;
        oldValues.push({ rowCode: imported.row_code, field, value: oldVal });
        newValues.push({ rowCode: imported.row_code, field, value: val });
      }
    }
    return { oldValues, newValues };
  }

  private findNodeByRowCode(code: string): IRowNode | null {
    let found: IRowNode | null = null;
    this.gridApi.forEachNode((n) => {
      if (n.data?.row_code === code) found = n;
    });
    return found;
  }

  /** Apply bulk values qua setDataValue (fire cellValueChanged → formula recompute). */
  private applyBulkImportValues(items: ImportValueChange[]): void {
    this.undoRedoService.isBulkOperation = true;
    try {
      for (const it of items) {
        const node = this.findNodeByRowCode(it.rowCode);
        if (node) node.setDataValue(it.field, it.value);
      }
    } finally {
      this.undoRedoService.isBulkOperation = false;
    }
    this.recalcValidationErrors();
    this.gridApi.refreshCells({ force: true });
  }

  // --- Save Entry ---

  saveEntry(): void {
    if (!this.templateId || !this.entryId) return;
    // Chặn lưu trong khi entry đang load — formula context/lookup cache chưa sẵn
    // sàng thì snapshot giá trị công thức sẽ thiếu, làm LOOKUP cross-entry sau
    // đó đọc không ra data.
    if (this.loading) return;
    this.saving = true;

    const templateId = this.templateId;
    const entryId = this.entryId;

    this.ensureLookupCacheReady$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Force-recompute toàn bộ formula trước khi snapshot — đảm bảo shadow store
        // chứa value mới nhất cho mọi cell có formula. Nếu skip, valueGetter trả
        // `undefined` cho key chưa từng tồn tại trong rowData → serializeEntryData
        // bỏ qua key đó → DB rowData thiếu giá trị → LOOKUP cross-entry từ báo cáo
        // khác đọc null → cell hiển thị blank. Cost ~10-50ms cho template lớn.
        this.formulaGraph.recomputeAll();

        const entryRows = this.serializeEntryData();
        const rowDataJson = JSON.stringify(entryRows);

        this.gridTemplateService
          .updateEntry(templateId, entryId, {
            rowData: rowDataJson,
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.saving = false;
              this.dataLookupService.invalidateCache();
              this.unsyncedFormulasDetected = false;
              this.dialog.success('Lưu dữ liệu thành công!');
            },
            error: (err) => {
              this.saving = false;
              this.dialog.error(
                'Lỗi lưu: ' + (err.error?.message || err.message),
              );
            },
          });
      });
  }

  /**
   * Save phiên bản silent — dùng cho auto-sync sau load. KHÔNG show success toast
   * để không gây nhiễu UX. Chỉ show error nếu fail. Bypass `loading` check vì
   * gọi từ load flow (entry vừa load xong, loading = false ngay trước khi gọi).
   */
  private saveEntrySilent(): void {
    if (!this.templateId || !this.entryId) return;
    if (this.saving) return;
    this.saving = true;

    const templateId = this.templateId;
    const entryId = this.entryId;

    this.ensureLookupCacheReady$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.formulaGraph.recomputeAll();
        const entryRows = this.serializeEntryData();
        const rowDataJson = JSON.stringify(entryRows);

        this.gridTemplateService
          .updateEntry(templateId, entryId, { rowData: rowDataJson })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.saving = false;
              this.dataLookupService.invalidateCache();
              this.unsyncedFormulasDetected = false;
              console.info(
                '[auto-sync] Đã đồng bộ giá trị công thức để báo cáo khác đọc được.',
              );
            },
            error: () => {
              // Silent: không hiển dialog vì user không chủ động trigger save.
              this.saving = false;
            },
          });
      });
  }

  /**
   * Detect formula cell có shadow value khác với value đã persist trong rowData
   * → cần save lại để LOOKUP cross-entry đọc đúng. Skip:
   *   - Cell không có formula (column-level lẫn cell-level).
   *   - Shadow value là error code (`#NOTEMPLATE!`, `#REF!`...) — không persist
   *     để giữ trạng thái cho lần load sau retry.
   *   - Shadow undefined (formula chưa eval — chưa nên save).
   *
   * Trả `true` ngay khi gặp 1 cell mismatch — không cần đếm hết.
   */
  private hasUnpersistedFormulaValues(): boolean {
    if (!this.gridApi || this.gridApi.isDestroyed()) return false;
    let found = false;
    // DEBUG: log mọi mismatch để tìm root cause auto-sync fire mỗi lần mở entry.
    const mismatches: Array<{
      row: string;
      field: string;
      persisted: unknown;
      shadow: unknown;
      pType: string;
      sType: string;
    }> = [];
    this.gridApi.forEachNode((node) => {
      if (!node.data) return;
      const rowCode = node.data.row_code;
      if (!rowCode) return;
      for (const config of this.columnConfigs) {
        const cellCfg = node.data._cellConfig?.[config.field];
        const hasFormula = !!config.formula || !!cellCfg?.formula;
        if (!hasFormula) continue;
        const shadowVal = this.formulaGraph.getValue(rowCode, config.field);
        if (shadowVal === undefined) continue;
        if (typeof shadowVal === 'string' && shadowVal.startsWith('#')) continue;
        const persisted = node.data[config.field];
        if (persisted !== shadowVal) {
          found = true;
          mismatches.push({
            row: rowCode,
            field: config.field,
            persisted,
            shadow: shadowVal,
            pType: persisted === null ? 'null' : typeof persisted,
            sType: shadowVal === null ? 'null' : typeof shadowVal,
          });
        }
      }
    });
    if (mismatches.length > 0) {
      console.group(`[auto-sync] ${mismatches.length} cell mismatch(es)`);
      console.table(mismatches);
      console.groupEnd();
    }
    return found;
  }

  /**
   * Banner cảnh báo "entry có formula chưa đồng bộ với DB" — chỉ hiện cho user
   * KHÔNG có quyền edit (`!canEditRows`). User edit được sẽ tự auto-sync xử lý.
   * Recompute tại các điểm: sau load (`finishLoad`), sau save success
   * (`saveEntry`/`saveEntrySilent`). Dùng làm flag thay vì gọi method trong
   * template để tránh re-evaluate mỗi CD cycle.
   */
  unsyncedFormulasDetected = false;

  private refreshUnsyncedFormulaState(): void {
    this.unsyncedFormulasDetected = this.hasUnpersistedFormulaValues();
  }

  /**
   * Auto-sync sau khi entry load xong: nếu formula cell có shadow value khác
   * value persisted (vd entry tạo lần đầu, hoặc save trước khi formula được
   * thêm) → silent save để LOOKUP cross-entry hoạt động đúng. Chạy 1 lần per
   * load, gated bởi `pendingAutoSync` flag + status editable.
   *
   * KHÔNG gate `isReportMode` — entry editable mở qua route `/report/...`
   * (vd dialog tạo entry navigate sang URL hiện tại) cũng cần auto-sync để
   * báo cáo phụ thuộc đọc đúng giá trị, không bắt NSD bấm Lưu thủ công.
   */
  private pendingAutoSync = false;

  private tryAutoSyncFormulas(): void {
    if (!this.pendingAutoSync) return;
    if (this.viewMode !== 'entry') return;
    if (this.loading || this.saving) return;
    if (!this.canEditRows) return;
    if (!this.gridApi || this.gridApi.isDestroyed()) return;
    if (this.pendingFormulaRebuild) return;
    if (!this.hasUnpersistedFormulaValues()) {
      this.pendingAutoSync = false;
      return;
    }
    this.pendingAutoSync = false;
    this.saveEntrySilent();
  }

  /**
   * Đảm bảo mọi LookupData mà các công thức trong entry cần đã có trong cache
   * trước khi snapshot được tính. Nếu user bấm Lưu trước khi preload ban đầu
   * hoàn tất, hoặc năm/tháng thay đổi từ lúc load, hàm này sẽ fetch phần thiếu
   * rồi mới emit.
   */
  private ensureLookupCacheReady$(): Observable<void> {
    return this.formulaCoordinator.ensureLookupCacheReady$({
      gridApi: this.gridApi,
      columnConfigs: this.columnConfigs,
      year: this.entryYear,
      month: this.entryMonth,
    });
  }

  /**
   * Serialize toàn bộ row state vào entry.rowData (snapshot độc lập với template):
   *  - row_code, row_name, sortOrder hiện tại
   *  - flag _isTypeHeader, _catalogField, _isCustomRow nếu có
   *  - _cellConfig (format/cellConfig do user override ở Render)
   *  - cell values (qua valueGetter — persist cả formula result)
   * Cách này đảm bảo template thay đổi ở Builder KHÔNG ảnh hưởng entry đã tạo.
   */
  private serializeEntryData(): any[] {
    const rows: any[] = [];
    let idx = 0;
    this.gridApi?.forEachNode((node) => {
      if (!node.data) return;
      const d = node.data;
      const row: any = {
        row_code: d.row_code,
        _sortOrder: idx++,
      };
      if (d.row_name !== undefined) row.row_name = d.row_name;
      if (d._isTypeHeader) row._isTypeHeader = true;
      if (d._catalogField) row._catalogField = d._catalogField;
      if (d._isCustomRow) row._isCustomRow = true;
      if (d._cellConfig) row._cellConfig = d._cellConfig;
      for (const config of this.columnConfigs) {
        const val = this.getPersistedCellValue(node, config);
        if (val !== undefined) row[config.field] = val;
      }
      rows.push(row);
    });
    return rows;
  }

  /**
   * Snapshot giá trị hiệu lực của cell tại thời điểm lưu.
   * Ưu tiên valueGetter để persist cả formula column và cell formula override.
   * Nếu cell đang lỗi công thức (#REF!, #NODATA!...) thì không ghi đè snapshot.
   */
  private getPersistedCellValue(node: IRowNode, config: ColumnConfig): any {
    const rawValue = node.data?.[config.field];
    const column = this.gridApi
      ?.getColumns()
      ?.find((col) => col.getColDef().field === config.field);

    if (!column) {
      return rawValue;
    }

    const colDef = column.getColDef();
    let value = rawValue;

    if (typeof colDef.valueGetter === 'function' && this.gridApi) {
      try {
        value = colDef.valueGetter({
          api: this.gridApi,
          column,
          colDef,
          context: null,
          data: node.data,
          getValue: (field: string) => node.data?.[field],
          node,
        } as any);
      } catch {
        value = rawValue;
      }
    }

    if (typeof value === 'string' && value.startsWith('#')) {
      const hasFormula =
        !!config.formula || !!node.data?._cellConfig?.[config.field]?.formula;
      return hasFormula ? undefined : rawValue;
    }

    return value;
  }

  // ============================
  // COPY / PASTE (Phase 1 — paste từ Excel/clipboard TSV vào grid)
  // ============================

  private readonly pasteHighlight: PasteHighlightHandle = createPasteHighlight({
    styleId: 'paste-skip-highlight-style',
    animationName: 'render-paste-skip-flash',
  });

  private readonly rangeSelectionSvc = inject(RangeSelectionService);
  private readonly pasteHandler = inject(PasteHandlerService);
  private readonly formatClipboard = inject(FormatClipboardService);

  private rangeBounds() {
    return this.rangeSelectionSvc.bounds();
  }

  private rangeCellCount(): number {
    return this.rangeSelectionSvc.cellCount();
  }

  private clearRangeSelection(): void {
    this.rangeSelectionSvc.clear();
  }

  private serializeRangeAsTsv(): string {
    const b = this.rangeBounds();
    if (!b || !this.gridApi) return '';
    return serializeTsv(this.gridApi, b);
  }

  private getFormattedCellText(node: IRowNode, column: Column): string {
    return getFmtCellText(this.gridApi, node, column);
  }

  /**
   * Handler (copy) — user Ctrl+C trên focused cell → ghi formatted value
   * vào clipboard. Dùng `valueFormatter` của colDef để có cùng định dạng như
   * hiển thị (số có dấu phân cách, date dd/MM/yyyy...) — đảm bảo paste lại
   * vào grid hay Excel đều round-trip chuẩn.
   *
   * Không intercept nếu user đang edit cell hoặc đang có text-selection
   * (cho phép default copy chạy như bình thường).
   */
  handleGridCopy(event: ClipboardEvent): void {
    if (!this.gridApi) return;

    const target = event.target as HTMLElement;
    if (
      target?.closest(
        '.ag-cell-inline-editing, .ag-popup-editor, input, textarea, [contenteditable="true"]',
      )
    ) {
      return;
    }

    // Nếu user đang bôi đen text trong cell (chưa focus cell theo AG Grid),
    // để native copy chạy.
    const sel = document.getSelection();
    if (sel && sel.toString().length > 0) return;

    // 1. Copy range (drag select nhiều ô) — ưu tiên
    if (this.rangeCellCount() > 1) {
      const b = this.rangeBounds();
      const tsv = this.serializeRangeAsTsv();
      if (tsv && b) {
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData?.setData('text/plain', tsv);
        // Buffer in-memory: capture format snapshot để paste khôi phục
        const formats = captureFormatRange(this.gridApi, b);
        this.formatClipboard.set({
          tsv,
          rows: b.r1 - b.r0 + 1,
          cols: b.c1 - b.c0 + 1,
          formats,
        });
      }
      return;
    }

    // 2. Copy single cell (focused)
    const focused = this.gridApi.getFocusedCell();
    if (!focused) return;

    const rowNode = this.gridApi.getDisplayedRowAtIndex(focused.rowIndex);
    if (!rowNode) return;

    const text = this.getFormattedCellText(rowNode, focused.column);
    event.preventDefault();
    event.stopPropagation();
    event.clipboardData?.setData('text/plain', text);
    const fmt = rowNode.data?._cellConfig?.[focused.column.getColId()]?.format;
    this.formatClipboard.set({
      tsv: text,
      rows: 1,
      cols: 1,
      formats: [[fmt ? { ...fmt } : null]],
    });
  }

  handleGridPaste(event: ClipboardEvent): Promise<void> {
    return this.pasteHandler.handlePaste(event);
  }

  private clearPasteHighlight(): void {
    this.pasteHighlight.clear();
  }
}

