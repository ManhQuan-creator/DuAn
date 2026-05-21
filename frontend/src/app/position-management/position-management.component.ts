import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { ColDef, GridApi, GridReadyEvent, ValueGetterParams } from 'ag-grid-community';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';
import { RenderActionComponent } from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { StatusCellRenderComponent } from '../shared/components/grid-custom-cell/status-cell-render/status-cell-render.component';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import { AppDialogService } from '../shared/dialog.service';
import { PositionItem, PositionService } from './position.service';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';

export const ORG_LEVEL_SCOPE_OPTIONS = [
  { value: 'EVNNPC',     label: 'Tổng công ty EVNNPC' },
  { value: 'HQ_DEPT',    label: 'Ban thuộc EVNNPC' },
  { value: 'PC_COMPANY', label: 'Công ty điện lực' },
  { value: 'PC_DEPT',    label: 'Phòng thuộc điện lực' },
  { value: 'ALL',        label: 'Tất cả cấp' },
];

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-position-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiInputModule,
    TuiSelectModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    AgGridWrapperComponent,
    CustomPaginationComponent,
    PageHeaderComponent,
    GridHeaderComponent
  ],
  templateUrl: './position-management.component.html',
  styleUrls: ['./position-management.component.scss'],
})
export class PositionManagementComponent implements OnInit, OnDestroy {
  private readonly positionService = inject(PositionService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<void>();

  /** Toàn bộ data từ API */
  private allPositions: PositionItem[] = [];
  /** Data sau khi filter, dùng để tính pagination */
  private filteredPositions: PositionItem[] = [];
  /** Data slice theo trang hiện tại — bind vào grid */
  positions: PositionItem[] = [];

  searchText = '';
  statusFilter: StatusFilter = 'ALL';
  readonly statusOptions: StatusFilter[] = ['ALL', 'ACTIVE', 'INACTIVE'];

  pageNum = 0;
  pageSize = 20;
  totalRows = 0;

  private gridApi!: GridApi;

  readonly breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Hệ thống', link: '' },
    { label: 'Quản lý chức danh', link: '' },
  ];

  readonly stringifyStatus = (s: StatusFilter): string => {
    switch (s) {
      case 'ALL':      return 'Tất cả';
      case 'ACTIVE':   return 'Hoạt động';
      case 'INACTIVE': return 'Vô hiệu';
      default: return s;
    }
  };

  defaultColDef: ColDef = { sortable: true, resizable: true, filter: true };

