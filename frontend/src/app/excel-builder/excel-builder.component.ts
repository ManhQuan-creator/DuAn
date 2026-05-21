import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HasUnsavedChanges } from '../shared/unsaved-changes.guard';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  ColGroupDef,
  Column,
  ColumnResizedEvent,
  EditableCallbackParams,
  GridApi,
  GridReadyEvent,
  IRowNode,
  RowDragCallbackParams,
  ValueGetterParams,
  ValueSetterParams,
} from 'ag-grid-community';
import {
  Subject,
  takeUntil,
} from 'rxjs';

// TAIGA UI v3
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiGroupModule,
  TuiRootModule,
  TuiSvgModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import {
  TuiCheckboxLabeledModule,
  TuiCheckboxModule,
  TuiInputModule,
  TuiMultiSelectModule,
  TuiRadioBlockModule,
  TuiSelectModule,
  TuiTextAreaModule,
  TuiBadgeModule,
  TuiFilterByInputPipeModule
} from '@taiga-ui/kit';

import { DataHeaderComponent, DateCellRenderer, DropdownCellRenderer, FormulaCellRendererComponent, RowCodeCellRendererComponent, cellAddressOf } from './renderers';
import { AuthService } from '../auth/auth.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { AppDialogService } from '../shared/dialog.service';
import { LoadingService } from '../shared/loading.service';
import {
  COLUMN_MIN_WIDTH,
  DEFAULT_COLUMN_WIDTH,
} from '../shared/utils/grid-column.constants';
import { CELL_STYLES, cellFormatStyle, cellColSpan } from '../shared/utils/cell-styles.const';
import {
  FormatToolbarComponent,
  type FormatChangeEvent,
} from '../shared/components/format-toolbar';
import {
  WorkflowDefinitionListItem,
  WorkflowDefinitionService,
} from '../workflow-manager/workflow-definition.service';
import { CatalogItem } from './models/catalog.data';
import { CatalogService } from '../catalog-manager/service/catalog.service';
import { SidebarMenuOption, SidebarMenuService } from '../shared/sidebar-menu.service';
import { ExcelExportService, sanitizeFilename } from './service/excel-export.service';
import { ImportFileDialogComponent } from '../shared/components/import-file-dialog/import-file-dialog.component';
import { FormulaTooltipComponent } from './utils/formula-tooltip.component';
import { resolveHeaderName } from './utils/dynamic-header.util';
import { nextRowCodes } from './utils/next-row-code.util';
import { getRowKind } from './utils/row-kind.util';
import { FormulaService } from './service/formula.service';
import { FormulaGraphService } from './service/formula-graph.service';
import { FormulaCoordinatorService } from './service/formula-coordinator.service';
import { GridPermissionService } from './service/grid-permission.service';
import { GridTemplateService } from './service/grid-template.service';
import { GridTemplateListItem } from './models/grid-template.model';
import { AdvancedSettingsDialogComponent, AdvancedSettingsDialogData } from './dialogs/advanced-settings-dialog/advanced-settings-dialog.component';
import { TuiLoaderModule } from '@taiga-ui/core';

import { PermissionTemplateDialogComponent } from './dialogs/permission-template-dialog/permission-template-dialog.component';
import { TemplateButtonManagerDialogComponent } from './dialogs/template-button-manager-dialog/template-button-manager-dialog.component';
import { AddRowDialogComponent, AddRowResult, TargetFieldOption } from './dialogs/add-row-dialog/add-row-dialog.component';
import { uniqueRowCode } from './utils/random-suffix.util';
import { SaveTemplateDialogComponent, SaveTemplateResult } from './dialogs/save-template-dialog/save-template-dialog.component';
import { OpenTemplateDialogComponent } from './dialogs/open-template-dialog/open-template-dialog.component';
import { CellConfigDialogComponent, CellConfigInput, CellConfigResult } from './dialogs/cell-config-dialog/cell-config-dialog.component';
import { ColumnGroupDialogComponent } from './dialogs/column-group-dialog/column-group-dialog.component';
import { UndoRedoService } from './service/undo-redo.service';
import { UndoAction } from '../shared/models/undo-redo.model';
// parseTsv + applyPaste đã được di chuyển vào shared/grid-core/paste-handler.service.ts.
// SkippedCell type giữ lại nếu component cần expose handle highlight tương lai.
import { ColumnConfigDialogComponent, ColumnConfigEditData, ColumnConfigResult } from './dialogs/column-config-dialog/column-config-dialog.component';
import { BuilderFormulaHelpComponent } from './components/builder-formula-help/builder-formula-help.component';
import {
  ValidationErrorPanelComponent,
  ValidationErrorEntry,
} from '../shared/components/validation-error-panel/validation-error-panel.component';
import {
  GridPermission,
  GridPermissionRequest,
} from './models/grid.permission.model';
import { CatalogTypeItem } from '../catalog-manager/models/catalog.model';
import {
  formatIsoDate as fmtIsoDate,
  formatCellValue as fmtCellValue,
  parseNumberInputForCell,
  cellPresetStyle as resolveCellPresetStyle,
  BUILDER_ERROR_STYLE,
  getFormattedCellText as getFmtCellText,
  serializeRangeAsTsv as serializeTsv,
  createPasteHighlight,
  RangeSelectionService,
  validateCellValue,
  showPasteResultToast as showToast,
  preloadDropdownCatalogsForPaste as preloadCatalogs,
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
} from '../shared/grid-core';

export interface CellValidation {
  required?: boolean;
  min?: number;
  max?: number;
  type?: 'number' | 'text' | 'date';
  minDate?: string; // ISO 'YYYY-MM-DD'
  maxDate?: string;
  pattern?: string;
  errorMessage?: string;
}

export interface ColumnConfig {
  headerName: string;
  field: string;
  excelCol?: string;
  formula?: string;
  width?: number;
  dataType?: 'number' | 'text' | 'date';
  validation?: CellValidation;
}

export type ColumnGroupItem =
  | { type: 'field'; field: string }
  | { type: 'group'; groupId: string };

export interface ColumnGroupConfig {
  groupId: string;
  headerName: string;
  columnFields: string[]; // cột lá trực tiếp
  children?: ColumnGroupConfig[]; // sub-groups
  /** Thứ tự render xen kẽ giữa lá và sub-group. Mỗi entry tham chiếu vào columnFields hoặc children. */
  items?: ColumnGroupItem[];
  marryChildren?: boolean;
}

