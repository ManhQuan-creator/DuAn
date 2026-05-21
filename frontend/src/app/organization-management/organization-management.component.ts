import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { ColDef, GridApi, GridReadyEvent, ValueGetterParams } from 'ag-grid-community';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import {
  RenderActionComponent,
} from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { AppDialogService } from '../shared/dialog.service';
import { Organization, ORG_LEVEL_LABELS, OrganizationService } from '../shared/organization.service';
import { StatusCellRenderComponent } from '../shared/components/grid-custom-cell/status-cell-render/status-cell-render.component';
import { OrgLevelCellRenderComponent } from '../shared/components/grid-custom-cell/org-level-cell-render/org-level-cell-render.component';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../shared/components/page-header/page-header.component';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';

@Component({
  selector: 'app-organization-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiDataListModule,
    TuiTextfieldControllerModule,
    TuiInputModule,
    TuiSelectModule,
    PageHeaderComponent,
    AgGridWrapperComponent,
    CustomPaginationComponent,
    GridHeaderComponent
  ],
  templateUrl: './organization-management.component.html',
  styleUrls: ['./organization-management.component.scss'],
})
export class OrganizationManagementComponent implements OnInit, OnDestroy {
  private readonly orgService = inject(OrganizationService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<string>();
  private gridApi!: GridApi;

  private readonly orgLevelOptions = Object.entries(ORG_LEVEL_LABELS).map(
    ([value, label]) => ({ value, label })
  );

  headerTitle = 'Quản lý đơn vị';
  subTitle = 'Danh sách các đơn vị trong hệ thống';
  breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Hệ thống', link: '' },
    { label: 'Quản lý đơn vị', link: '' },
  ];

  organizations: Organization[] = [];
  searchKeyword = '';
  activeFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  readonly activeOptions: Array<'ALL' | 'ACTIVE' | 'INACTIVE'> = ['ALL', 'ACTIVE', 'INACTIVE'];
  readonly stringifyActive = (s: string): string => {
    switch (s) {
      case 'ALL': return 'Tất cả';
      case 'ACTIVE': return 'Hoạt động';
      case 'INACTIVE': return 'Vô hiệu';
      default: return s;
    }
  };

  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  loading = false;

  defaultColDef: ColDef = { sortable: true, resizable: true, filter: false };

  columnDefs: ColDef[] = [
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
        return this.pageNum * this.pageSize + idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    { headerName: 'ID', field: 'id', width: 70 },
    { headerName: 'Mã đơn vị', field: 'orgCode', width: 130 },
    { headerName: 'Tên đơn vị', field: 'orgName', flex: 1 },
    { headerName: 'Đơn vị cha', field: 'parentOrgCode', width: 130 },
    { headerName: 'Cấp đơn vị', field: 'orgLevel', width: 140, cellRenderer: OrgLevelCellRenderComponent },
    { headerName: 'Trạng thái', field: 'active', width: 120, resizable: false, cellRenderer: StatusCellRenderComponent },
    {
      headerName: 'Thao tác',
      width: 100,
      pinned: 'right',
      resizable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        showRender: false,
        showPublish: false,
        onEdit: (data: any) => {
          const org = this.organizations.find((o) => o.id === data?.id);
          if (org) this.openEditDialog(org);
        },
        onDelete: (data: any) => {
          const org = this.organizations.find((o) => o.id === data?.id);
          if (org) this.onDelete(org);
        },
      },
      sortable: false,
      filter: false,
    },
  ];

  ngOnInit() {
    this.loadData();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.pageNum = 0;
        this.loadData();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  onSearchInput() {
    this.searchSubject.next(this.searchKeyword);
  }

  onActiveChange() {
    this.pageNum = 0;
    this.loadData();
  }

  loadData() {
    this.loading = true;
    const active = this.activeFilter === 'ACTIVE' ? true : this.activeFilter === 'INACTIVE' ? false : null;
    this.orgService.search(this.searchKeyword, active, this.pageNum, this.pageSize)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.organizations = page.content;
          this.pageNum = page.number;
          this.pageSize = page.size;
          this.totalRows = page.totalElements;
          this.loading = false;
        },
        error: () => {
          this.dialog.error('Không thể tải danh sách đơn vị');
          this.loading = false;
        },
      });
  }

  onPageChanged(event: { page: number; pageSize: number }) {
    this.pageNum = event.page - 1;
    this.loadData();
  }

  onPageSizeChanged(event: { page: number; pageSize: number }) {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadData();
  }

  openCreateDialog() {
    this.dialog.prompt({
      title: 'Thêm đơn vị mới',
      icon: '+',
      status: 'info',
      fields: [
        { key: 'orgCode', label: 'Mã đơn vị', required: true },
        { key: 'orgName', label: 'Tên đơn vị', required: true },
        { key: 'parentOrgCode', label: 'Mã đơn vị cha' },
        { key: 'orgLevel', label: 'Cấp đơn vị', required: true, type: 'select' as const, options: this.orgLevelOptions }
      ],
      initialValues: {
        orgCode: '',
        orgName: '',
        parentOrgCode: '',
        orgLevel: 'SUBSIDIARY'
      },
      confirmText: 'Tạo'
    }).subscribe(result => {
      if (!result) return;
      this.orgService.create({
        orgCode: result['orgCode'],
        orgName: result['orgName'],
        parentOrgCode: result['parentOrgCode'] || undefined,
        orgLevel: result['orgLevel']
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success('Đã tạo đơn vị thành công');
          this.loadData();
        },
        error: (err) => this.dialog.error(err.error?.message || 'Lỗi tạo đơn vị')
      });
    });
  }

  openEditDialog(org: Organization) {
    this.dialog.prompt({
      title: `Chỉnh sửa đơn vị — ${org.orgCode}`,
      icon: `+`,
      status: 'info',
      fields: [
        { key: 'orgName', label: 'Tên đơn vị' },
        { key: 'parentOrgCode', label: 'Mã đơn vị cha' },
        { key: 'orgLevel', label: 'Cấp đơn vị', type: 'select' as const, options: this.orgLevelOptions }
      ],
      initialValues: {
        orgName: org.orgName || '',
        parentOrgCode: org.parentOrgCode || '',
        orgLevel: org.orgLevel || 'SUBSIDIARY'
      },
      confirmText: 'Cập nhật'
    }).subscribe(result => {
      if (!result) return;
      this.orgService.update(org.id, {
        orgName: result['orgName'] || undefined,
        parentOrgCode: result['parentOrgCode'] || undefined,
        orgLevel: result['orgLevel'] || undefined
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success('Đã cập nhật đơn vị');
          this.loadData();
        },
        error: (err) => this.dialog.error(err.error?.message || 'Lỗi cập nhật đơn vị')
      });
    });
  }

  onDelete(org: Organization) {
    this.dialog.confirm({
      title: 'Xác nhận vô hiệu hóa',
      message: `Bạn có chắc muốn vô hiệu hóa đơn vị "${org.orgName}" (${org.orgCode})?`,
      status: 'warning',
      confirmText: 'Vô hiệu hóa',
      cancelText: 'Hủy'
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.orgService.deleteOrg(org.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.dialog.success('Đã vô hiệu hóa đơn vị');
            this.loadData();
          },
          error: () => this.dialog.error('Lỗi khi vô hiệu hóa đơn vị')
        });
    });
  }
}