  columnDefs: ColDef[] = [
    {
      colId: 'select', headerName: '', width: 48, pinned: 'left',
      sortable: false, filter: false, resizable: false, suppressMovable: true,
      checkboxSelection: true, headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true, lockPosition: 'left',
    },
    {
      headerName: 'STT', colId: 'stt', width: 64, pinned: 'left',
      sortable: false, filter: false, resizable: false, suppressMovable: true,
      lockPosition: 'left', cellStyle: { textAlign: 'center' },
      valueGetter: (p: ValueGetterParams) =>
        this.pageNum * this.pageSize + (p.node?.rowIndex ?? 0) + 1,
    },
    { headerName: 'ID', field: 'id', width: 70 },
    { headerName: 'Mã chức danh', field: 'positionCode', width: 160 },
    { headerName: 'Tên chức danh', field: 'positionName', flex: 1, minWidth: 180 },
    { headerName: 'Thứ bậc', field: 'positionRank', width: 100, cellStyle: { textAlign: 'center' } },
    {
      headerName: 'Phạm vi áp dụng', field: 'orgLevelScope', width: 180,
      valueFormatter: p => ORG_LEVEL_SCOPE_OPTIONS.find(o => o.value === p.value)?.label ?? p.value,
    },
    {
      headerName: 'Trạng thái', field: 'active', width: 130, resizable: false,
      cellRenderer: StatusCellRenderComponent,
    },
    {
      headerName: 'Thao tác', width: 100, pinned: 'right',
      resizable: false, suppressMovable: true, lockPosition: 'right',
      sortable: false, filter: false,
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        showRender: false, showPublish: false,
        onEdit: (data: any) => {
          const pos = this.allPositions.find(p => p.id === data?.id);
          if (pos) this.openEditDialog(pos);
        },
        onDelete: (data: any) => {
          const pos = this.allPositions.find(p => p.id === data?.id);
          if (pos) this.onDelete(pos);
        },
      },
    },
  ];

  ngOnInit() {
    this.loadPositions();
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.pageNum = 0;
      this.applyFilter();
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  onSearchChange() { this.searchSubject.next(); }

  onStatusChange() {
    this.pageNum = 0;
    this.applyFilter();
  }

  loadPositions() {
    this.positionService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: data => {
        this.allPositions = data;
        this.applyFilter();
      },
      error: () => this.dialog.error('Không thể tải danh sách chức danh'),
    });
  }

  private applyFilter() {
    const keyword = this.searchText.trim().toLowerCase();
    this.filteredPositions = this.allPositions.filter(p => {
      const matchText = !keyword
        || p.positionCode.toLowerCase().includes(keyword)
        || p.positionName.toLowerCase().includes(keyword);
      const matchStatus =
        this.statusFilter === 'ALL'
        || (this.statusFilter === 'ACTIVE'   &&  p.active)
        || (this.statusFilter === 'INACTIVE' && !p.active);
      return matchText && matchStatus;
    });
    this.totalRows = this.filteredPositions.length;
    this.applyPage();
  }

  private applyPage() {
    const start = this.pageNum * this.pageSize;
    this.positions = this.filteredPositions.slice(start, start + this.pageSize);
    this.gridApi?.refreshCells({ force: true });
  }

  onPageChanged(event: { page: number }) {
    this.pageNum = event.page - 1;
    this.applyPage();
  }

  onPageSizeChanged(event: { pageSize: number }) {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.applyPage();
  }

  openCreateDialog() {
    const scopeHint = ORG_LEVEL_SCOPE_OPTIONS.map(o => `${o.value}=${o.label}`).join(', ');
    this.dialog.prompt({
      title: 'Thêm chức danh mới',
      icon: '+', status: 'info',
      fields: [
        { key: 'positionCode', label: 'Mã chức danh (VD: TGD, GD, TRUONG_PHONG)', required: true },
        { key: 'positionName', label: 'Tên chức danh', required: true },
        { key: 'positionRank', label: 'Thứ bậc (1=cao nhất, 9=thấp nhất)', required: true },
        { key: 'orgLevelScope', label: `Phạm vi (${scopeHint})`, required: true },
      ],
      confirmText: 'Tạo',
    }).subscribe(result => {
      if (!result) return;
      this.positionService.create({
        positionCode: result['positionCode'],
        positionName: result['positionName'],
        positionRank: Number(result['positionRank']),
        orgLevelScope: result['orgLevelScope'],
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.dialog.success('Đã tạo chức danh thành công'); this.loadPositions(); },
        error: err => this.dialog.error(err.error?.message || 'Lỗi tạo chức danh'),
      });
    });
  }

  openEditDialog(pos: PositionItem) {
    this.dialog.prompt({
      title: `Chỉnh sửa — ${pos.positionCode}`,
      icon: '+', status: 'info',
      fields: [
        { key: 'positionName', label: 'Tên chức danh' },
        { key: 'positionRank', label: 'Thứ bậc' },
        { key: 'orgLevelScope', label: 'Phạm vi áp dụng' },
      ],
      initialValues: {
        positionName: pos.positionName,
        positionRank: String(pos.positionRank),
        orgLevelScope: pos.orgLevelScope,
      },
      confirmText: 'Cập nhật',
    }).subscribe(result => {
      if (!result) return;
      this.positionService.update(pos.id, {
        positionName: result['positionName'] || undefined,
        positionRank: result['positionRank'] ? Number(result['positionRank']) : undefined,
        orgLevelScope: result['orgLevelScope'] || undefined,
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.dialog.success('Đã cập nhật chức danh'); this.loadPositions(); },
        error: err => this.dialog.error(err.error?.message || 'Lỗi cập nhật'),
      });
    });
  }

  onDelete(pos: PositionItem) {
    this.dialog.confirm({
      title: 'Xác nhận vô hiệu hóa',
      message: `Vô hiệu hóa chức danh "${pos.positionName}" (${pos.positionCode})?`,
      status: 'warning', confirmText: 'Vô hiệu hóa', cancelText: 'Hủy',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.positionService.delete(pos.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.dialog.success('Đã vô hiệu hóa'); this.loadPositions(); },
        error: () => this.dialog.error('Lỗi khi vô hiệu hóa chức danh'),
      });
    });
  }
}