/** Đồng bộ `items` với columnFields + children. Loại entry không hợp lệ, append entry còn thiếu. */
export function reconcileColumnGroupItems(group: ColumnGroupConfig): void {
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

/** Item đã flatten để render cây trong template */
export interface FlatGroupItem {
  group: ColumnGroupConfig;
  depth: number;
  path: string[]; // mảng groupId từ root → node
  hasChildren: boolean;
  hasLeaves: boolean;
  leafCount: number;
  isExpanded: boolean;
}

// interface UndoAction (removed, now in shared model)

@Component({
  selector: 'app-excel-builder',
  standalone: true,
  imports: [
    TuiFilterByInputPipeModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TuiRootModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiGroupModule,
    TuiSvgModule,
    TuiMultiSelectModule,
    TuiRadioBlockModule,
    TuiCheckboxModule,
    TuiCheckboxLabeledModule,
    TuiInputModule,
    TuiTextAreaModule,
    TuiSelectModule,
    AgGridWrapperComponent,
    AdvancedSettingsDialogComponent,
    PermissionTemplateDialogComponent,
    TemplateButtonManagerDialogComponent,
    AddRowDialogComponent,
    SaveTemplateDialogComponent,
    OpenTemplateDialogComponent,
    CellConfigDialogComponent,
    ColumnGroupDialogComponent,
    ColumnConfigDialogComponent,
    TuiLoaderModule,
    TuiBadgeModule,
    FormatToolbarComponent,
    BuilderFormulaHelpComponent,
    ValidationErrorPanelComponent,
    ImportFileDialogComponent,
  ],
  providers: [UndoRedoService, RangeSelectionService, PasteHandlerService],
  templateUrl: './excel-builder.component.html',
  styleUrls: ['./excel-builder.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ExcelBuilderComponent implements OnInit, OnDestroy, HasUnsavedChanges {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  gridApi!: GridApi;
  private destroy$ = new Subject<void>();
  itemTypes: string[] = [];
  controlItemType = new FormControl<string[]>([]);
  reportDepartmentOptions: CatalogItem[] = [];
  /** Options cho dropdown "Nhóm chức năng báo cáo" — lấy từ bảng SIDEBAR_MENU. */
  sidebarMenuOptions: SidebarMenuOption[] = [];
  private catalogService = inject(CatalogService);
  private sidebarMenuService = inject(SidebarMenuService);

  catalogTypes: CatalogTypeItem[] = [];
  columnConfigs: ColumnConfig[] = [];
  editingColumnIndex: number | null = null;
  readonly stringifyCatalogType = (item: CatalogTypeItem): string => item.name;

  rowData: any[] = [];
  gridColDefs: (ColDef | ColGroupDef)[] = [];
  colMap: { [key: string]: string } = {};

  /** Default colDef từ shared — xem `DEFAULT_DATA_GRID_COL_DEF`. */
  readonly gridDefaultColDef = DEFAULT_DATA_GRID_COL_DEF;

  /**
   * Formula engine kiến trúc Excel: dependency graph + topological sort + shadow store.
   * Xem `formula-graph.service.ts`. valueGetter chỉ đọc shadow O(1), không recursion.
   *
   * Phải gọi `rebuildFormulaGraph()` sau bất kỳ thay đổi nào ảnh hưởng topology graph:
   * load template, cell config save, add/delete row, delete column.
   */
  private formulaGraph = inject(FormulaGraphService);
  private pendingFormulaRebuild = false;

  /**
   * Rebuild graph + recompute mọi formula cells. Idempotent — gọi nhiều lần OK.
   *
   * Defensive 1: nếu `gridApi` chưa available (load flow chạy trước onGridReady),
   * set pending flag và return → onGridReady sẽ chạy lại khi grid ready.
   *
   * Defensive 2: explicit `setGridOption('columnDefs', ...)` để AG Grid có
   * columnDefs mới NGAY (bypass Angular Input propagation chậm hơn 1 microtask).
   */
  private rebuildFormulaGraph(): void {
    // Pending flag GIỮ Ở COMPONENT — service trả false khi grid chưa ready, component
    // tự mark pending để `onGridReady` flush lại. Service stateless → an toàn cross-tab.
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
   * Set entry context cho FormulaService/FormulaGraph dựa trên previewYear/previewMonth.
   *
   * Builder không có entry cụ thể → context để designer xem preview kết quả GETDATA/LOOKUP.
   * BẮT BUỘC set lại mỗi lần load (ngay cả khi previewYear không đổi) để tránh stale leak từ
   * ExcelRender (FormulaService là singleton, context render trước có thể vẫn còn).
   */
  private setupBuilderFormulaContext(): void {
    this.formulaCoordinator.setupContext(this.previewYear, this.previewMonth ?? null);
  }

  /**
   * User đổi năm/tháng preview ở toolbar → re-resolve dynamic placeholder
   * (`${N}`, `${M}`, etc.) trong header cột + entry context cho formula. Cần thiết khi
   * import Excel: file Excel đã ghi header resolved theo năm/tháng lúc export → user
   * phải khớp context để match cột.
   */
  onPreviewPeriodChange(): void {
    this.setupBuilderFormulaContext();
    this.buildGridDefinitions();
    this.gridApi?.refreshHeader();
  }

  /**
   * Quét toàn bộ formula trong columnConfigs + cellConfig → batchLookup GETDATA/LOOKUP cần preload,
   * rồi gọi `then` (typically rebuildFormulaGraph). Đảm bảo cache hot trước khi eval lần đầu.
   *
   * KHÔNG bỏ qua khi list rỗng — vẫn gọi `then` để load tiếp tục.
   */
  private preloadBuilderGetdataAndThen(then: () => void): void {
    this.formulaCoordinator.preloadGetdataAndThen(
      {
        columnConfigs: this.columnConfigs,
        rowData: this.rowData,
        year: this.previewYear,
        month: this.previewMonth ?? null,
        destroy$: this.destroy$,
      },
      then,
    );
  }
  gridHeight = '900px';
  private readonly ROW_HEIGHT = 36;
  private readonly HEADER_HEIGHT = 48;
  private readonly MIN_HEIGHT = 300;
  private readonly SCROLLBAR_HEIGHT = 17;

  // Column Groups
  columnGroups: ColumnGroupConfig[] = [];

  /** Năm dùng để preview placeholder ${N±x} trong tên cột — designer thấy kết quả thực tế. */
  previewYear = new Date().getFullYear();
  /** Tháng dùng để preview placeholder ${M±x} trong tên cột */
  previewMonth = new Date().getMonth() + 1;

  //dialog edit name
  isAdvancedSettingsOpen = false;
advancedSettingsData: AdvancedSettingsDialogData = {
  code: '',
  name: '',
  processDefinitionKey: null,
  reportDepartments: [],
  reportFcGroups: [],
  periodType: 'MONTH',
  useDueDate: false,
};

  //dialog permission template
  isPermDialogOpen = false;

  //dialog template button manager
  isButtonDialogOpen = false;

  // New dialog flags (Phase 2)
  isColumnConfigDialogOpen = false;
  columnConfigEditData: ColumnConfigEditData | null = null;
  isAddRowDialogOpen = false;
  isCellConfigDialogOpen = false;
  cellConfigInput: CellConfigInput | null = null;
  isColumnGroupDialogOpen = false;
  isSaveDialogOpen = false;
  isOpenDialogOpen = false;

  // Cell Config state (shared with dialog)
  private editingCell: { rowNode: IRowNode; field: string } | null = null;
  cellDropdownItems: CatalogItem[] = [];
  cellDropdownLoading = false;
  dropdownItemsCache = new Map<string, string[]>();
  formulaValidation: {
    valid: boolean;
    error?: string;
    references?: string[];
  } | null = null;

  /**
   * MEMOIZED getters — Angular CD đánh giá template binding thường xuyên (mỗi tick).
   * Getter trả mảng mới mỗi lần → child component (dialog với @Input) thấy ref đổi
   * → ngOnChanges fire vô tận → CD storm → freeze browser.
   * Cache theo content hash; cùng nội dung → trả CÙNG reference.
   */
  private _existingFieldsCache: string[] = [];
  private _existingFieldsHash = '';
  get existingFields(): string[] {
    const hash = this.columnConfigs.map(c => c.field).join('|');
    if (hash === this._existingFieldsHash) return this._existingFieldsCache;
    this._existingFieldsHash = hash;
    this._existingFieldsCache = this.columnConfigs.map(c => c.field);
    return this._existingFieldsCache;
  }

  private _existingRowCodesCache: string[] = [];
  private _existingRowCodesHash = '';
  get existingRowCodes(): string[] {
    const hash = this.rowData.map(r => r?.row_code ?? '').join('|');
    if (hash === this._existingRowCodesHash) return this._existingRowCodesCache;
    this._existingRowCodesHash = hash;
    this._existingRowCodesCache = this.rowData
      .map(r => r?.row_code)
      .filter((c: string) => !!c);
    return this._existingRowCodesCache;
  }

  private _targetFieldOptionsCache: TargetFieldOption[] = [];
  private _targetFieldOptionsHash = '';
  get targetFieldOptions(): TargetFieldOption[] {
    const hash = this.columnConfigs
      .map(c => `${c.field}|${c.headerName}|${c.formula ?? ''}|${c.dataType ?? ''}`)
      .join(',');
    if (hash === this._targetFieldOptionsHash) return this._targetFieldOptionsCache;
    this._targetFieldOptionsHash = hash;
    this._targetFieldOptionsCache = this.columnConfigs
      .filter(c => !c.formula && c.dataType !== 'date')
      .map(c => ({ field: c.field, headerName: c.headerName }));
    return this._targetFieldOptionsCache;
  }

  // Dirty tracking — snapshot of saved state for unsaved-changes detection
  private savedStateSnapshot = '';

  // (Undo/Redo managed by UndoRedoService)

  // Template persistence (10.1)
  private gridTemplateService = inject(GridTemplateService);
  private route = inject(ActivatedRoute);
  currentTemplateId: number | null = null;
  currentTemplateName = '';

  /** Tên biểu mẫu sau khi thay placeholder ${N±x} theo previewYear — hiển thị ở title. */
  get resolvedTemplateName(): string {
    return resolveHeaderName(this.currentTemplateName, this.previewYear, this.previewMonth);
  }

  formulaHelpVisible = false;
  templateList: GridTemplateListItem[] = [];
  templateSaving = false;
  templateLoading = false;

  /** Dialog import Excel — bind two-way với <app-import-file-dialog>. */
  isImportDialogOpen = false;
  isDownloadingImportTemplate = false;
  // Save/Open dialog state managed by dialog components

  // Workflow (process definition)
  private workflowService = inject(WorkflowDefinitionService);
  deployedWorkflows: WorkflowDefinitionListItem[] = [];
  selectedProcessKey: string | null = null;
  selectedReportDepartments: string[] = [];
  selectedReportFcGroups: string[] = [];

  // Permissions (10.9)
  private gridPermissionService = inject(GridPermissionService);
  private appDialog = inject(AppDialogService);
  private loadingService = inject(LoadingService);
  permissions: GridPermission[] = [];
  private readonly authService = inject(AuthService);
  private undoRedoService = inject(UndoRedoService);
  get currentUserId(): string {
    return this.authService.currentUser?.username || '';
  }
  private cdr = inject(ChangeDetectorRef);
  private formulaCoordinator = inject(FormulaCoordinatorService);
  constructor(
    private formulaService: FormulaService,
    private excelExportService: ExcelExportService,
  ) {}

  ngOnInit(): void {
    this.loadCatalogTypes();
    this.buildGridDefinitions();
    this.loadDeployedWorkflows();


    // Lắng nghe thay đổi filter danh mục
    this.controlItemType.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((selected) => {
        this.applyItemTypeFilter(selected || []);
      });

    // Support opening template via ?templateId= query param
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const templateId = params['templateId'];
        if (templateId) {
          this.loadTemplateById(+templateId);
        }
      });

  }

  ngOnDestroy() {
    this.clearPasteHighlight();
    this.rangeSelectionSvc.detach();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.getCurrentStateSnapshot() !== this.savedStateSnapshot;
  }

  private getCurrentStateSnapshot(): string {
    const rows = this.serializeRows();
    return JSON.stringify({
      columnConfigs: this.columnConfigs,
      columnGroups: this.columnGroups,
      rows,
      processDefinitionKey: this.selectedProcessKey,
      reportDepartments: this.selectedReportDepartments,
      reportFcGroups: this.selectedReportFcGroups,
    });
  }

  /**
   * Snapshot trạng thái "đã lưu" để so sánh phát hiện thay đổi chưa lưu.
   * Phải đợi `gridApi` ready vì serializeRows() đọc từ AG Grid nodes — nếu gọi
   * trước khi grid khởi tạo xong sẽ snapshot ra rows = [], gây false positive
   * "thay đổi chưa lưu" sau đó.
   */
  saveSavedStateSnapshot(): void {
    if (!this.gridApi) {
      this.pendingSnapshotSave = true;
      return;
    }
    this.savedStateSnapshot = this.getCurrentStateSnapshot();
    this.pendingSnapshotSave = false;
  }

  private pendingSnapshotSave = false;

private loadCatalogTypes(): void {
  // Load catalog types cho các dialog cấu hình cột
  this.catalogService
    .getCatalogTypes()
    .pipe(takeUntil(this.destroy$))
    .subscribe((types) => {
      this.catalogTypes = types;

    });

  this.catalogService
    .getCatalogs('REPORT_DEPARTMENT')
    .pipe(takeUntil(this.destroy$))
    .subscribe((items) => {
      this.reportDepartmentOptions = items;
    });

  this.sidebarMenuService
    .getMenuOptionsForFcGroup()
    .pipe(takeUntil(this.destroy$))
    .subscribe((options) => {
      this.sidebarMenuOptions = options;
      this.itemTypes = options.map((o) => o.label);
    });
}

  /** Row style: type header rows get subtle background; row bị khóa quyền có nền xám. */
  getRowStyle = (params: any): Record<string, string> | undefined => {
    if (params.data?._isTypeHeader) return { ...CELL_STYLES.TYPE_HEADER };
    if (params.data?.row_code && this.isRowLocked(params.data.row_code)) {
      return { ...CELL_STYLES.LOCKED_ROW };
    }
    return undefined;
  };

  // === TOOLBAR FORMAT — bind cho <app-format-toolbar> ===

  @ViewChild('formatToolbar') formatToolbar?: FormatToolbarComponent;

  /** Bind làm input cho toolbar; arrow để giữ `this` khi truyền callback. */
  rangeBoundsFn = () => this.rangeBounds();

  /**
   * Toolbar phát event sau mỗi thao tác format/merge → snapshot trạng thái lưu
   * + push undo gộp qua shared helper. `afterApplyNode` sync local rowData[]
   * (Builder mới có; Render = undefined).
   */
  onFormatChanged(payload: FormatChangeEvent): void {
    this.saveSavedStateSnapshot();
    if (!payload?.changes?.length) return;
    pushFormatUndoAction({
      changes: payload.changes,
      gridApi: this.gridApi,
      undoBridge: this.undoRedoService,
      afterApplyNode: (n) => this.syncRowData(n),
    });
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.formulaService.setGridApi(params.api);
    // Nếu load flow đã gọi rebuildFormulaGraph trước khi grid ready, giờ chạy lại.
    if (this.pendingFormulaRebuild) {
      // RACE FIX: API response (loadTemplateById/onLoadTemplateFromList) có thể
      // arrive TRƯỚC khi `onGridReady` fire (HTTP cache hot, response < ag-grid init).
      // Lúc đó load flow setGridOption skip vì gridApi=undefined, mark pending=true.
      // Khi gridReady fire, Angular Input binding `[rowData]` có thể CHƯA propagate
      // tới ag-grid-angular → `gridApi.forEachNode` iterate 0 rows → mọi
      // `findNodeByRowCode` trả null → toàn bộ cell `#NOROW!`. Triệu chứng intermittent
      // (lúc bị lúc không) tuỳ network speed + microtask ordering.
      //
      // Defensive: explicit setGridOption sync rowData/columnDefs vào grid TRƯỚC khi
      // formulaGraph dùng forEachNode. Setting cùng reference: AG Grid xử lý nhanh,
      // không gây flicker (chỉ chạy 1 lần ở pending flush).
      if (this.gridColDefs.length > 0) {
        this.gridApi.setGridOption('columnDefs', this.gridColDefs);
      }
      if (this.rowData.length > 0) {
        this.gridApi.setGridOption('rowData', [...this.rowData]);
      }
      this.rebuildFormulaGraph();
    }
    // Flush snapshot bị hoãn vì lúc load template gridApi chưa ready.
    // Dùng event `firstDataRendered` của AG Grid — fires đúng 1 lần sau khi rowData
    // được render lần đầu (đảm bảo serializeRows iterate đúng) thay vì setTimeout race.
    if (this.pendingSnapshotSave) {
      this.gridApi.addEventListener('firstDataRendered', () => this.saveSavedStateSnapshot());
    }
    // Flush pending validation recalc (deferred từ load flow khi gridApi destroyed).
    if (this.pendingValidationRecalc) {
      this.pendingValidationRecalc = false;
      this.recalcValidationErrors();
    }
    // Range selection (Excel-style): drag chuột trái hoặc Shift+Click
    this.rangeSelectionSvc.attach({
      gridApi: this.gridApi,
      styleId: 'builder-range-selection-highlight-style',
      onChange: () => this.cdr.detectChanges(),
    });
    this.gridApi.addEventListener('cellMouseDown', (e: any) => this.rangeSelectionSvc.onCellMouseDown(e));
    this.gridApi.addEventListener('cellMouseOver', (e: any) => this.rangeSelectionSvc.onCellMouseOver(e));

    // Paste handler: Builder allow tất cả + sync local rowData[] sau mỗi setDataValue.
    this.pasteHandler.attach({
      gridApi: this.gridApi,
      dialog: this.appDialog,
      catalogService: this.catalogService,
      destroy$: this.destroy$,
      undoRedoService: this.undoRedoService,
      pasteHighlight: this.pasteHighlight,
      dropdownItemsCache: this.dropdownItemsCache,
      getColumnConfigs: () => this.columnConfigs,
      canEditCell: () => true,
      validateCell: (f, v, rd) => this.validateCell(f, v, rd),
      afterCellWrite: (node) => this.syncRowData(node),
      recalcValidationErrors: () => this.recalcValidationErrors(),
      getRangeBounds: () => this.rangeSelectionSvc.bounds(),
    });

    // Toolbar Format: cập nhật trạng thái nút B/I khi user đổi cell focus
    this.gridApi.addEventListener('cellFocused', () => this.cdr.detectChanges());

    // Shortcut Ctrl+B / Ctrl+I khi grid đang focus
    this.gridApi.addEventListener('cellKeyDown', (e: any) => {
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

  /**
   * User kéo tay đổi width cột → bind ngược về `columnConfigs[].width`.
   * Chỉ react khi `finished===true` (kéo xong) và source là UI drag.
   * AG Grid v35: `uiColumnResized` là event cuối khi thả chuột; `uiColumnDragged` là
   * các event trung gian trong lúc kéo — chấp nhận cả 2 cho an toàn giữa versions.
   * Bỏ qua cột `row_code` (không có config) và group header.
   */
  private static readonly COLUMN_RESIZE_UI_SOURCES = new Set<string>([
    'uiColumnResized',
    'uiColumnDragged',
  ]);

  onColumnResized(event: ColumnResizedEvent): void {
    if (!event.finished) return;
    if (!ExcelBuilderComponent.COLUMN_RESIZE_UI_SOURCES.has(event.source)) return;
    const cols = event.columns ?? (event.column ? [event.column] : []);
    let changed = false;
    for (const col of cols) {
      const field = col.getColId();
      if (!field || field === 'row_code') continue;
      const idx = this.columnConfigs.findIndex((c) => c.field === field);
      if (idx === -1) continue;
      const newW = col.getActualWidth();
      if (this.columnConfigs[idx].width !== newW) {
        this.columnConfigs[idx] = { ...this.columnConfigs[idx], width: newW };
        changed = true;
      }
    }
    if (changed) this.saveSavedStateSnapshot();
  }

  /** Returns cached dropdown values, or fetches from API and caches */
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

  // === XÂY DỰNG CẤU HÌNH CỘT ===

  private buildRowCodeColDef(): ColDef {
    return {
      field: 'row_code',
      headerName: 'Mã dòng',
      width: DEFAULT_COLUMN_WIDTH,
      minWidth: COLUMN_MIN_WIDTH,
      pinned: 'left',
      sortable: true,
      filter: true,
      // typeHeader kéo cả nhóm; catalogItem locked; manualRow kéo được.
      rowDrag: (params: RowDragCallbackParams) => getRowKind(params.data) !== 'catalogItem',
      // Chỉ manualRow editable (typeHeader + catalogItem read-only).
      editable: (params: EditableCallbackParams) => getRowKind(params.data) === 'manualRow',
      valueSetter: (params: ValueSetterParams) => this.setRowCodeValue(params),
      cellStyle: (params) => {
        const kind = getRowKind(params.data);
        if (kind === 'typeHeader') return { ...CELL_STYLES.ROW_CODE_HEADER };
        if (kind === 'catalogItem') return { ...CELL_STYLES.ROW_CODE_CATALOG };
        return { ...CELL_STYLES.ROW_CODE_NORMAL };
      },
      cellRenderer: RowCodeCellRendererComponent,
      cellRendererParams: {
        deleteRow: (node: IRowNode) => this.deleteRow(node),
      },
    };
  }

  /**
   * Set + validate row_code mới (alphanumeric + duplicate check case-insensitive).
   * Trả false → AG Grid revert UI về giá trị cũ.
   */
  private setRowCodeValue(params: ValueSetterParams): boolean {
    const newCode = String(params.newValue ?? '').trim();
    if (!newCode || !/^[a-zA-Z0-9]+$/.test(newCode)) return false;

    const newKey = newCode.toLowerCase();
    const currentKey = String(params.data?.row_code ?? '').toLowerCase();
    // Duplicate check qua memoized `existingRowCodes` — exclude self bằng so sánh
    // lower-case key (cùng row đổi case không tính duplicate).
    const isDuplicate = this.existingRowCodes.some(
      (code) => code.toLowerCase() === newKey && code.toLowerCase() !== currentKey,
    );
    if (isDuplicate) {
      this.appDialog.warning(`Mã dòng "${newCode}" đã tồn tại (không phân biệt hoa/thường)!`);
      return false;
    }
    params.data.row_code = newCode;
    return true;
  }

  /** Tooltip header — `DataField: X - mã cột excel: Y`. Bỏ phần excel nếu không có. */
  private buildHeaderTooltip(config: ColumnConfig): string {
    const base = `DataField: ${config.field}`;
    return config.excelCol ? `${base} - mã cột excel: ${config.excelCol}` : base;
  }

  // ============================================================
  // Column definition builders — tách thành 3 micro-method theo loại cột
  // ============================================================

  private buildSingleColDef(config: ColumnConfig, colIndex: number): ColDef {
    const isFormula = !!config.formula;
    const isDate = config.dataType === 'date' && !isFormula;

    const colDef: any = {
      field: config.field,
      headerName: resolveHeaderName(config.headerName, this.previewYear, this.previewMonth),
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
    else if (isDate) this.applyDateColDef(colDef, config, colIndex);
    else this.applyDataColDef(colDef, config);

    // Merge ngang: anchor cell có colSpan > 1 sẽ đè qua các cột hidden bên phải.
    colDef.colSpan = (params: any) => cellColSpan(params.data?._cellConfig?.[config.field]);

    // Header với edit/delete buttons cho mọi cột non-date (date đã set bên trong applyDateColDef).
    if (!isDate) {
      colDef.headerComponent = DataHeaderComponent;
      colDef.headerComponentParams = {
        onEditColumn: () => this.openEditDialog(colIndex),
        onDeleteColumn: () => this.deleteColumn(colIndex),
        onCopyField: (field: string) => this.copyFieldToClipboard(field),
      };
    }

    return colDef;
  }

  /** Cột công thức: read-only, evaluate formula qua valueGetter. */
  private applyFormulaColDef(colDef: any, config: ColumnConfig): void {
    colDef.editable = false;
    colDef.cellClass = 'bg-gray-50 font-mono text-blue-600';
    colDef.tooltipValueGetter = (params: any) => {
      // Formula error: pass error code để tooltip render description.
      if (typeof params.value === 'string' && params.value.startsWith('#')) return params.value;
      // No error: 'trigger' để tooltip vẫn show formula info (metadata: cell formula, col formula).
      return 'trigger';
    };

    colDef.valueGetter = (params: ValueGetterParams) => {
      const cellCfg = params.data?._cellConfig?.[config.field];
      // Dropdown/datePicker override formula → trả raw value
      if (cellCfg?.dropdown || cellCfg?.datePicker) return params.data?.[config.field];
      const formulaToUse = cellCfg?.formula || config.formula;
      if (!formulaToUse) return params.data?.[config.field];
      // Đọc shadow store đã pre-compute. Không recursion lúc render.
      const shadowVal = this.formulaGraph.getValue(params.data?.row_code, config.field);
      return shadowVal !== undefined ? shadowVal : params.data?.[config.field];
    };

    colDef.valueFormatter = (p: any) => this.formatCellValue(p, config);
    colDef.cellStyle = (params: any) => this.styleFormulaCell(params, config);
    colDef.cellRendererSelector = (params: any) => this.cellRendererSelectorByCellCfg(params, config.field);
    // Default renderer khi cellRendererSelector trả undefined (cell không có
    // datePicker/dropdown metadata): Angular component → CSS scoped + :hover thuần.
    colDef.cellRenderer = FormulaCellRendererComponent;
    colDef.cellRendererParams = this.cellRendererParams(config.field, false);
  }

  /** Cột ngày tháng: native date picker; có header edit/delete; tooltip cho validation. */
  private applyDateColDef(colDef: any, config: ColumnConfig, colIndex: number): void {
    colDef.editable = false; // renderer handles editing via native date picker
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
          params: this.cellRendererParams(config.field, /*withDropdown*/ true),
        };
      }
      return {
        component: DateCellRenderer,
        params: this.cellRendererParams(config.field, /*withDropdown*/ false),
      };
    };
    colDef.cellRenderer = DateCellRenderer;
    // Date cell KHÔNG show tooltip — border đỏ + app-validation-error-panel đã đủ
    // signal cho user. Tooltip validation hay bị stale do AG Grid lifecycle.
    colDef.tooltipValueGetter = () => '';
    colDef.headerComponent = DataHeaderComponent;
    colDef.headerComponentParams = {
      onEditColumn: () => this.openEditDialog(colIndex),
      onDeleteColumn: () => this.deleteColumn(colIndex),
      onCopyField: (field: string) => this.copyFieldToClipboard(field),
    };
  }

  /** Cột data thường: editable theo permission + cell config; có thể chứa cell-level formula. */
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
      // AG Grid revert giá trị cũ + toast warning. Empty (xóa cell) thì OK → null.
      if (!isEmpty && parsed === null) {
        this.appDialog.warning(`Cột "${config.headerName}" chỉ nhận giá trị số. Bạn vừa nhập "${raw}".`);
        return false;
      }
      params.data[config.field] = parsed;
      return true;
    };

    colDef.valueFormatter = (p: any) => this.formatCellValue(p, config);
    colDef.cellStyle = (params: any) => this.styleDataCell(params, config);
    colDef.cellRendererSelector = (params: any) => this.cellRendererSelectorByCellCfg(params, config.field);
    colDef.cellRenderer = FormulaCellRendererComponent;
    colDef.cellRendererParams = this.cellRendererParams(config.field, false);
    colDef.onCellValueChanged = (params: any) => {
      // Topo-sort + shadow store: BFS reverse-deps từ (rowCode, field) → recompute
      // chỉ những cells thực sự ảnh hưởng → refresh đúng tập columns. Không cần
      // multi-pass refresh / microtask cache vì eval order deterministic theo topo.
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

  private cellPresetStyle(params: any, config: ColumnConfig, cellCfg: any): any | null {
    return resolveCellPresetStyle(params, config, cellCfg, BUILDER_ERROR_STYLE);
  }

  /** Style cho cell trong cột FORMULA. */
  private styleFormulaCell(params: any, config: ColumnConfig): any {
    const cellCfg = params.data?._cellConfig?.[config.field];
    const fmt = cellFormatStyle(cellCfg);
    const preset = this.cellPresetStyle(params, config, cellCfg);
    if (preset) return { ...preset, ...fmt };
    return Object.keys(fmt).length ? fmt : null;
  }

  /**
   * Style cho cell trong cột DATA. Priority: formula error > validation invalid > preset > lock > normal.
   *
   * Validation invalid border PHẢI merge với base preset (dropdown/datePicker bg) — red border là
   * tín hiệu critical, không thể bị che bởi preset (cell datepicker/dropdown bị invalid → vẫn đỏ).
   */
  private styleDataCell(params: any, config: ColumnConfig): any {
    const cellCfg = params.data?._cellConfig?.[config.field];
    const fmt = cellFormatStyle(cellCfg);

    // Formula error (#XXX!) priority cao nhất — value đã là error code.
    if (typeof params.value === 'string' && params.value.startsWith('#')) {
      const errorBase = this.cellPresetStyle(params, config, cellCfg) || CELL_STYLES.ERROR;
      return { ...errorBase, ...fmt };
    }

    const canEditCell = this.canEdit(config.field, params.data?.row_code || '');
    const vr = this.validateCell(config.field, params.value, params.data || {});

    // Validation invalid: merge preset bg với border đỏ. Đảm bảo cell datepicker/dropdown
    // có rule sai vẫn show red border (trước fix: preset return early → không có border).
    if (!vr.valid) {
      const base =
        this.cellPresetStyle(params, config, cellCfg) ||
        (canEditCell ? CELL_STYLES.DATA_NORMAL : CELL_STYLES.LOCKED_CELL);
      return { ...base, ...CELL_STYLES.VALIDATION_INVALID_BORDER, ...fmt };
    }

    // Valid: preset (dropdown/datePicker/formula) priority cao hơn lock/normal.
    const preset = this.cellPresetStyle(params, config, cellCfg);
    if (preset) return { ...preset, ...fmt };
    if (!canEditCell) return { ...CELL_STYLES.LOCKED_CELL, ...fmt };
    return { ...CELL_STYLES.DATA_NORMAL, ...fmt };
  }

  /**
   * Selector cho cell renderer dựa trên `_cellConfig` (datePicker/dropdown).
   * Trả `undefined` để fallback cellRenderer mặc định (gear icon). Dùng chung cho data + formula cols.
   */
  private cellRendererSelectorByCellCfg(params: any, field: string): any {
    const cellCfg = params.data?._cellConfig?.[field];
    if (cellCfg?.datePicker) {
      return { component: DateCellRenderer, params: this.cellRendererParams(field, false) };
    }
    if (cellCfg?.dropdown) {
      return { component: DropdownCellRenderer, params: this.cellRendererParams(field, true) };
    }
    return undefined;
  }

  /**
   * Build common params cho DateCellRenderer / DropdownCellRenderer / FormulaCellRenderer.
   * Builder mode → `showGearIcon: true` để mở cell config dialog + cho phép copy
   * địa chỉ cell. Render dùng helper riêng (không gear icon).
   */
  private cellRendererParams(field: string, withDropdownValues: boolean): any {
    const params: any = {
      field,
      showGearIcon: true,
      openConfigDialog: (node: IRowNode, f: string) => this.openCellConfigDialog(node, f),
      copyCellAddress: (node: IRowNode, f: string) => this.copyCellAddressToClipboard(node, f),
    };
    if (withDropdownValues) params.getDropdownValues = this.getDropdownValues;
    return params;
  }

  /**
   * Copy địa chỉ cell `{rowCode}_{field}` (Tier 1 ROW_COL — xem `excelpro-formula.md`)
   * vào clipboard. Toast success với address để user verify; fallback warning nếu
   * Clipboard API bị reject (browser permission / non-secure context).
   */
  private async copyCellAddressToClipboard(node: IRowNode, field: string): Promise<void> {
    const address = cellAddressOf(node.data?.row_code, field);
    try {
      await navigator.clipboard.writeText(address);
      this.appDialog.success(`Đã copy: ${address}`);
    } catch {
      this.appDialog.warning(`Không thể copy. Địa chỉ cell: ${address}`);
    }
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

  buildGridDefinitions() {
    this.colMap = {};
    this.columnConfigs.forEach((c) => {
      if (c.excelCol) this.colMap[c.excelCol] = c.field;
    });

    const colDefMap = new Map<string, ColDef>();
    this.columnConfigs.forEach((config, idx) => {
      colDefMap.set(config.field, this.buildSingleColDef(config, idx));
    });

    // Dọn stale references: xóa field không còn tồn tại trong columnConfigs (mọi cấp)
    const validFields = new Set(this.columnConfigs.map((c) => c.field));
    cleanStaleColumnGroupFields(this.columnGroups, validFields);
    this.columnGroups.forEach(reconcileColumnGroupItems);

    // Tập hợp tất cả field đã thuộc nhóm (leaf, ở mọi cấp)
    const groupedFields = collectAllLeafFields(this.columnGroups);

    // Helper: build ColGroupDef đệ quy theo thứ tự items (xen kẽ leaf + sub-group)
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
      return {
        groupId: group.groupId,
        headerName: resolveHeaderName(group.headerName, this.previewYear, this.previewMonth),
        marryChildren: group.marryChildren ?? false,
        children,
      } as ColGroupDef;
    };

    const result: (ColDef | ColGroupDef)[] = [];

    // 1. row_code (pinned)
    result.push(this.buildRowCodeColDef());

    // 2. Tất cả cột: duyệt theo thứ tự columnConfigs để giữ vị trí
    const emittedRootGroups = new Set<string>();
    this.columnConfigs.forEach((config) => {
      if (groupedFields.has(config.field)) {
        // Tìm root group chứa field này
        const rootGroup = this.columnGroups.find((g) =>
          columnGroupContainsField(g, config.field),
        );
        if (rootGroup && !emittedRootGroups.has(rootGroup.groupId)) {
          emittedRootGroups.add(rootGroup.groupId);
          const colGroupDef = buildGroupDef(rootGroup);
          // Chỉ push nếu có ít nhất 1 child
          if ((colGroupDef.children?.length ?? 0) > 0) result.push(colGroupDef);
        }
      } else {
        result.push(colDefMap.get(config.field)!);
      }
    });

    this.gridColDefs = result;
    // KHÔNG gọi setGridOption('columnDefs', ...) ở đây — Angular CD sẽ tự đẩy qua
    // `[columnDefs]="gridColDefs"`. Gọi 2 lần = AG Grid remount 2 lần → lag visible.
    this.recalcGridHeight();
  }

  // === XỬ LÝ DIALOG COLUMN CONFIG ===
  openDialog() {
    this.columnConfigEditData = null;
    this.editingColumnIndex = null;
    this.isColumnConfigDialogOpen = true;
    this.cdr.detectChanges(); // AG Grid callbacks run outside Angular zone
  }

  openEditDialog(index: number): void {
    const config = this.columnConfigs[index];
    this.editingColumnIndex = index;
    this.columnConfigEditData = { index, config };

    this.isColumnConfigDialogOpen = true;
    this.cdr.detectChanges(); // AG Grid callbacks run outside Angular zone
  }

  onColumnConfigSubmit(val: ColumnConfigResult) {
    const dataType = val.dataType || 'text';
    const formula = dataType === 'date' ? undefined : val.formula?.trim() || undefined;
    const excelCol = dataType === 'date'
      ? undefined
      : val.excelCol ? val.excelCol.toUpperCase() : undefined;

    // EDIT MODE
    if (this.editingColumnIndex !== null) {
      const idx = this.editingColumnIndex;
      const oldConfig = this.columnConfigs[idx];
      this.editingColumnIndex = null;

      const savedOldConfig = { ...oldConfig };
      const newConfig: ColumnConfig = {
        ...oldConfig,
        headerName: val.headerName!,
        dataType,
        excelCol,
        formula,
        width: val.width ?? oldConfig.width,
      };

      const needsCellRefresh =
        oldConfig.formula !== newConfig.formula ||
        oldConfig.dataType !== newConfig.dataType;

      const applyConfig = (config: ColumnConfig) => {
        this.loadingService.wrap('Đang cập nhật cột...', () => {
          this.columnConfigs[idx] = config;
          this.buildGridDefinitions();
          if (!needsCellRefresh || !this.gridApi) return;
          const fields = this.columnConfigs.map((c) => c.field);
          if (fields.length > 0) {
            this.gridApi.refreshCells({ columns: fields, force: true });
          }
        });
      };

      applyConfig(newConfig);
      this.pushUndo({
        type: 'col_edit',
        description: `Sửa cột ${oldConfig.field}`,
        undo: () => applyConfig(savedOldConfig),
        redo: () => applyConfig(newConfig),
      });
      return;
    }

    // CREATE MODE — duplicate field check (CI)
    const newKey = val.field!.toLowerCase();
    if (this.columnConfigs.some((c) => c.field.toLowerCase() === newKey)) {
      this.appDialog.warning(
        `Mã Data Field "${val.field}" đã tồn tại! Vui lòng chọn mã khác.`,
      );
      return;
    }

    this.columnConfigs.push({
      headerName: val.headerName!,
      field: val.field!,
      excelCol,
      formula,
      dataType,
      width: val.width,
    });

    if (!formula) {
      const defaultValue = dataType === 'date' || dataType === 'text' ? '' : null;
      const currentRows: any[] = [];
      if (this.gridApi) {
        this.gridApi.forEachNode((node) => currentRows.push({ ...node.data }));
      }
      this.rowData = currentRows.map((row) => ({
        ...row,
        [val.field!]: defaultValue,
      }));
    }

    this.buildGridDefinitions();
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', this.rowData);
    }
  }

  // === XỬ LÝ DIALOG CELL CONFIG (Formula / Dropdown) ===
  openCellConfigDialog(rowNode: IRowNode, field: string) {
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
    this.cdr.detectChanges(); // AG Grid callbacks run outside Angular zone
  }

  /** Handle catalog type change from cell config dialog → load dropdown items */
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

  onCellConfigSave(result: CellConfigResult) {
    if (!this.editingCell || !this.editingCell.rowNode.data) return;
    const { rowNode, field } = this.editingCell;
    const rowData = { ...rowNode.data };

    if (!rowData._cellConfig) rowData._cellConfig = {};
    if (!rowData._cellConfig[field]) rowData._cellConfig[field] = {};

    const prevCfg = rowNode.data?._cellConfig?.[field];
    const prevType = prevCfg?.datePicker ? 'datepicker' : prevCfg?.dropdown ? 'dropdown' : prevCfg?.formula ? 'formula' : 'none';

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

    // Clean up empty config
    if (rowData._cellConfig[field] && Object.keys(rowData._cellConfig[field]).length === 0) {
      delete rowData._cellConfig[field];
    }
    if (rowData._cellConfig && Object.keys(rowData._cellConfig).length === 0) {
      delete rowData._cellConfig;
    }

    rowNode.setData(rowData);
    this.syncRowData(rowNode);
    // Cell config đổi → topology graph đổi + có thể có GETDATA/LOOKUP mới → preload + rebuild.
    // Async path: redrawRows/refreshCells phải nằm trong callback để valueGetter đọc shadow đã hot.
    this.preloadBuilderGetdataAndThen(() => {
      this.rebuildFormulaGraph();
      this.gridApi.redrawRows({ rowNodes: [rowNode] });
      const columnsToRefresh = this.columnConfigs.map((c) => c.field);
      this.gridApi.refreshCells({ columns: columnsToRefresh, force: true });
    });
    this.editingCell = null;
  }

  onCellConfigClear() {
    if (!this.editingCell || !this.editingCell.rowNode.data) return;
    const { rowNode, field } = this.editingCell;
    const rowData = { ...rowNode.data };

    // Reset value to column default when clearing config
    const prevCfg = rowData._cellConfig?.[field];
    if (prevCfg?.formula || prevCfg?.dropdown || prevCfg?.datePicker) {
      const col = this.columnConfigs.find((c) => c.field === field);
      rowData[field] = col?.dataType === 'date' ? '' : null;
    }

    if (rowData._cellConfig) {
      delete rowData._cellConfig[field];
      if (Object.keys(rowData._cellConfig).length === 0) {
        delete rowData._cellConfig;
      }
    }

    rowNode.setData(rowData);
    this.syncRowData(rowNode);

    // redrawRows re-evaluates cellRendererSelector
    this.gridApi.redrawRows({ rowNodes: [rowNode] });
    const columnsToRefresh = this.columnConfigs.map((c) => c.field);
    this.gridApi.refreshCells({ columns: columnsToRefresh, force: true });
    return;
  }

  addRow() {
    this.isAddRowDialogOpen = true;
  }

  onAddRowSubmit(result: AddRowResult) {
    if (result.mode === 'bulk') {
      this.addRowsFromCatalog(result.targetField, result.items);
      return;
    }
    this.addAutoRows(result.quantity);
  }

  /**
   * Thêm `count` dòng với mã tự sinh `R{n}` liên tiếp sau max hiện tại.
   * Mã + Tên dòng = R{n}; cell các cột data để trống.
   */
  private addAutoRows(count: number): void {
    if (!Number.isFinite(count) || count < 1) return;

    const codes = nextRowCodes(this.rowData.map((r) => r?.row_code), count);
    const newRows = codes.map((code) => this.buildEmptyRow(code, code));

    const description = count === 1
      ? `Thêm dòng ${codes[0]}`
      : `Thêm ${count} dòng (${codes[0]}–${codes[codes.length - 1]})`;
    this.commitAddRows(newRows, description);
  }

  /**
   * Thêm nhiều dòng từ catalog items — bulk-add mode.
   * row_code = item.id (suffix 6 ký tự ngẫu nhiên nếu trùng); cột target nhận `item.name`.
   */
  private addRowsFromCatalog(targetField: string, items: { id: string; name: string }[]): void {
    if (!this.columnConfigs.some(c => c.field === targetField)) {
      this.appDialog.warning(`Cột "${targetField}" không tồn tại.`);
      return;
    }

    const existingKeys = new Set<string>();
    this.gridApi.forEachNode(n => {
      const code = n.data?.row_code;
      if (code) existingKeys.add(String(code).toLowerCase());
    });

    const newRows: any[] = [];
    for (const item of items) {
      const finalCode = uniqueRowCode(item.id, existingKeys);
      existingKeys.add(finalCode.toLowerCase());
      const row = this.buildEmptyRow(finalCode, finalCode);
      row[targetField] = item.name;
      newRows.push(row);
    }

    this.commitAddRows(newRows, `Thêm ${newRows.length} dòng từ danh mục`);
  }

  /**
   * Apply add-rows: grid + state + height + formula graph + undo/redo.
   * Single source of truth cho mọi flow thêm dòng (auto / catalog / future).
   */
  private commitAddRows(newRows: any[], description: string): void {
    if (newRows.length === 0) return;

    this.applyAddRows(newRows);
    this.pushUndo({
      type: 'row_add',
      description,
      undo: () => this.applyRemoveRows(newRows),
      redo: () => this.applyAddRows(newRows),
    });
  }

  private applyAddRows(rows: any[]): void {
    this.gridApi.applyTransaction({ add: rows });
    this.rowData.push(...rows);
    this.recalcGridHeight();
    // rowOrder đổi → aggregate ranges có thể đổi → rebuild graph
    this.rebuildFormulaGraph();
  }

  private applyRemoveRows(rows: any[]): void {
    for (const r of rows) {
      const idx = this.rowData.indexOf(r);
      if (idx !== -1) this.rowData.splice(idx, 1);
    }
    this.gridApi.applyTransaction({ remove: rows });
    this.recalcGridHeight();
    this.rebuildFormulaGraph();
  }

  /** Khởi tạo row mới với cell trống theo dataType từng cột. */
  private buildEmptyRow(rowCode: string, rowName: string): any {
    const row: any = { row_code: rowCode, row_name: rowName };
    this.columnConfigs.forEach((c) => {
      if (!c.formula) {
        row[c.field] = c.dataType === 'date' || c.dataType === 'text' ? '' : null;
      }
    });
    return row;
  }

  // === EXPORT / IMPORT EXCEL ===

  exportExcel(): void {
    const resolved = resolveHeaderName(this.currentTemplateName, this.previewYear, this.previewMonth) || 'Báo cáo';
    const fileName = sanitizeFilename(resolved);
    this.excelExportService.exportGrid(
      this.columnConfigs,
      this.columnGroups,
      this.rowData,
      fileName,
      this.previewYear,
      this.previewMonth,
      resolved,
    );
  }

  /** Mở dialog import; submit/cancel xử lý qua handlers. */
  importExcel(): void {
    this.isImportDialogOpen = true;
  }

  async onImportFileSubmit(file: File | null): Promise<void> {
    this.isImportDialogOpen = false;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.appDialog.warning('File quá lớn (tối đa 5MB)');
      return;
    }
    await this.runImport(file);
  }

  /**
   * Tải template Excel kèm rows hiện tại của builder (với formula đã resolve về
   * giá trị qua shadow store). Filename = template name đã resolve placeholder +
   * sanitize. Builder mode chưa save → fallback "Báo cáo".
   */
  async onDownloadImportTemplate(): Promise<void> {
    if (this.isDownloadingImportTemplate) return;
    this.isDownloadingImportTemplate = true;
    try {
      const resolved = resolveHeaderName(this.currentTemplateName, this.previewYear, this.previewMonth) || 'Báo cáo';
      const fileName = sanitizeFilename(resolved);
      const snapshot = this.snapshotRowDataForExport();
      await this.excelExportService.exportGrid(
        this.columnConfigs,
        this.columnGroups,
        snapshot,
        fileName,
        this.previewYear,
        this.previewMonth,
        resolved,
      );
    } catch (e: any) {
      this.appDialog.error('Lỗi tải template: ' + (e.message || e));
    } finally {
      this.isDownloadingImportTemplate = false;
    }
  }

  /**
   * Snapshot `rowData` cho export — overlay formula values từ shadow store.
   *
   * Lý do: formula cells (column-level `formula` hoặc `_cellConfig.formula`) lưu
   * KẾT QUẢ trong shadow store của `formulaGraph`, KHÔNG nằm ở `row[field]`.
   * Đọc qua `gridApi.getCellValue` đi qua valueGetter → trả đúng kết quả.
   * Cell thường: getCellValue == row[field], không sai lệch.
   */
  private snapshotRowDataForExport(): any[] {
    if (!this.gridApi) return [...this.rowData];
    return this.rowData.map(row => {
      const out: any = { ...row };
      if (!row.row_code) return out;
      const node = this.gridApi.getRowNode(String(row.row_code));
      if (!node) return out;
      for (const col of this.columnConfigs) {
        try {
          const v = this.gridApi.getCellValue({ rowNode: node, colKey: col.field });
          if (v !== undefined) out[col.field] = v;
        } catch { /* AG Grid lifecycle race — fallback row[field] đã có */ }
      }
      return out;
    });
  }

  private async runImport(file: File): Promise<void> {
    let matchedRows: any[];
    let unmatchedCols: string[];
    let rowCodeUnresolved: boolean;
    try {
      ({ matchedRows, unmatchedCols, rowCodeUnresolved } =
        await this.excelExportService.importGrid(
          file, this.columnConfigs, this.columnGroups, this.previewYear, this.previewMonth,
        ));
    } catch (e: any) {
      this.appDialog.error('Lỗi đọc file: ' + (e.message || e));
      return;
    }
    if (matchedRows.length === 0) {
      this.appDialog.warning('Không tìm thấy dữ liệu phù hợp trong file');
      return;
    }
    // Auto-gen row_code R{n} khi file không có cột Mã dòng — tránh nhồi cell A nhầm
    if (rowCodeUnresolved) {
      const R_PATTERN = /^R(\d+)$/i;  // strict: KHÔNG khớp RX{n} của render custom row
      let max = 0;
      for (const r of this.rowData) {
        const m = r.row_code && R_PATTERN.exec(r.row_code);
        if (m) max = Math.max(max, Number(m[1]));
      }
      matchedRows.forEach((row, idx) => {
        if (!row.row_code) row.row_code = `R${max + idx + 1}`;
      });
    }
    let msg = `Tìm thấy ${matchedRows.length} dòng dữ liệu.`;
    if (rowCodeUnresolved) {
      msg += `\n(Đã tự sinh mã dòng R{n} cho ${matchedRows.length} dòng)`;
    }
    if (unmatchedCols.length > 0) {
      msg += `\nCột không match: ${unmatchedCols.join(', ')}`;
    }
    this.appDialog
      .confirm({
        title: 'Import dữ liệu',
        message: msg + '\n\nÁp dụng dữ liệu?',
        status: 'info',
        confirmText: 'Áp dụng',
        cancelText: 'Hủy',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        for (const imported of matchedRows) {
          const existing = this.rowData.find(
            (r) => r.row_code === imported.row_code,
          );
          if (existing) {
            for (const [key, val] of Object.entries(imported)) {
              if (key === 'row_code') continue;
              existing[key] = val;
            }
          } else {
            this.rowData.push(imported);
          }
        }
        this.gridApi.setGridOption('rowData', [...this.rowData]);
        this.gridApi.refreshCells({ force: true });
        this.recalcGridHeight();
      });
  }

  // === DRAG & DROP ROW REORDER ===

  onRowDragEnd(event: any): void {
    const movedData = event.node.data;
    const oldRowData = [...this.rowData];

    let adjustedOrder: any[];

    if (movedData._isTypeHeader) {
      // === Kéo nhóm danh mục ===
      adjustedOrder = this.handleGroupDrag(movedData);
    } else {
      // === Kéo dòng thủ công (logic cũ) ===
      const newOrder: any[] = [];
      this.gridApi.forEachNode((node) => {
        if (node.data) newOrder.push(node.data);
      });
      const movedIdx = newOrder.indexOf(movedData);
      adjustedOrder = this.adjustDropPosition(newOrder, movedIdx);
    }

    this.rowData = adjustedOrder;
    this.gridApi.setGridOption('rowData', this.rowData);

    this.pushUndo({
      type: 'row_add',
      description: `Di chuyển ${movedData._isTypeHeader ? 'nhóm' : 'dòng'} ${movedData.row_code}`,
      undo: () => {
        this.rowData = [...oldRowData];
        this.gridApi.setGridOption('rowData', this.rowData);
      },
      redo: () => {
        this.rowData = [...adjustedOrder];
        this.gridApi.setGridOption('rowData', this.rowData);
      },
    });
  }

  private handleGroupDrag(headerData: any): any[] {
    // 1. Tìm group members từ pre-drag state
    const groupItems: any[] = [];
    let found = false;
    for (const row of this.rowData) {
      if (row === headerData) {
        found = true;
        continue;
      }
      if (found) {
        if (
          row._catalogField === headerData._catalogField &&
          !row._isTypeHeader
        ) {
          groupItems.push(row);
        } else {
          break;
        }
      }
    }

    // 2. Đọc thứ tự mới từ grid (header đã di chuyển, items chưa)
    const newOrder: any[] = [];
    this.gridApi.forEachNode((node) => {
      if (node.data) newOrder.push(node.data);
    });

    // 3. Loại bỏ items orphan + header
    const withoutGroup = newOrder.filter(
      (r) => r !== headerData && !groupItems.includes(r),
    );

    // 4. Tìm row reference: row đầu tiên TRƯỚC header mà không thuộc group đang kéo
    const headerIdxInNew = newOrder.indexOf(headerData);
    let rowBeforeHeader: any = null;
    for (let i = headerIdxInNew - 1; i >= 0; i--) {
      if (!groupItems.includes(newOrder[i])) {
        rowBeforeHeader = newOrder[i];
        break;
      }
    }

    let insertIdx: number;
    if (!rowBeforeHeader) {
      insertIdx = 0;
    } else {
      insertIdx = withoutGroup.indexOf(rowBeforeHeader) + 1;
    }

    // 5. Chèn header + items
    withoutGroup.splice(insertIdx, 0, headerData, ...groupItems);

    // 6. Adjust: nếu nhóm rơi giữa group khác → đẩy ra
    return this.adjustGroupDropPosition(
      withoutGroup,
      insertIdx,
      groupItems.length + 1,
    );
  }

  private adjustGroupDropPosition(
    order: any[],
    groupStartIdx: number,
    groupSize: number,
  ): any[] {
    const prevRow = groupStartIdx > 0 ? order[groupStartIdx - 1] : null;
    const groupEndIdx = groupStartIdx + groupSize - 1;

    // Nếu prevRow là catalog item (không phải type header) → đang ở giữa 1 nhóm khác
    if (prevRow?._catalogField && !prevRow._isTypeHeader) {
      // Tìm cuối nhóm chứa prevRow
      let endOfGroup = groupEndIdx;
      for (let i = groupEndIdx + 1; i < order.length; i++) {
        if (order[i]._isTypeHeader || !order[i]._catalogField) break;
        endOfGroup = i;
      }
      // Di chuyển cả block ra sau nhóm đó
      const block = order.splice(groupStartIdx, groupSize);
      order.splice(endOfGroup - groupSize + 1, 0, ...block);
    }

    return order;
  }

  private adjustDropPosition(order: any[], movedIdx: number): any[] {
    const moved = order[movedIdx];
    if (moved._catalogField) return order;

    const prevRow = movedIdx > 0 ? order[movedIdx - 1] : null;
    const nextRow = movedIdx < order.length - 1 ? order[movedIdx + 1] : null;

    // Nếu nextRow là type header hoặc không phải catalog → ranh giới giữa các nhóm → cho phép
    if (!nextRow?._catalogField || nextRow._isTypeHeader) return order;

    // Nếu prevRow cũng thuộc catalog → đang ở giữa 1 nhóm danh mục
    if (prevRow?._catalogField || prevRow?._isTypeHeader) {
      // Tìm cuối nhóm con (đến khi gặp type header hoặc dòng không phải catalog)
      let lastGroupIdx = movedIdx;
      for (let i = movedIdx + 1; i < order.length; i++) {
        if (order[i]._isTypeHeader || !order[i]._catalogField) break;
        lastGroupIdx = i;
      }
      // Di chuyển dòng ra sau nhóm con hiện tại
      order.splice(movedIdx, 1);
      order.splice(lastGroupIdx, 0, moved);
    }

    return order;
  }

  // === UNDO / REDO ===

  private pushUndo(action: Omit<UndoAction, 'timestamp'>): void {
    this.undoRedoService.pushUndo(action);
  }

  undo(): void {
    this.undoRedoService.undo();
  }

  redo(): void {
    this.undoRedoService.redo();
  }

  @HostListener('document:keydown', ['$event']) // Lắng nghe sự kiện để bắt mọi phím trên bàn phím trên toàn trang
  handleKeyboard(event: KeyboardEvent): void {
    if (this.isCellConfigDialogOpen || this.isColumnConfigDialogOpen) return; // chặn khi đang mở dialog

    const target = event.target as HTMLElement; // đang nhận xem người dùng gõ ở đâu
    const isEditing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.classList.contains('ag-cell-edit-input'); // Kiểm tra xem người dùng đang nhập vào cell nào

    const key = event.key.toLowerCase(); // ký tự (phụ thuộc layout bàn phím)
    const code = event.code;  //vị trí phím vật lý

     // Chỉ phản hồi thao tác Hoàn tác/Làm lại nếu lưới của thành phần này đang được chọn.
    const hasFocus = !!this.gridApi?.getFocusedCell();  //Grid có cell đang focus không và chỉ xử lý khi đang thao tác trên bảng

    // Ctrl + Z
    if (event.ctrlKey && (code === 'KeyZ' || key === 'z') && !event.shiftKey) {
      if (!isEditing && hasFocus) { // Xử lý khi không edit và đang focus
        event.preventDefault();
        this.undoRedoService.undo();
      }
    }
    // Ctrl + Y or Ctrl + Shift + Z
    if (
      event.ctrlKey &&
      (code === 'KeyY' || key === 'y' || ((code === 'KeyZ' || key === 'z') && event.shiftKey))
    ) {
      if (!isEditing && hasFocus) {
        event.preventDefault();
        this.undoRedoService.redo();
      }
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

            this.undoRedoService.pushUndo({
              type: 'cell_edit',
              description: changes.length === 1 ? `Xóa ô ${changes[0].field}` : `Xóa ${changes.length} ô`,
              undo: () => {
                changes.forEach((ch) => {
                  ch.node.setDataValue(ch.field, ch.oldValue);
                  this.syncRowData(ch.node);
                });
                this.gridApi.refreshCells(refreshScope);
              },
              redo: () => {
                changes.forEach((ch) => {
                  ch.node.setDataValue(ch.field, newValue);
                  this.syncRowData(ch.node);
                });
                this.gridApi.refreshCells(refreshScope);
              },
            });
            this.undoRedoService.isBulkOperation = true;
            try {
              changes.forEach((ch) => {
                ch.node.setDataValue(ch.field, newValue);
                this.syncRowData(ch.node);
              });
            } finally {
              this.undoRedoService.isBulkOperation = false;
            }
            this.gridApi.refreshCells(refreshScope);
            this.recalcValidationErrors();
          }
        }
      }
    }
  }

  onCellValueChangedUndo(params: any): void {
    // PUSH UNDO: chỉ track user edit thật (source === 'edit'). AG Grid v35 fires
    // cellValueChanged với nhiều source (api, undo, redo, paste, rowDrag, rowData...).
    // Nếu push cho mọi source, undo của chúng ta sẽ push chính nó → loop vô hạn.
    if (
      params.source === 'edit' &&
      !this.undoRedoService.isExecuting &&
      !this.undoRedoService.isBulkOperation
    ) {
      const { node, colDef, oldValue, newValue } = params;
      if (oldValue !== newValue) {
        const rowCode = node.data?.row_code;
        const field = colDef.field;
        this.syncRowData(node);

        this.undoRedoService.pushUndo({
          type: 'cell_edit',
          description: `Sửa ${rowCode}.${field}`,
          undo: () => {
            let targetNode: IRowNode | null = null;
            this.gridApi.forEachNode(n => {
              if (n.data?.row_code === rowCode) targetNode = n;
            });
            if (targetNode) {
              (targetNode as IRowNode).setDataValue(field, oldValue);
              this.syncRowData(targetNode as IRowNode);
            }
          },
          redo: () => {
            let targetNode: IRowNode | null = null;
            this.gridApi.forEachNode(n => {
              if (n.data?.row_code === rowCode) targetNode = n;
            });
            if (targetNode) {
              (targetNode as IRowNode).setDataValue(field, newValue);
              this.syncRowData(targetNode as IRowNode);
            }
          },
        });
      }
    }

    // RECALC VALIDATION cho mọi source non-bulk — date picker dùng `setDataValue()` fires
    // source='api' (KHÔNG 'edit'). Skip bulk (paste handler tự recalc cuối flow).
    if (
      !this.undoRedoService.isBulkOperation &&
      this.gridApi &&
      !this.gridApi.isDestroyed()
    ) {
      this.recalcValidationErrors();
      const colId = params.colDef?.field || params.colDef?.colId;
      if (params.node && colId) {
        this.gridApi.refreshCells({ rowNodes: [params.node], columns: [colId], force: true });
      }
      // FORCE clear tooltip popup — AG Grid không tự destroy `.ag-tooltip-custom` khi
      // user giữ chuột trên cell vừa đổi value. Next hover → tooltip tạo mới fresh.
      clearActiveTooltip();
    }
  }

  /** Đảm bảo rằng biến this.rowData luôn đồng bộ với dữ liệu hàng nội bộ của AG Grid. */
  private syncRowData(node: IRowNode): void {
    if (!node.data?.row_code) return;
    const idx = this.rowData.findIndex(
      (r) => r.row_code === node.data.row_code,
    );
    if (idx !== -1) this.rowData[idx] = node.data;
  }

  // === VALIDATION Ô ===

  validationErrors: ValidationErrorEntry[] = [];
  validationPanelExpanded = false;
  /**
   * Pending flag — flush trong `onGridReady` lần kế tiếp khi `gridApi` chưa sẵn
   * sàng lúc load template hoàn tất. KHÔNG dùng setTimeout để tránh race.
   */
  private pendingValidationRecalc = false;
  /** Backward compat: count = errors.length, KHÔNG xoá để các binding cũ vẫn chạy. */
  get validationErrorCount(): number {
    return this.validationErrors.length;
  }

  validateCell(field: string, value: any, rowData: any): { valid: boolean; message?: string } {
    const colValidation = this.columnConfigs.find((c) => c.field === field)?.validation;
    const cellValidation = rowData._cellConfig?.[field]?.validation;
    const rule = cellValidation || colValidation;
    return validateCellValue(value, rule);
  }

  get isEditingDateColumn(): boolean {
    if (!this.editingCell) return false;
    const col = this.columnConfigs.find(
      (c) => c.field === this.editingCell!.field,
    );
    if (col?.dataType === 'date') return true;
    // Cell-level datePicker override
    const cellCfg =
      this.editingCell.rowNode.data?._cellConfig?.[this.editingCell.field];
    return !!cellCfg?.datePicker;
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

  /**
   * Sync recalc nếu gridApi healthy; else mark pending → onGridReady flush.
   * Tránh `setTimeout(_, 0)` race khi load callback chạy trước khi AG Grid
   * propagate `[rowData]` (loading transition recreate grid).
   */
  private scheduleValidationRecalc(): void {
    if (this.gridApi && !this.gridApi.isDestroyed()) {
      this.recalcValidationErrors();
    } else {
      this.pendingValidationRecalc = true;
    }
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

  /**
   * Copy DataField cột vào clipboard. Trigger từ double-click trên header label
   * (xem `data-header.ts`). Hiển thị toast confirm để user biết đã copy.
   *
   * Fallback `document.execCommand` cho browser cũ không hỗ trợ Clipboard API
   * hoặc context HTTP non-secure (Clipboard API yêu cầu secure context).
   */
  private async copyFieldToClipboard(field: string): Promise<void> {
    if (!field) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(field);
      } else {
        const ta = document.createElement('textarea');
        ta.value = field;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      this.appDialog.success(`Đã copy DataField: ${field}`);
    } catch {
      this.appDialog.warning('Không copy được — trình duyệt chặn clipboard.');
    }
  }

  // === XÓA CỘT / DÒNG ===

  deleteColumn(index: number): void {
    const config = this.columnConfigs[index];
    this.appDialog
      .confirm({
        title: 'X\u00F3a c\u1ED9t',
        message: `B\u1EA1n ch\u1EAFc ch\u1EAFn mu\u1ED1n x\u00F3a c\u1ED9t "${config.headerName}"?`,
        status: 'error',
        confirmText: 'X\u00F3a',
        cancelText: 'H\u1EE7y',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        // Snapshot for undo
        const savedConfig = { ...config };
        const savedIndex = index;
        const savedGroupFields = JSON.parse(
          JSON.stringify(this.columnGroups),
        ) as ColumnGroupConfig[];
        const savedRowValues = this.rowData.map((r) => ({
          value: r[config.field],
          cellCfg: r._cellConfig?.[config.field]
            ? { ...r._cellConfig[config.field] }
            : undefined,
        }));
        // 1. Xóa khỏi columnConfigs
        this.columnConfigs.splice(index, 1);

        // 2. Xóa field khỏi tất cả columnGroups (đệ quy)
        this.removeFieldFromAllGroups(config.field);

        // 3. Xóa giá trị + cellConfig từ tất cả rowData
        for (const row of this.rowData) {
          delete row[config.field];
          if (row._cellConfig) {
            delete row._cellConfig[config.field];
          }
        }

        // 5. Rebuild grid + formula graph (column topology đổi)
        this.buildGridDefinitions();
        this.gridApi.setGridOption('columnDefs', this.gridColDefs);
        this.gridApi.setGridOption('rowData', [...this.rowData]);
        this.rebuildFormulaGraph();

        this.pushUndo({
          type: 'col_delete',
          description: `Xóa cột ${savedConfig.headerName}`,
          undo: () => {
            this.columnConfigs.splice(savedIndex, 0, savedConfig);
            // Restore group structure (deep clone was saved before deletion)
            this.columnGroups.length = 0;
            this.columnGroups.push(
              ...JSON.parse(JSON.stringify(savedGroupFields)),
            );
            // Restore values
            this.rowData.forEach((r, i) => {
              if (savedRowValues[i]) {
                r[savedConfig.field] = savedRowValues[i].value;
                if (savedRowValues[i].cellCfg) {
                  if (!r._cellConfig) r._cellConfig = {};
                  r._cellConfig[savedConfig.field] = savedRowValues[i].cellCfg;
                }
              }
            });
            this.buildGridDefinitions();
            this.gridApi.setGridOption('columnDefs', this.gridColDefs);
            this.gridApi.setGridOption('rowData', [...this.rowData]);
            this.rebuildFormulaGraph();
          },
          redo: () => {
            this.deleteColumn(
              this.columnConfigs.findIndex(
                (c) => c.field === savedConfig.field,
              ),
            );
          },
        });
      }); // confirm subscribe
  }

  deleteRow(rowNode: IRowNode): void {
    const data = rowNode.data;
    const label = data.row_name || data.row_code || '';

    if (data._isTypeHeader) {
      this.appDialog
        .confirm({
          title: 'Xóa nhóm',
          message: `Xóa nhóm "${label}" và tất cả dòng con?`,
          status: 'error',
          confirmText: 'Xóa',
          cancelText: 'Hủy',
        })
        .subscribe((confirmed) => {
          if (!confirmed) return;
          const typeCode = data.row_code;
          const catalogField = data._catalogField;
          const removedRows = this.rowData
            .filter(
              (r) =>
                r._catalogField === catalogField &&
                (r.row_code === typeCode || !r._isTypeHeader),
            )
            .map((r) => ({ ...r }));
          const removedIndices = this.rowData.reduce((acc: number[], r, i) => {
            if (
              r._catalogField === catalogField &&
              (r.row_code === typeCode || !r._isTypeHeader)
            )
              acc.push(i);
            return acc;
          }, []);
          this.rowData = this.rowData.filter(
            (r) =>
              !(
                r._catalogField === catalogField &&
                (r.row_code === typeCode || !r._isTypeHeader)
              ),
          );
          this.gridApi.setGridOption('rowData', [...this.rowData]);
          this.recalcGridHeight();
          this.rebuildFormulaGraph();
          this.pushUndo({
            type: 'row_delete',
            description: `Xóa nhóm ${label}`,
            undo: () => {
              removedIndices.forEach((origIdx, i) => {
                this.rowData.splice(origIdx, 0, removedRows[i]);
              });
              this.gridApi.setGridOption('rowData', [...this.rowData]);
              this.recalcGridHeight();
            },
            redo: () => {
              this.rowData = this.rowData.filter(
                (r) =>
                  !(
                    r._catalogField === catalogField &&
                    (r.row_code === typeCode || !r._isTypeHeader)
                  ),
              );
              this.gridApi.setGridOption('rowData', [...this.rowData]);
              this.recalcGridHeight();
            },
          });
        });
    } else {
      this.appDialog
        .confirm({
          title: 'Xóa dòng',
          message: `Xóa dòng "${label}"?`,
          status: 'error',
          confirmText: 'Xóa',
          cancelText: 'Hủy',
        })
        .subscribe((confirmed) => {
          if (!confirmed) return;
          const savedRow = { ...data };
          const idx = this.rowData.indexOf(data);
          if (idx !== -1) this.rowData.splice(idx, 1);
          this.gridApi.applyTransaction({ remove: [data] });
          this.recalcGridHeight();
          this.rebuildFormulaGraph();
          this.pushUndo({
            type: 'row_delete',
            description: `Xóa dòng ${label}`,
            undo: () => {
              if (idx !== -1) this.rowData.splice(idx, 0, savedRow);
              else this.rowData.push(savedRow);
              this.gridApi.setGridOption('rowData', [...this.rowData]);
              this.recalcGridHeight();
            },
            redo: () => {
              const i = this.rowData.findIndex(
                (r) => r.row_code === savedRow.row_code,
              );
              if (i !== -1) this.rowData.splice(i, 1);
              this.gridApi.setGridOption('rowData', [...this.rowData]);
              this.recalcGridHeight();
            },
          });
        });
    }
  }

  // === QUẢN LÝ NHÓM CỘT (Column Groups) ===

  // ─── HELPERS ĐỆ QUY ────────────────────────────────────────────

  /** Tìm nhóm theo path (mảng groupId từ root) */
  findGroupByPath(
    path: string[],
    groups: ColumnGroupConfig[] = this.columnGroups,
  ): ColumnGroupConfig | null {
    if (!path || path.length === 0) return null;
    const [first, ...rest] = path;
    const found = groups.find((g) => g.groupId === first);
    if (!found) return null;
    if (rest.length === 0) return found;
    return this.findGroupByPath(rest, found.children || []);
  }

  /** Editing now happens in dialog component */

  /** Tính chiều sâu lồng nhau tối đa (0 = không có nhóm). Node có lá trực tiếp = depth tối thiểu 1. */
  calcGroupDepth(groups: ColumnGroupConfig[] = this.columnGroups): number {
    if (!groups || groups.length === 0) return 0;
    let max = 0;
    for (const g of groups) {
      const hasLeaves = (g.columnFields?.length ?? 0) > 0;
      const childDepth = g.children && g.children.length > 0 ? 1 + this.calcGroupDepth(g.children) : 0;
      const own = Math.max(hasLeaves ? 1 : 0, childDepth);
      max = Math.max(max, own);
    }
    return max;
  }

  /** Xóa đệ quy một field khỏi tất cả nhóm (mọi cấp), đồng thời dọn items */
  removeFieldFromAllGroups(
    field: string,
    groups: ColumnGroupConfig[] = this.columnGroups,
  ): void {
    for (const g of groups) {
      g.columnFields = (g.columnFields ?? []).filter((f) => f !== field);
      if (g.children && g.children.length > 0) {
        this.removeFieldFromAllGroups(field, g.children);
      }
      reconcileColumnGroupItems(g);
    }
  }

  // Column group CRUD methods moved to ColumnGroupDialogComponent


  openColumnGroupDialog(): void {
    this.isColumnGroupDialogOpen = true;
  }

  onColumnGroupsApply(groups: ColumnGroupConfig[]): void {
    this.columnGroups = groups;
    this.columnGroups.forEach(reconcileColumnGroupItems);
    this.buildGridDefinitions();
  }

  // === WORKFLOW ===

  loadDeployedWorkflows(): void {
    this.workflowService
      .getDeployed()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => (this.deployedWorkflows = data),
        error: () => (this.deployedWorkflows = []),
      });
  }

  // === LƯU TRỮ DỮ LIỆU GRID (10.1) ===

  /** Sync columnConfigs order to match the current visual column order in AG Grid */
  private syncColumnOrderFromGrid(): void {
    if (!this.gridApi) return;
    const displayedColumns = this.gridApi.getAllDisplayedColumns();
    if (!displayedColumns || displayedColumns.length === 0) return;

    const displayedFields = displayedColumns
      .map(col => col.getColDef().field)
      .filter((f): f is string => !!f && f !== 'row_code');

    const configMap = new Map(this.columnConfigs.map(c => [c.field, c]));
    const reordered: ColumnConfig[] = [];

    // First: add configs in displayed order
    for (const field of displayedFields) {
      const config = configMap.get(field);
      if (config) {
        reordered.push(config);
        configMap.delete(field);
      }
    }
    // Then: append any remaining configs not currently displayed (safety)
    for (const config of configMap.values()) {
      reordered.push(config);
    }

    this.columnConfigs = reordered;
  }

  openSaveDialog(): void {
    this.syncColumnOrderFromGrid();
    if (this.currentTemplateId) {
      this.saveCurrentTemplate();
      return;
    }
    this.isSaveDialogOpen = true;
  }

  onSaveTemplateSubmit(result: SaveTemplateResult): void {
    this.templateSaving = true;
    const rows = this.serializeRows();
    this.gridTemplateService
      .createTemplate({
        code: result.code,
        name: result.name,
        description: result.description,
        columnConfigs: JSON.stringify(this.columnConfigs),
        columnGroups: JSON.stringify(this.columnGroups),
        rows,
        processDefinitionKey: this.selectedProcessKey,
        reportDepartments: this.selectedReportDepartments,
        reportFcGroups: this.selectedReportFcGroups,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.currentTemplateId = created.id;
          this.currentTemplateName = created.name;
          // Đồng bộ advancedSettingsData để dialog "Nâng cao" luôn có dữ liệu mới nhất
          // (trước đây chưa update → code/name rỗng khi mở dialog sau lần tạo đầu tiên)
          this.advancedSettingsData = {
            code: created.code,
            name: created.name,
            processDefinitionKey: this.selectedProcessKey,
            reportDepartments: this.selectedReportDepartments,
            reportFcGroups: this.selectedReportFcGroups,
            periodType: created.periodType ?? 'MONTH',
            useDueDate: created.useDueDate ?? false,
          };
          this.templateSaving = false;
          this.isSaveDialogOpen = false;
          this.saveSavedStateSnapshot();
          this.appDialog.success(
            'Đã lưu biểu mẫu thành công!',
          );
        },
        error: (err) => {
          this.templateSaving = false;
          this.appDialog.error(
            'Lỗi lưu biểu mẫu: ' +
              (err.error?.message || err.message),
          );
        },
      });
  }

  private saveCurrentTemplate(): void {
    if (!this.currentTemplateId) return;
    this.templateSaving = true;
    const rows = this.serializeRows();
    this.gridTemplateService
      .updateTemplate(this.currentTemplateId, {
        columnConfigs: JSON.stringify(this.columnConfigs),
        columnGroups: JSON.stringify(this.columnGroups),
        rows,
        processDefinitionKey: this.selectedProcessKey,
        reportDepartments: this.selectedReportDepartments,
        reportFcGroups: this.selectedReportFcGroups,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.templateSaving = false;
          this.saveSavedStateSnapshot();
          this.appDialog.success(
            'Đã cập nhật biểu mẫu!',
          );
        },
        error: (err) => {
          this.templateSaving = false;
          this.appDialog.error(
            'Lỗi cập nhật: ' +
              (err.error?.message || err.message),
          );
        },
      });
  }

  private serializeRows(): any[] {
    // Read directly from AG Grid nodes — always has latest data
    // (this.rowData may be stale if renderers updated values via setData)
    const rows: any[] = [];
    if (this.gridApi) {
      let i = 0;
      this.gridApi.forEachNode((node) => {
        if (!node.data) return;
        const r = node.data;
        const rowDataObj: any = {};
        this.columnConfigs.forEach((c) => {
          if (r[c.field] !== undefined) rowDataObj[c.field] = r[c.field];
        });
        rows.push({
          rowCode: r.row_code || '',
          rowName: r.row_name || '',
          rowData: JSON.stringify(rowDataObj),
          cellConfig: r._cellConfig ? JSON.stringify(r._cellConfig) : null,
          isTypeHeader: r._isTypeHeader || false,
          catalogField: r._catalogField || null,
          sortOrder: i++,
        });
      });
    }
    return rows;
  }

  openTemplateList(): void {
    this.templateLoading = true;
    this.templateList = [];
    this.gridTemplateService
      .getTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (list) => {
          this.templateList = list;
          this.templateLoading = false;
        },
        error: () => (this.templateLoading = false),
      });
    this.isOpenDialogOpen = true;
  }

  onLoadTemplateFromList(id: number): void {
    this.undoRedoService.clear();
    this.templateLoading = true;
    this.gridTemplateService
      .getTemplate(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.advancedSettingsData = {
             code: detail.code,
              name: detail.name,
              processDefinitionKey: detail.processDefinitionKey ?? null,
              reportDepartments: detail.reportDepartments ?? [],
              reportFcGroups: detail.reportFcGroups ?? [],
              periodType: detail.periodType ?? 'MONTH',
              useDueDate: detail.useDueDate ?? false,
          };
          this.currentTemplateId = detail.id;
          this.currentTemplateName = detail.name;
          this.selectedProcessKey = detail.processDefinitionKey || null;
          this.selectedReportDepartments = detail.reportDepartments ?? [];
          this.selectedReportFcGroups = detail.reportFcGroups ?? [];

          // Parse columnConfigs
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

          // Parse rows
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

          this.buildGridDefinitions();
          if (this.gridApi) {
            // Explicit setGridOption — Angular CD chưa propagate [columnDefs] khi
            // load template chạy đồng bộ → gridApi.getColumns() return stale.
            this.gridApi.setGridOption('columnDefs', this.gridColDefs);
            this.gridApi.setGridOption('rowData', [...this.rowData]);
          }
          // Build dep graph + recompute mọi formula sau khi columns + rowData sẵn sàng.
          // Preload GETDATA/LOOKUP cache trước rebuild để hiển thị giá trị thực thay vì 0.
          this.preloadBuilderGetdataAndThen(() => {
            this.rebuildFormulaGraph();
            this.loadPermissions();
            this.templateLoading = false;
            this.saveSavedStateSnapshot();
            this.scheduleValidationRecalc();
          });
          return;
        },
        error: (err) => {
          this.templateLoading = false;
          this.appDialog.error(
            'Lỗi tải biểu mẫu: ' +
              (err.error?.message || err.message),
          );
        },
      });
  }

  loadTemplateById(id: number): void {
    this.undoRedoService.clear();
    this.gridTemplateService
      .getTemplate(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.advancedSettingsData = {
              code: detail.code,
              name: detail.name,
              processDefinitionKey: detail.processDefinitionKey ?? null,
              reportDepartments: detail.reportDepartments ?? [],
              reportFcGroups: detail.reportFcGroups ?? [],
              periodType: detail.periodType ?? 'MONTH',
              useDueDate: detail.useDueDate ?? false,
          };
          this.currentTemplateId = detail.id;
          this.currentTemplateName = detail.name;
          this.selectedProcessKey = detail.processDefinitionKey || null;
          this.selectedReportDepartments = detail.reportDepartments ?? [];
          this.selectedReportFcGroups = detail.reportFcGroups ?? [];
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
          this.buildGridDefinitions();
          if (this.gridApi) {
            // Explicit setGridOption columnDefs: Angular CD chua propagate khi load
            // chay dong bo, gridApi.getColumns() se return stale.
            this.gridApi.setGridOption('columnDefs', this.gridColDefs);
            this.gridApi.setGridOption('rowData', [...this.rowData]);
          }
          // Build dep graph + recompute formula sau khi columns + rowData san sang.
          // Route ?templateId= goi ham nay; thieu rebuild thi shadow store rong
          // -> formula cell hien thi raw data (0/blank).
          // Preload GETDATA/LOOKUP TRƯỚC khi rebuild — đảm bảo lookup cache hot, không
          // phụ thuộc context leak từ ExcelRender (singleton). Ctrl+F5 sẽ hoạt động đúng.
          this.preloadBuilderGetdataAndThen(() => {
            this.rebuildFormulaGraph();
            this.loadPermissions();
            this.saveSavedStateSnapshot();
            this.scheduleValidationRecalc();
          });
        },
        error: (err) =>
          this.appDialog.error(
            'Lỗi tải biểu mẫu: ' +
              (err.error?.message || err.message),
          ),
      });
  }

  onDeleteTemplateFromList(id: number): void {
    this.appDialog
      .confirm({
        title: 'Xóa biểu mẫu',
        message:
          'Bạn chắc chắn muốn xóa biểu mẫu này?',
        status: 'error',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.gridTemplateService
          .deleteTemplate(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.templateList = this.templateList.filter((t) => t.id !== id);
              if (this.currentTemplateId === id) {
                this.currentTemplateId = null;
                this.currentTemplateName = '';
              }
              this.appDialog.success(
                'Đã xóa biểu mẫu thành công',
              );
            },
            error: (err) =>
              this.appDialog.error(
                'Lỗi xóa: ' + (err.error?.message || err.message),
              ),
          });
      });
  }

  // === QUYỀN CHỈNH SỬA (10.9) ===

  canEdit(field: string, rowCode: string): boolean {
    if (this.permissions.length === 0) return true;

    for (const p of this.permissions) {
      // LOCK — applies to everyone
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
      // DENY — applies to specific user
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

    // ALLOW check: if there are ALLOW permissions for this target, user must be in the list
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

  isFieldLocked(field: string): boolean {
    return this.permissions.some(
      (p) =>
        p.permissionType === 'LOCK' &&
        p.level === 'COLUMN' &&
        p.targetField === field,
    );
  }

  isRowLocked(rowCode: string): boolean {
    return this.permissions.some(
      (p) =>
        p.permissionType === 'LOCK' &&
        p.level === 'ROW' &&
        p.targetRowCode === rowCode,
    );
  }

  openPermissionDialog(): void {
    this.isPermDialogOpen = true;
  }

  openButtonManagerDialog(): void {
    this.isButtonDialogOpen = true;
  }

  openAdvancedSettings(): void {
    // Sync giá trị preview hiện tại vào dialog data trước khi mở (đảm bảo
    // user thấy giá trị đang dùng, không phải default cũ).
    this.advancedSettingsData = {
      ...this.advancedSettingsData,
      previewYear: this.previewYear,
      previewMonth: this.previewMonth,
    };
    this.isAdvancedSettingsOpen = true;
  }

  savePermission(perm: any): void {
    if (!this.currentTemplateId) return;
    this.gridPermissionService
      .savePermission(this.currentTemplateId, perm)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.appDialog.success('Đã cập nhật quyền!');
          this.isPermDialogOpen = false;
          this.loadPermissions();
        },
        error: (err) =>
          this.appDialog.error(
            'Lỗi thêm quyền: ' +
              (err.error?.message || err.message),
          ),
      });
  }
