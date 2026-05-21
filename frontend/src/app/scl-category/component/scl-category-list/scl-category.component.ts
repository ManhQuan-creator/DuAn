import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiMultiSelectModule, TuiSelectModule } from '@taiga-ui/kit';
import { CellClickedEvent, ColDef, GridApi, GridReadyEvent, RowDoubleClickedEvent, ValueGetterParams } from 'ag-grid-community';
import { saveAs } from 'file-saver';
import { debounceTime, distinctUntilChanged, forkJoin, map, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../auth/auth.service';
import { FilterCatalogItemRequest } from '../../../catalog-manager/models/catalog.model';
import { CatalogService } from '../../../catalog-manager/service/catalog.service';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';
import { ExcelExportService } from '../../../excel-builder/service/excel-export.service';
import { AcceptDialogComponent, AcceptDialogData } from '../../../shared/components/accept-dialog/accept-dialog.component';
import { AgGridHeaderAction, AgGridHeaderComponent } from '../../../shared/components/ag-grid-header/ag-grid-header.component';
import { AgGridWrapperComponent } from '../../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../../../shared/components/custom-pagination/custom-pagination.component';
import { RenderActionComponent } from '../../../shared/components/grid-custom-cell/render-action/render-action.component';
import { MultiSelectComponent, SingleSelectComponent } from '../../../shared/components/multi-select';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppDialogService } from '../../../shared/dialog.service';
import { DATE_FORMAT_ENUM } from '../../../shared/enum/date-time.enum';
import { Option } from '../../../shared/models/common.model';
import { OrganizationService } from '../../../shared/organization.service';
import { formatDateUtils } from '../../../shared/utils/date-format.util';
import { AddSclCategoryComponent } from '../../dialogs/add-scl-category/add-scl-category.component';
import { ChangeStatusComponent } from '../../dialogs/change-status/change-status.component';
import { RejectDialogComponent } from '../../dialogs/reject-dialog/reject-dialog.component';
import { SendAssesmentDialogComponent } from '../../dialogs/send-assesment-dialog/send-assesment-dialog.component';
import { RejectionAssessment } from '../../model/scl-assessment.model';
import { SclCategorFilter, SclCategory } from '../../model/scl-category.model';
import { PcOrganizationUnitService } from '../../service/pc-organization-unit.service';
import { SclCategoryService } from '../../service/scl-category.service';
import { StatusCellRenderComponent } from '../render-action/status-cell-render.component';

