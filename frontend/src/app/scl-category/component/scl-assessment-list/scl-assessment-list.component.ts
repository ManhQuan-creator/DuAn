import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiSvgModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  RowDoubleClickedEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import { saveAs } from 'file-saver';
import {
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  Subject,
  takeUntil,
} from 'rxjs';
import { AuthService } from '../../../auth/auth.service';
import { FilterCatalogItemRequest } from '../../../catalog-manager/models/catalog.model';
import { CatalogService } from '../../../catalog-manager/service/catalog.service';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';
import { ExcelExportService } from '../../../excel-builder/service/excel-export.service';
import {
  AcceptDialogComponent,
  AcceptDialogData,
} from '../../../shared/components/accept-dialog/accept-dialog.component';
import {
  AgGridHeaderAction,
  AgGridHeaderComponent,
} from '../../../shared/components/ag-grid-header/ag-grid-header.component';
import { AgGridWrapperComponent } from '../../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../../../shared/components/custom-pagination/custom-pagination.component';
import { RenderActionComponent } from '../../../shared/components/grid-custom-cell/render-action/render-action.component';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../../../shared/components/page-header/page-header.component';
import { AppDialogService } from '../../../shared/dialog.service';
import { DATE_FORMAT_ENUM } from '../../../shared/enum/date-time.enum';
import { Option } from '../../../shared/models/common.model';
import { OrganizationService } from '../../../shared/organization.service';
import { formatDateUtils } from '../../../shared/utils/date-format.util';
import { RejectDialogComponent } from '../../dialogs/reject-dialog/reject-dialog.component';
import {
  RejectionAssessment,
  SclAssessment,
  SclAssessmentFilter,
} from '../../model/scl-assessment.model';
import { PcOrganizationUnitService } from '../../service/pc-organization-unit.service';
import { SclAssessmentService } from '../../service/scl-assessment.service';
import { StatusCellRenderComponent } from '../render-action/status-cell-render.component';
import { StatusAssessmentCellRenderComponent } from '../render/status-assessment-cell-render.component';
import {
  STATUS_ASSESSMENT_OPTIONS,
  STATUS_OPTIONS,
  StatusAssessmentEnum,
} from '../../enums/status-assessment.enum';