isItemSelected(item: string): boolean {
  return (this.controlItemType.value || []).includes(item);
}

private applyItemTypeFilter(selectedNames: string[]): void {
  if (!this.gridApi) return;

  if (selectedNames.length === 0) {
    // Không filter → hiện tất cả
    this.gridApi.setGridOption('rowData', [...this.rowData]);
    return;
  }

  // Lọc các row thuộc catalog type được chọn
  const filteredRows = this.rowData.filter(row => {
    if (!row._catalogField) return true; // dòng thủ công luôn hiện
    if (row._isTypeHeader) {
      return selectedNames.includes((row[row._catalogField] ?? '').trim());
    }
    // Tìm type header cha của row này
    const rowIdx = this.rowData.indexOf(row);
    for (let i = rowIdx - 1; i >= 0; i--) {
      const prev = this.rowData[i];
      if (prev._isTypeHeader && prev._catalogField === row._catalogField) {
        return selectedNames.includes(prev[prev._catalogField]);
      }
    }
    return true;
  });

  this.gridApi.setGridOption('rowData', filteredRows);
}
  private loadPermissions(): void {
    if (!this.currentTemplateId) {
      this.permissions = [];
      return;
    }
    this.gridPermissionService
      .getPermissions(this.currentTemplateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((perms) => {
        this.permissions = perms;
        this.buildGridDefinitions();
        if (this.gridApi) this.gridApi.refreshCells({ force: true });
      });
  }

  // dialog cấu hình nâng cao
  onAdvancedSettingsSave(event: any): void {
    // Preview year/month là UI state CỤC BỘ — không persist vào template.
    // Apply ngay vào builder rồi re-render header dynamic.
    if (event.previewYear != null && event.previewMonth != null) {
      const changed =
        event.previewYear !== this.previewYear || event.previewMonth !== this.previewMonth;
      this.previewYear = event.previewYear;
      this.previewMonth = event.previewMonth;
      if (changed) this.onPreviewPeriodChange();
    }
    this.gridTemplateService
      .updateTemplate(this.currentTemplateId!, {
        name: event.name,
        code: event.code,
        processDefinitionKey: event.processDefinitionKey ?? null,
        reportDepartments: event.reportDepartments ?? [],
        reportFcGroups: event.reportFcGroups ?? [],
        periodType: event.periodType ?? 'MONTH',
        useDueDate: event.useDueDate ?? false,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.selectedProcessKey = event.processDefinitionKey ?? null;
          this.selectedReportDepartments = event.reportDepartments ?? [];
          this.selectedReportFcGroups = event.reportFcGroups ?? [];
          this.isAdvancedSettingsOpen = false;
          if (this.currentTemplateId) {
            this.loadTemplateById(+this.currentTemplateId);
          }
          // Reload danh sách menu options cho dropdown "Nhóm chức năng báo cáo"
          // (phòng trường hợp menu sidebar được chỉnh ở tab khác trong lúc form đang mở).
          this.refreshSidebarMenuOptions();
          this.appDialog.success('Đã cập nhật cấu hình biểu mẫu!');
        },
        error: (err) =>
          this.appDialog.error(
            'Lỗi cập nhật cấu hình: ' + (err.error?.message || err.message),
          ),
      });
  }

  /** Invalidate cache + refetch để view hiện tại có data mới ngay. */
  private refreshSidebarMenuOptions(): void {
    this.sidebarMenuService.invalidateMenuOptionsCache();
    this.sidebarMenuService
      .getMenuOptionsForFcGroup()
      .pipe(takeUntil(this.destroy$))
      .subscribe((options) => {
        this.sidebarMenuOptions = options;
        this.itemTypes = options.map((o) => o.label);
      });
  }

  onAdvancedSettingsCancel(): void {
    this.isAdvancedSettingsOpen = false;
  }

  onPermissionSaved(event: GridPermissionRequest): void {
    this.savePermission(event);
  }

  onPermDialogClose(): void {
    this.isPermDialogOpen = false;
  }

  // ============================
  // COPY / PASTE + RANGE SELECTION (port từ Excel Render, dùng chung shared/excel-paste)
  // ============================

  private readonly pasteHighlight: PasteHighlightHandle = createPasteHighlight({
    styleId: 'builder-paste-skip-highlight-style',
    animationName: 'builder-paste-skip-flash',
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

  @HostListener('document:keydown.escape')
  public onEscapeBuilder(): void {
    this.clearRangeSelection();
  }

  private serializeRangeAsTsv(): string {
    const b = this.rangeBounds();
    if (!b || !this.gridApi) return '';
    return serializeTsv(this.gridApi, b);
  }

  private getFormattedCellText(node: IRowNode, column: Column): string {
    return getFmtCellText(this.gridApi, node, column);
  }

  handleGridCopy(event: ClipboardEvent): void {
    if (!this.gridApi) return;
    const target = event.target as HTMLElement;
    if (
      target?.closest(
        '.ag-cell-inline-editing, .ag-popup-editor, input, textarea, [contenteditable="true"]',
      )
    )
      return;
    const sel = document.getSelection();
    if (sel && sel.toString().length > 0) return;

    // Range copy
    if (this.rangeCellCount() > 1) {
      const b = this.rangeBounds();
      const tsv = this.serializeRangeAsTsv();
      if (tsv && b) {
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData?.setData('text/plain', tsv);
        // Buffer in-memory: capture format snapshot để paste khôi phục bold/italic/màu
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
    // Single cell copy
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