@Component({
  selector: 'app-scl-category',
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiSvgModule,
    TuiInputModule,
    TuiMultiSelectModule,
    TuiSelectModule,
    PageHeaderComponent,
    AgGridHeaderComponent,
    CustomPaginationComponent,
    AgGridWrapperComponent,
    AcceptDialogComponent,
    AddSclCategoryComponent,
    SendAssesmentDialogComponent,
    RejectDialogComponent,
    ChangeStatusComponent,
    SingleSelectComponent,
    MultiSelectComponent
],
  templateUrl: './scl-category.component.html',
  styleUrls: ['./scl-category.component.scss']
})
export class SclCategoryComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly sclCategoryService = inject(SclCategoryService);
  readonly organizationService = inject(OrganizationService);
  readonly excelExportService = inject(ExcelExportService);
  readonly dialog = inject(AppDialogService);
  readonly catalogService = inject(CatalogService);
  readonly authService = inject(AuthService);
  readonly pcOrganizationService = inject(PcOrganizationUnitService);
  readonly destroy$ = new Subject<void>();
  private gridApi?: GridApi;
  private readonly companyLeaderPositions = new Set(['GD', 'PGD']);
  private readonly unitEditableStatuses = new Set(['TAO_MOI', 'TU_CHOI']);
  private readonly hiddenEditStatuses = new Set(['DA_THAM_DINH', 'DA_DUYET_HM']);
  public assetType: string | null = null;
  readonly yearOptions: string[] = Array.from(
    { length: new Date().getFullYear() - 1980 + 1 },
    (_, i) => String(1980 + i + 1),
  ).reverse();

  readonly yearOptionItems: Option[] = this.yearOptions.map((yearPlan) => ({ value: yearPlan, label: yearPlan }));

  public breadcrumbs: PageHeaderBreadcrumb[] = [
    {
      label: 'Trang chủ',
      link: '/',
    },
    {
      label: 'Quy trình SCL',
      link: '/scl-category',
    },
    {
      label: 'Quản lý hạng mục SCL',
      link: '/scl-category',
    },
  ];
  public title = 'Danh sách hạng mục SCL';
  unitFilter: string | null = null
  assetTypeFilter: string[] = [];
  planTypeFilter: string[] = [];
  registerTypeFilter: string[] = [];
  progressFilter: string[] = [];
  categoryCodeFilter = '';
  categoryNameFilter = '';
  yearFilter: string | null = String(new Date().getFullYear());
  statusFilter: string[] = [];
  readonly searchSubject = new Subject<string>();
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  loading = false;
  deletingCategoryIds: number[] = [];
  templateList: SclCategory[] = [];
  progressOptions: string[] = [];
  organizations: any[] = [];
  listUnitOptions: Option[] = [];
  listAssetTypeOptions: Option[] = [];
  listPlanTypeOptions: Option[] = [];
  assessmentUnitOptions: Option[] = [];
  statusOptions?: CatalogItem[];
  pcOptions: string[] = [];
  readonly stringifyProgress = (progress: string): string =>
    progress === this.ALL_VALUE ? 'Tất cả' : progress;
  readonly stringifyUnit = (unit: Option): string => unit.label;
  readonly stringifyRegisterType = (registerType: Option): string => registerType.label;
  readonly stringifyAssetType = (assetType: Option): string => assetType.label;
  readonly stringifyPlanType = (planType: Option): string => planType.label;
  readonly stringifyYear = (yearPlan: string): string => yearPlan;
  readonly stringifyStatus = (item: CatalogItem): string => item?.name || '';

  readonly ALL_VALUE = '__ALL__';
  readonly ALL_OPTION: Option = { value: this.ALL_VALUE, label: 'Tất cả' };
  readonly statusAllOption: CatalogItem = { id: this.ALL_VALUE, name: 'Tất cả' } as CatalogItem;

  listRegisterTypeOptions: Option[] = [
    { value: 'tạm tính', label: 'Tạm tính' },
    { value: 'chính thức', label: 'Chính thức' },
    { value: 'bổ sung', label: 'Bổ sung' },
    { value: 'chuyển tiếp', label: 'Chuyển tiếp' },
  ];

  planTypeDisplayOptions: Option[] = [this.ALL_OPTION];
  assetTypeDisplayOptions: Option[] = [this.ALL_OPTION];
  registerTypeDisplayOptions: Option[] = [this.ALL_OPTION, ...this.listRegisterTypeOptions];
  progressDisplayOptions: Option[] = [{ value: this.ALL_VALUE, label: 'Tất cả' }];
  statusDisplayOptions: Option[] = [this.ALL_OPTION];

  isOpen = false;
  isOpenAdd = false;
  isOpenAssessment = false;
  isOpenReject = false;
  isOpenUpdateStatus = false;
  selectedUnits: Option[] = [];
  disableAssessment = true;
  disableSendApproveAction = true;
  disableApprovalAction = true;
  disableRejectAction = true;
  disableUpdateStatus = true;

  dialogData: AcceptDialogData = {
    title: '',
    message: '',
    status: 'info',
    confirmText: '',
    cancelText: '',
  };
  headerTitle: string = 'Quản lý lập kế hoạch năm';
  public dataDialog: { action: 'delete' | 'sendApprove' | 'approval' | 'reject' | 'signature'; ids: number[] } | null = null;
  selectedIds: number[] = [];
  gridHeaderActionsCached: AgGridHeaderAction[] = [];

  get isEVNNPCOrBanKH(): boolean {
    const orgGroupCode = this.authService.currentUser?.orgGroupCode ?? '';
    const deptCode = this.authService.currentUser?.deptCode ?? '';
    return orgGroupCode.toUpperCase() === 'EVNNPC' && (deptCode == null || deptCode.toUpperCase() === 'BAN_KH');
  }
  
  get isPcCompanyUser(): boolean {
    return (this.authService.currentUser?.orgGroupCode ?? '').toUpperCase() === 'PC_COMPANY';
  }

  get isCompanyLeader(): boolean {
    const positionCode = (this.authService.currentUser?.positionCode ?? '').toUpperCase();
    return this.isPcCompanyUser && this.companyLeaderPositions.has(positionCode);
  }

  get showSendApproveButton(): boolean {
    return this.isPcCompanyUser && !this.isCompanyLeader;
  }

  get showApprovalButton(): boolean {
    return this.isCompanyLeader;
  }

  get showRejectButton(): boolean {
    return this.isCompanyLeader;
  }

  get showAssessmentButton(): boolean {
    return !this.isPcCompanyUser;
  }

  private updateGridHeaderActions(): void {
    this.gridHeaderActionsCached = [
      {
        id: 'exportReport',
        label: 'Xuất báo cáo',
        icon: 'tuiIconDownload',
      },
      {
        id: 'sendApprove',
        label: 'Gửi duyệt',
        icon: 'tuiIconSend',
        visible: this.showSendApproveButton,
        disabled: this.disableSendApproveAction,
      },
      {
        id: 'reject',
        label: 'Từ chối',
        icon: 'tuiIconX',
        visible: this.showRejectButton,
        disabled: this.disableRejectAction,
      },
      {
        id: 'approval',
        label: 'Phê duyệt',
        icon: 'tuiIconCheck',
        visible: this.showApprovalButton,
        disabled: this.disableApprovalAction,
      },
      {
        id: 'export',
        label: 'Xuất danh sách',
        icon: 'tuiIconDownload',
      },
      {
        id: 'updateStatus',
        label: 'Đổi trạng thái',
        icon: 'tuiIconEdit',
        disabled: this.disableUpdateStatus,
      },
      {
        id: 'assessment',
        label: 'Chọn ban thẩm định',
        icon: 'tuiIconSend',
        visible: this.showAssessmentButton,
        disabled: this.disableAssessment,
      }
    ];
  }

  get gridHeaderActions(): AgGridHeaderAction[] {
    return this.gridHeaderActionsCached;
  }

  onGridHeaderAction(actionId: string): void {
    const handlers: Record<string, () => void> = {
      exportReport: () => this.exportReport(),
      sendApprove: () => this.handleSendApproveSelected(),
      reject: () => this.handleRejectSelected(),
      approval: () => this.handleApprovalSelected(),
      export: () => this.handleExportSelected(),
      assessment: () => this.handleAssessmentSelected(),
      createNew: () => this.createNew(),
      updateStatus: () => this.handleUpdateStatusSelected(),
    };

    handlers[actionId]?.();
  }

  onSelectionChanged(selectedRows: SclCategory[]): void {
    this.selectedIds = (selectedRows ?? [])
      .map((r) => (r as { id?: unknown })?.id)
      .map((id) => (typeof id === 'string' ? Number(id) : id))
      .filter((id): id is number => Number.isFinite(id));
    const rows = selectedRows ?? [];
    const hasInvalidAssessmentStatus = rows.some(
      (r) => r.status === 'DA_GUI_TD' || r.status === 'DA_THAM_DINH'
    );
    this.disableAssessment = this.selectedIds.length === 0 || hasInvalidAssessmentStatus;
    this.disableSendApproveAction =
      this.selectedIds.length === 0 ||
      !rows.every((r) => {
        const status = r.status ?? '';
        return status === 'TAO_MOI' || status === 'TU_CHOI';
      });
    this.disableApprovalAction = this.disableRejectAction =
      this.selectedIds.length === 0 || !rows.every((r) => (r.status ?? '') === 'GUI_DUYET_HM');
    this.disableUpdateStatus = this.selectedIds.length === 0;
    this.updateGridHeaderActions();
  }

  public defaultColDef: ColDef = {
    onCellClicked: (params: CellClickedEvent<SclCategory>) => {
      const target = params.event?.target as HTMLElement | null;
      // Skip checkbox (AG Grid tự toggle), action button — tránh double-toggle / chặn action
      if (target?.closest('.ag-checkbox-input-wrapper, button, a, input, [role="button"]')) return;
      const node = params.node;
      if (!node) return;
      if (params.column?.getColId() === 'select') {
        // Cột checkbox: toggle additive (giữ các row khác đang chọn)
        node.setSelected(!node.isSelected(), false);
      } else {
        // Cột data: single-select (replace)
        node.setSelected(true, true);
      }
    },
  };

  public columnDefs: ColDef[] = [
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
      width: 70,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      valueGetter: (params: ValueGetterParams<SclCategory>) => {
        const idx = params.node?.rowIndex ?? 0;
        return this.pageNum * this.pageSize + idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'PC',
      field: 'pc',
      minWidth: 80,
      flex: 1,
    },
    {
      headerName: 'Đơn vị',
      field: 'unit',
      minWidth: 140,
    },
    {
      headerName: 'Mã hạng mục',
      field: 'categoryCode',
      minWidth: 160,
      flex: 1,
    },
    {
      headerName: 'Mã tài sản',
      field: 'assetCode',
      minWidth: 160,
      flex: 1,
    },
    {
      headerName: 'Tên hạng mục',
      field: 'categoryName',
      minWidth: 220,
      flex: 2.5, // quan trọng → rộng hơn
    },
    {
      headerName: 'Phân loại',
      field: 'assetType',
      minWidth: 140,
      flex: 1.2,
    },
    {
      headerName: 'Loại kế hoạch',
      field: 'planType',
      minWidth: 140,
      flex: 1.2,
    },
    {
      headerName: 'Loại đăng ký',
      field: 'registerType',
      minWidth: 140,
      flex: 1.2,
    },
    {
      headerName: 'Tiến độ',
      field: 'progress',
      minWidth: 130,
    },
    {
      headerName: 'Năm SCL gần nhất',
      field: 'lastSclYear',
      width: 200,
    },
    {
      headerName: 'Năm kế hoạch',
      field: 'yearPlan',
      width: 200,
    },
    {
      headerName: 'Trạng thái',
      field: 'status',
      width: 180,
      sortable: true,
      cellRenderer: StatusCellRenderComponent,
    },
    {
      headerName: 'Thời gian cập nhật',
      field: 'updatedAt',
      minWidth: 180,
      flex: 1.5,
      valueFormatter: (params) => formatDateUtils(params.value, DATE_FORMAT_ENUM.DD_MM_YYYY_HH_MM_SS),    
    },
    {
      headerName: 'Thao tác',
      width: 140,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        onDetail: (data: SclCategory) => this.onDetail(data),
        onEdit: (data: SclCategory) => this.editTemplate(data),
        showEdit: (data: SclCategory) => this.canEditCategory(data),
        onAssessment: (data: SclCategory) => this.handleAssessmentSelected(data),
        showAssessment: (data: SclCategory) =>
          this.showAssessmentButton &&
          data?.status !== 'DA_GUI_TD' &&
          data?.status !== 'DA_THAM_DINH',
      },
    },
  ];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const typeParam = params.get('type');
      this.assetType = (typeParam && typeParam !== 'all') ? typeParam : null;
      this.loadFilterOptions();
      this.loadData();
    });
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadData());
    
    this.loadPcOptions();
    this.loadProgressOptions();
    this.loadStatusOptions();
    this.updateGridHeaderActions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(): void {
    this.pageNum = 0;
    const signature = [
      this.unitFilter ?? '',
      this.categoryCodeFilter.trim(),
      this.categoryNameFilter.trim(),
      this.yearFilter ?? '',
      this.progressFilter.filter((value) => value !== this.ALL_VALUE).join(','),
      this.statusFilter.filter((value) => value !== this.ALL_VALUE).join(','),
      this.registerTypeFilter.filter((value) => value !== this.ALL_VALUE).join(','),
      this.planTypeFilter.filter((value) => value !== this.ALL_VALUE).join(','),
      this.assetTypeFilter.filter((value) => value !== this.ALL_VALUE).join(','),
    ].join('|');
    this.searchSubject.next(signature);
  }

  onUnitChange(): void {
    this.onSearchInput();
  }

  onUnitSelect(value: string | null): void {
    this.unitFilter = value;
    this.onSearchInput();
  }

  onPlanTypeChange(selectedValues: string[]): void {
    this.planTypeFilter = this.normalizeAllSelection(selectedValues, this.ALL_VALUE);
    this.onSearchInput();
  }

  onStatusChange(selectedValues: string[]): void {
    this.statusFilter = this.normalizeAllSelection(selectedValues, this.ALL_VALUE);
    this.onSearchInput();
  }

  onProgressChange(selectedValues: string[]): void {
    this.progressFilter = this.normalizeAllSelection(selectedValues, this.ALL_VALUE);
    this.onSearchInput();
  }

  onAssetTypeChange(selectedValues: string[]): void {
    this.assetTypeFilter = this.normalizeAllSelection(selectedValues, this.ALL_VALUE);
    this.onSearchInput();
  }

  onRegisterTypeChange(selectedValues: string[]): void {
    this.registerTypeFilter = this.normalizeAllSelection(selectedValues, this.ALL_VALUE);
    this.onSearchInput();
  }

  private loadFilterOptions(): void {
    forkJoin({
      assessmentUnits: this.organizationService.getAll(),
      unitOptions: this.loadUnitFilterOptions(),
      listAssetType: this.catalogService.getCatalogs('SCL_PHANLOAI'),
      listPlanType: this.catalogService.getCatalogs('SCL_KEHOACH'),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ assessmentUnits, unitOptions, listAssetType, listPlanType }) => {
          this.assessmentUnitOptions = assessmentUnits
            .map((org) => ({ value: org.orgCode, label: org.orgName }))
            .filter((option): option is Option => !!option.label);
          this.listUnitOptions = unitOptions;
          this.syncUnitFilterWithOptions();
          this.listAssetTypeOptions = listAssetType
            .map((item) => ({ value: item.id, label: item.name }))
            .filter((option): option is Option => !!option.label);
          this.assetTypeDisplayOptions = [this.ALL_OPTION, ...this.listAssetTypeOptions];
          this.listPlanTypeOptions = listPlanType
            .map((item) => ({ value: item.id, label: item.name }))
            .filter((option): option is Option => !!option.label);
          this.planTypeDisplayOptions = [this.ALL_OPTION, ...this.listPlanTypeOptions];
        },
      });
  }

  private loadUnitFilterOptions() {
    const pc = this.authService.currentUser?.companyCode?.trim();

    if (pc) {
      return this.pcOrganizationService.getPcOrganizationUnits(pc).pipe(
        map((units) =>
          units
            .map((org) => ({ value: org.unit, label: `${org.unit} - ${org.name || org.unit}` }))
            .filter((option): option is Option => !!option.value && !!option.label),
        ),
      );
    }

    return this.catalogService.getCatalogs('CT_DIEN_LUC').pipe(
      map((units) =>
        units
          .map((item) => ({ value: item.id, label: `${item.id} - ${item.name}` }))
          .filter((option): option is Option => !!option.label),
      ),
    );
  }

  private syncUnitFilterWithOptions(): void {
    if (
      this.unitFilter &&
      !this.listUnitOptions.some((option) => option.value === this.unitFilter)
    ) {
      this.unitFilter = null;
      this.onSearchInput();
    }
  }

  loadData(): void {
    this.loading = true;
    const request: SclCategorFilter = {
      unit: this.unitFilter || undefined,
      categoryCode: this.categoryCodeFilter.trim() || undefined,
      categoryName: this.categoryNameFilter.trim() || undefined,
      yearPlan: this.yearFilter || undefined,
      progress: this.toOptionalArray(this.progressFilter.filter((value) => value !== this.ALL_VALUE)),
      status: this.toOptionalArray(this.statusFilter.filter((value) => value !== this.ALL_VALUE)),
      assetType: this.toOptionalArray(this.assetTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      planType: this.toOptionalArray(this.planTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      registerType: this.toOptionalArray(this.registerTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };

    this.sclCategoryService
      .searchCategories(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.templateList = res.content;
          this.pageNum = res.number;
          this.pageSize = res.size;
          this.totalRows = res.totalElements;
          this.loading = false;
          this.gridApi?.refreshCells({ force: true });
        },
        error: () => {
          this.templateList = [];
          this.totalRows = 0;
          this.loading = false;
          this.gridApi?.refreshCells({ force: true });
        },
      });
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  onPageChanged(event: { page: number }): void {
    this.pageNum = event.page - 1;
    this.loadData();
  }

  onPageSizeChanged(event: { pageSize: number }): void {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadData();
  }

  createNew(): void {
    this.isOpenAdd = true;
  }

  editTemplate(data: SclCategory): void {
    if (!this.canEditCategory(data)) return;

    const numericId = data?.id;

    if (typeof numericId !== 'number' || !Number.isFinite(numericId)) return;

    this.router.navigate(['/scl-category/scl-detail'], {
      queryParams: { type: 'category', id: numericId, mode: 'edit' },
    });
  }

  private canEditCategory(data?: SclCategory | null): boolean {
    const status = data?.status ?? '';
    
    return this.isPcCompanyUser
      ? this.unitEditableStatuses.has(status)
      : !this.hiddenEditStatuses.has(status);
  }

  deleteTemplate(data: SclCategory): void {
    const numericId = data?.id;

    if (typeof numericId !== 'number' || !Number.isFinite(numericId)) return;

    this.dialogData = {
      title: 'Xóa biểu mẫu',
      message: `Bạn có chắc chắn muốn xóa "${data.categoryName}" không?`,
      status: 'error',
      confirmText: 'Xóa',
      cancelText: 'Hủy'
    };

    this.dataDialog = { action: 'delete', ids: [numericId] };

    this.isOpen = true;
  }

  handleDeleteSelected() {
    this.isOpen = true;

    this.dialogData = {
      title: 'Xóa biểu mẫu',
      message: `Bạn có chắc chắn muốn xóa dữ liệu này không?`,
      status: 'error',
      confirmText: 'Xóa',
      cancelText: 'Hủy'
    };
    this.dataDialog = { action: 'delete', ids: this.selectedIds };
  }

  handleApprovalSelected() {
    this.isOpen = true;

    this.dialogData = {
      title: 'Phê duyệt',
      message: `Xác nhận phê duyệt các hạng mục đã chọn?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy'
    };
    this.dataDialog = { action: 'approval', ids: this.selectedIds };
  }

  handleSendApproveSelected() {
    this.isOpen = true;

    this.dialogData = {
      title: 'Gửi duyệt',
      message: `Xác nhận gửi duyệt các hạng mục đã chọn?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy'
    };
    this.dataDialog = { action: 'sendApprove', ids: this.selectedIds };
  }

  handleRejectSelected() {
    this.dataDialog = { action: 'reject', ids: this.selectedIds };
    this.isOpenReject = true;

    this.isOpen = true;

    this.dialogData = {
      title: 'Từ chối',
      message: `Xác nhận từ chối các hạng mục đã chọn?`,
      status: 'error',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy'
    };
    this.dataDialog = { action: 'reject', ids: this.selectedIds };
    this.isOpen = false;
    this.isOpenReject = true;
  }

  handleAssessmentSelected(data?: SclCategory) {
    if (data) {
      const numericId = data.id;

      if (typeof numericId !== 'number' || !Number.isFinite(numericId)) {
        return;
      }

      this.selectedIds = [numericId];
      this.disableAssessment = data.status === 'DA_GUI_TD' || data.status === 'DA_THAM_DINH';
    }

    if (this.disableAssessment) {
      return;
    }

    this.isOpenAssessment = true;
  }

  handleExportSelected(): void {
    const request: SclCategorFilter = {
      unit: this.unitFilter || undefined,
      categoryCode: this.categoryCodeFilter.trim() || undefined,
      categoryName: this.categoryNameFilter.trim() || undefined,
      yearPlan: this.yearFilter || undefined,
      progress: this.toOptionalArray(this.progressFilter.filter((value) => value !== this.ALL_VALUE)),
      status: this.toOptionalArray(this.statusFilter.filter((value) => value !== this.ALL_VALUE)),
      assetType: this.toOptionalArray(this.assetTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      planType: this.toOptionalArray(this.planTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      registerType: this.toOptionalArray(this.registerTypeFilter.filter((value) => value !== this.ALL_VALUE)),
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };

    this.sclCategoryService
      .exportCategories(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (!response.body) {
            this.dialog.error('Khong nhan duoc file export');
            return;
          }

          const fileName = this.getExportFileName(response.headers.get('content-disposition'));
          saveAs(response.body, fileName);
          this.dialog.success('Export danh sách hạng mục thành công');
        },
        error: (err) => {
          this.dialog.error(
            'Loi export: ' + (err?.error?.message || err?.message || 'Khong the export danh sach hang muc'),
          );
        },
      });
  }

  exportReport(): void {
    const request: SclCategorFilter = {
      yearPlan: this.yearFilter || undefined
    };

    this.sclCategoryService
      .exportReport(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (!response.body) {
            this.dialog.error('Không nhận được file export');
            return;
          }

          const fileName = this.getExportFileName(response.headers.get('content-disposition'));
          saveAs(response.body, fileName);
          this.dialog.success('Export báo cáo tổng hợp hạng mục thành công');
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi export: ' + (err?.error?.message || err?.message || 'Không thể export báo cáo tổng hợp hạng mục'),
          );
        },
      });
  }

  closeDialog() {
    this.isOpenAssessment = false;
    this.selectedUnits = []; // reset luôn
  }

  handleDialogOpenChange(open: boolean) {
    this.isOpenAssessment = open;

    if (!open) {
      this.closeDialog();
    }
  }

  assessmentConfirm() {
    const ids = this.selectedIds; // mảng id bạn chọn
    const unit = this.selectedUnits; // đơn vị nhận

    this.sclCategoryService.sendAssessment(ids, unit).subscribe({
      next: () => {
        this.dialog.success('Gửi thẩm định thành công');
        this.loadData();
      },
      error: (err) => {
        this.dialog.error('Gửi thẩm định lỗi');
        console.error('Lỗi:', err);
      }
    });
  }

  handleUpdateStatusSelected() {
    if (!this.selectedIds?.length) return;

    this.isOpenUpdateStatus = true;
  }

  onChangeStatusConfirmed(status: CatalogItem): void {
    if (!this.selectedIds?.length || !status?.id) return;

    this.sclCategoryService
      .updateStatus(this.selectedIds, status.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Cập nhật trạng thái thành công');
          this.isOpenUpdateStatus = false;
          this.loadData();
        },
        error: (err: any) => {
          this.dialog.error(
            'Lỗi cập nhật trạng thái: ' + (err?.error?.message || err?.message || 'Không thể cập nhật trạng thái'),
          );
        },
      });
  }

  onCancel() {
    this.isOpen = false;
  }

  onCancelReject(): void {
    this.isOpenReject = false;
    this.dataDialog = null;
  }

  onCancelUpdateStatus(): void {
    this.isOpenUpdateStatus = false;
  }

  onConfirmReject(event: RejectionAssessment): void {
    const ids = this.dataDialog?.action === 'reject' ? this.dataDialog.ids : [];
    this.isOpenReject = false;
    this.onRejectDialogConfirm(ids, event.reason);
  }

  handleAcceptEvent(): void {
    this.isOpen = false;
    if (this.dataDialog?.action === 'delete') this.onDeleteDialogConfirm(this.dataDialog.ids);
    if (this.dataDialog?.action === 'sendApprove') this.onSendApproveDialogConfirm(this.dataDialog.ids);
    if (this.dataDialog?.action === 'approval') this.onApproveDialogConfirm(this.dataDialog.ids);
  }

  onDeleteDialogCancel(): void {
    this.isOpen = false;
    this.deletingCategoryIds = [];
    this.dataDialog = null;
  }

  loadStatusOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'APPROVE_STATUS_SCL',
    };

    this.catalogService.searchCatalogItems(req).subscribe({
      next: (res) => {
        this.statusOptions = res.content || [];
        this.statusDisplayOptions = [
          this.ALL_OPTION,
          ...this.statusOptions.map((item) => ({ value: item.id, label: item.name })),
        ];
      }
    });
  }

  loadPcOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'CT_DIEN_LUC',
    };

    this.catalogService.searchCatalogItems(req).subscribe({
      next: (res) => {
        this.pcOptions = res.content.map((item) => item.id) || [];
      }
    });
  }

  loadProgressOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'SCL_TIENDO',
    };

    this.catalogService.searchCatalogItems(req).subscribe({
      next: (res) => {
        this.progressOptions = res.content.map((item) => item.name) || [];
        this.progressDisplayOptions = [
          { value: this.ALL_VALUE, label: 'Tất cả' },
          ...this.progressOptions.map((value) => ({ value, label: value })),
        ];
      }
    });
  }

  onDeleteDialogConfirm(ids: number[]): void {
    if (!ids?.length) return;
    this.deletingCategoryIds = ids;
    this.sclCategoryService
      .deleteCategories(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Xóa hạng mục thành công');
          this.onDeleteDialogCancel();
          this.loadData();
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi xóa: ' + (err?.error?.message || err?.message || 'Không thể xóa hạng mục'),
          );
        },
      });
  }

  onSendApproveDialogConfirm(ids: number[]): void {
    if (!ids?.length) return;

    this.sclCategoryService
      .sendApprove(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Gửi duyệt hạng mục thành công');
          this.onDeleteDialogCancel();
          this.loadData();
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi gửi duyệt: ' + (err?.error?.message || err?.message || 'Không thể gửi duyệt hạng mục'),
          );
        },
      });
  }

  onApproveDialogConfirm(ids: number[]): void {
    if (!ids?.length) return;

    this.sclCategoryService
      .approve(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Phê duyêt hạng mục thành công');
          this.onDeleteDialogCancel();
          this.loadData();
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi phê duyệt: ' + (err?.error?.message || err?.message || 'Không thể phê duyệt hạng mục'),
          );
        },
      });
  }

  onRejectDialogConfirm(ids: number[], rejectReason?: string): void {
    if (!ids?.length) return;

    this.sclCategoryService
      .reject(ids, rejectReason)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Từ chối hạng mục thành công');
          this.onDeleteDialogCancel();
          this.loadData();
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi từ chối: ' + (err?.error?.message || err?.message || 'Không thể từ chối hạng mục'),
          );
        },
      });
  }

  onRowDoubleClicked(event: RowDoubleClickedEvent<SclCategory>): void {
    this.onDetail(event.data);
  }

  onDetail(data?: SclCategory | null): void {
    if (!data) return;
    const numericId = data.id;
    if (typeof numericId !== 'number' || !Number.isFinite(numericId)) return;

    this.router.navigate(['/scl-category/scl-detail'], {
      queryParams: { type: 'category', id: numericId, mode: 'view' },
    });
  }

  submitAddEvent(payload: SclCategory) {
    this.sclCategoryService.createCategories(payload).subscribe({
      next: (res) => {
        const newId = res;

        if (!newId) {
          this.dialog.error('Không lấy được ID sau khi tạo');
          return;
        }

        this.dialog.success('Thêm hạng mục thành công');
        this.isOpenAdd = false;

        // Redirect sang detail edit
        this.router.navigate(['/scl-category/scl-detail'], {
          queryParams: { type: 'category', id: newId, mode: 'edit' },
        });
      },
      error: (err) => {
        this.dialog.error(
          'Lỗi thêm: ' + (err?.error?.message || err?.message || 'Không thể thêm hạng mục')
        );
      },
    });
  }

  private getExportFileName(contentDisposition: string | null): string {
    const fallback = 'danh-sach-hang-muc-scl.xlsx';

    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    return asciiMatch?.[1] || fallback;
  }

  private normalizeAllSelection(values: string[], allValue: string): string[] {
    if (!values.length) {
      return [];
    }

    const hasAll = values.includes(allValue);
    const lastValue = values[values.length - 1];

    return hasAll && lastValue === allValue ? [allValue] : values.filter((item) => item !== allValue);
  }

  private toOptionalArray(values: string[]): string[] | undefined {
    const filteredValues = values.filter(Boolean);
    return filteredValues.length ? filteredValues : undefined;
  }
}