@Component({
  selector: 'app-scl-assessment-list',
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiSvgModule,
    TuiInputModule,
    TuiSelectModule,
    PageHeaderComponent,
    AgGridHeaderComponent,
    CustomPaginationComponent,
    AgGridWrapperComponent,
    AcceptDialogComponent,
  ],
  templateUrl: './scl-assessment-list.component.html',
  styleUrls: ['./scl-assessment-list.component.scss'],
})
export class SclAssessmentListComponent implements OnInit, OnDestroy {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly sclAssessmentService = inject(SclAssessmentService);
  readonly organizationService = inject(OrganizationService);
  readonly excelExportService = inject(ExcelExportService);
  readonly dialog = inject(AppDialogService);
  readonly catalogService = inject(CatalogService);
  readonly authService = inject(AuthService);
  readonly pcOrganizationService = inject(PcOrganizationUnitService);
  readonly destroy$ = new Subject<void>();
  private gridApi?: GridApi;
  public assetType: string | null = null;
  readonly yearOptions: string[] = Array.from(
    { length: new Date().getFullYear() - 1980 + 1 },
    (_, i) => String(1980 + i + 1),
  ).reverse();

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
      label: 'Quản lý thẩm định hạng mục SCL',
      link: '/scl-assessment',
    },
  ];
  public title = 'Danh sách thẩm định của hạng mục SCL';
  unitFilter: Option | null = null;
  assetTypeFilter: Option | null = null;
  planTypeFilter: Option | null = null;
  registerTypeFilter: Option | null = null;
  progressFilter: string | null = null;
  categoryCodeFilter = '';
  categoryNameFilter = '';
  yearFilter: string | null = String(new Date().getFullYear());
  statusFilter: Option | null = null;
  statusAssessmentFilter: Option | null = null;
  readonly searchSubject = new Subject<string>();
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  loading = false;
  templateList: SclAssessment[] = [];
  progressOptions: string[] = [];
  listUnitOptions: Option[] = [];
  listAssetTypeOptions: Option[] = [];
  listPlanTypeOptions: Option[] = [];
  readonly statusOptions: Option[] = STATUS_OPTIONS;
  readonly statusAssessmentOptions: Option[] = STATUS_ASSESSMENT_OPTIONS;
  readonly stringifyProgress = (progress: string): string => progress;
  readonly stringifyUnit = (unit: Option): string => unit.label;
  readonly stringifyRegisterType = (registerType: Option): string =>
    registerType.label;
  readonly stringifyAssetType = (assetType: Option): string => assetType.label;
  readonly stringifyPlanType = (planType: Option): string => planType.label;
  readonly stringifyYear = (yearPlan: string): string => yearPlan;
  readonly stringifyStatus = (item: CatalogItem): string => item?.name || '';
  readonly listRegisterTypeOptions: Option[] = [
    { value: 'tạm tính', label: 'Tạm tính' },
    { value: 'chính thức', label: 'Chính thức' },
    { value: 'bổ sung', label: 'Bổ sung' },
    { value: 'chuyển tiếp', label: 'Chuyển tiếp' },
  ];

  isOpen = false;
  isOpenReject = false;
  isOpenRevise = false;
  // disableConfirmAction = true;

  dialogData: AcceptDialogData = {
    title: '',
    message: '',
    status: 'info',
    confirmText: '',
    cancelText: '',
  };
  headerTitle: string = 'Quản lý thẩm định hạng mục SCL';
  public dataDialog: {
    action: 'confirm' | 'reject' | 'revise';
    ids: number[];
  } | null = null;
  selectedIds: number[] = [];
  gridHeaderActionsCached: AgGridHeaderAction[] = [];

  private readonly assessableStatuses = new Set(['DA_GUI_TD']);

  private updateGridHeaderActions(): void {
    this.gridHeaderActionsCached = [
      // {
      //   id: 'confirm',
      //   label: 'Xác nhận thẩm định',
      //   icon: 'tuiIconCheck',
      //   disabled: this.disableConfirmAction,
      // },
      {
        id: 'export',
        label: 'Xuất danh sách',
        icon: 'tuiIconDownload',
      },
    ];
  }

  get gridHeaderActions(): AgGridHeaderAction[] {
    return this.gridHeaderActionsCached;
  }

  onGridHeaderAction(actionId: string): void {
    const handlers: Record<string, () => void> = {
      // confirm: () => this.handleConfirmSelected(),
      export: () => this.handleExportSelected(),
    };

    handlers[actionId]?.();
  }

  // onSelectionChanged(selectedRows: SclAssessment[]): void {
  //   const rows = selectedRows ?? [];
  //   this.selectedIds = rows
  //     .map((r) => (r as { id?: unknown })?.id)
  //     .map((id) => (typeof id === 'string' ? Number(id) : id))
  //     .filter((id): id is number => Number.isFinite(id));

  //   const allAssessable =
  //     this.selectedIds.length > 0 &&
  //     rows.every(
  //       (r) =>
  //         this.assessableStatuses.has(r.status ?? '') &&
  //         r.statusAssessment !== StatusAssessmentEnum.DA_THAM_DINH,
  //     );

  //   this.disableConfirmAction = !allAssessable;
  //   this.updateGridHeaderActions();
  // }

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
      valueGetter: (params: ValueGetterParams<SclAssessment>) => {
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
      width: 220,
      sortable: true,
      cellRenderer: StatusAssessmentCellRenderComponent,
    },
    {
      headerName: 'Thời gian cập nhật',
      field: 'updatedAt',
      minWidth: 180,
      flex: 1.5,
      valueFormatter: (params) =>
        formatDateUtils(params.value, DATE_FORMAT_ENUM.DD_MM_YYYY_HH_MM_SS),
    },
    {
      headerName: 'Thao tác',
      width: 100,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        onDetail: (data: SclAssessment) => this.onDetail(data),
        // onConfirmAssessment: (data: SclAssessment) =>
        //   this.confirmAssessmentRow(data),
        // showConfirmAssessment: (data: SclAssessment) =>
        //   data.statusAssessment !== StatusAssessmentEnum.DA_THAM_DINH,
      },
    },
  ];

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const typeParam = params.get('type');
      this.assetType = typeParam && typeParam !== 'all' ? typeParam : null;
      this.loadFilterOptions();
      this.loadData();
    });
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadData());

    this.loadProgressOptions();
    this.updateGridHeaderActions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(): void {
    this.pageNum = 0;
    const signature = [
      this.unitFilter?.value ?? '',
      this.categoryCodeFilter.trim(),
      this.categoryNameFilter.trim(),
      this.yearFilter ?? '',
      this.progressFilter ?? '',
      this.statusFilter?.value ?? '',
      this.statusAssessmentFilter?.value ?? '',
      this.registerTypeFilter?.value ?? '',
      this.planTypeFilter?.value ?? '',
      this.assetTypeFilter?.value ?? '',
    ].join('|');
    this.searchSubject.next(signature);
  }

  onUnitChange(): void {
    this.onSearchInput();
  }

  private loadFilterOptions(): void {
    forkJoin({
      unitOptions: this.loadUnitFilterOptions(),
      listAssetType: this.catalogService.getCatalogs('SCL_PHANLOAI'),
      listPlanType: this.catalogService.getCatalogs('SCL_KEHOACH'),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ unitOptions, listAssetType, listPlanType }) => {
          this.listUnitOptions = unitOptions;
          this.syncUnitFilterWithOptions();
          this.listAssetTypeOptions = listAssetType
            .map((item) => ({ value: item.id, label: item.name }))
            .filter((option): option is Option => !!option.label);
          this.listPlanTypeOptions = listPlanType
            .map((item) => ({ value: item.id, label: item.name }))
            .filter((option): option is Option => !!option.label);
        },
      });
  }

  private loadUnitFilterOptions() {
    const pc = this.authService.currentUser?.companyCode?.trim();

    if (pc) {
      return this.pcOrganizationService
        .getPcOrganizationUnits(pc)
        .pipe(
          map((units) =>
            units
              .map((org) => ({ value: org.unit, label: org.unit }))
              .filter(
                (option): option is Option => !!option.value && !!option.label,
              ),
          ),
        );
    }

    return this.catalogService
      .getCatalogs('CT_DIEN_LUC')
      .pipe(
        map((units) =>
          units
            .map((item) => ({ value: item.id, label: item.name }))
            .filter((option): option is Option => !!option.label),
        ),
      );
  }

  private syncUnitFilterWithOptions(): void {
    if (
      this.unitFilter &&
      !this.listUnitOptions.some(
        (option) => option.value === this.unitFilter?.value,
      )
    ) {
      this.unitFilter = null;
      this.onSearchInput();
    }
  }

  loadData(): void {
    this.loading = true;
    const request = this.buildFilterRequest();

    this.sclAssessmentService
      .search(request)
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

  private buildFilterRequest(): SclAssessmentFilter {
    return {
      unit: this.unitFilter?.label || undefined,
      categoryCode: this.categoryCodeFilter.trim() || undefined,
      categoryName: this.categoryNameFilter.trim() || undefined,
      yearPlan: this.yearFilter || undefined,
      progress: this.progressFilter || undefined,
      status: this.statusFilter?.value || undefined,
      // statusAssessment: this.statusAssessmentFilter?.value || undefined,
      assetType: this.assetTypeFilter?.label || undefined,
      planType: this.planTypeFilter?.label || undefined,
      registerType: this.registerTypeFilter?.label || undefined,
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };
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

  // handleConfirmSelected(): void {
  //   if (this.disableConfirmAction || !this.selectedIds.length) return;

  //   this.dialogData = {
  //     title: 'Xác nhận thẩm định',
  //     message: 'Xác nhận đã thẩm định các hạng mục đã chọn?',
  //     status: 'info',
  //     confirmText: 'Xác nhận',
  //     cancelText: 'Hủy',
  //   };
  //   this.dataDialog = { action: 'confirm', ids: [...this.selectedIds] };
  //   this.isOpen = true;
  // }

  confirmAssessmentRow(data: SclAssessment): void {
    const numericId = data?.id;
    if (typeof numericId !== 'number' || !Number.isFinite(numericId)) return;
    // if (!this.assessableStatuses.has(data?.status ?? '')) return;

    this.selectedIds = [numericId];
    this.dialogData = {
      title: 'Xác nhận thẩm định',
      message: `Xác nhận đã thẩm định "${data.categoryCode ?? ''}"?`,
      status: 'info',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
    };
    this.dataDialog = { action: 'confirm', ids: [numericId] };
    this.isOpen = true;
  }

  handleExportSelected(): void {
    const request = this.buildFilterRequest();

    this.sclAssessmentService
      .exportAssessments(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (!response.body) {
            this.dialog.error('Không nhận được file export');
            return;
          }

          const fileName = this.getExportFileName(
            response.headers.get('content-disposition'),
          );
          saveAs(response.body, fileName);
          this.dialog.success('Xuất danh sách thẩm định thành công');
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi export: ' +
              (err?.error?.message ||
                err?.message ||
                'Không thể export danh sách thẩm định'),
          );
        },
      });
  }

  handleAcceptEvent(): void {
    this.isOpen = false;
    if (this.dataDialog?.action === 'confirm') {
      this.onConfirmDialogConfirm(this.dataDialog.ids);
    }
  }

  onCancel(): void {
    this.isOpen = false;
    this.dataDialog = null;
  }

  private onConfirmDialogConfirm(ids: number[]): void {
    if (!ids?.length) return;

    this.sclAssessmentService
      .confirm({ ids })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.success('Xác nhận thẩm định thành công');
          this.dataDialog = null;
          this.loadData();
        },
        error: (err: any) => {
          this.dialog.error(
            'Lỗi xác nhận: ' +
              (err?.error?.message ||
                err?.message ||
                'Không thể xác nhận thẩm định'),
          );
        },
      });
  }

  loadProgressOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 50,
      type: 'SCL_TIENDO',
    };

    this.catalogService
      .searchCatalogItems(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.progressOptions = (res.content || []).map((item) => item.name);
        },
      });
  }

  onRowDoubleClicked(event: RowDoubleClickedEvent<SclAssessment>): void {
    this.onDetail(event.data);
  }

  onDetail(data?: SclAssessment | null): void {
    if (!data) return;
    const numericId = data.id;
    if (typeof numericId !== 'number' || !Number.isFinite(numericId)) return;

    this.router.navigate(['/scl-category/scl-detail'], {
      queryParams: { type: 'assessment', id: numericId, mode: 'view' },
    });
  }

  private getExportFileName(contentDisposition: string | null): string {
    const fallback = 'danh-sach-tham-dinh-scl.xlsx';

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
}
