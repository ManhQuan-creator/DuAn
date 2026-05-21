import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiInputPasswordModule, TuiMultiSelectModule, TuiSelectModule } from '@taiga-ui/kit';
import { ColDef, GridApi, GridReadyEvent, ValueGetterParams } from 'ag-grid-community';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import {
  RenderActionComponent,
} from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { AppDialogService } from '../shared/dialog.service';
import { UserItem, UserService } from './service/user.service';
import { StatusCellRenderComponent } from '../shared/components/grid-custom-cell/status-cell-render/status-cell-render.component';
import { RoleCellRenderComponent } from '../shared/components/grid-custom-cell/role-cell-render/role-cell-render.component';
import { CustomPaginationComponent } from "../shared/components/custom-pagination/custom-pagination.component";
import { CreateUserRequest, FilterAppUserRequest, UpdateUserRequest } from './models/app-user.model';
import { PageHeaderBreadcrumb, PageHeaderComponent } from "../shared/components/page-header/page-header.component";
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import { UserFormDialogComponent, UserFormResult } from './user-form-dialog/user-form-dialog.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiInputModule,
    TuiTextfieldControllerModule,
    TuiSelectModule,
    TuiMultiSelectModule,
    TuiInputPasswordModule,
    TuiDataListModule,
    AgGridWrapperComponent,
    CustomPaginationComponent,
    PageHeaderComponent,
    GridHeaderComponent,
    UserFormDialogComponent,
],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(AppDialogService);
  private readonly destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  users: UserItem[] = [];
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  searchText = '';
  private gridApi!: GridApi;

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

  public breadcrumbs: PageHeaderBreadcrumb[] = [
    {
      label: 'Trang chủ',
      link: '',
    },
    {
      label: 'Quản lý người dùng',
      link: '',
    },
    {
      label: 'Danh sách người dùng',
      link: '',
    },
  ];

  availableRoles = ['ADMIN', 'EDITOR', 'VIEWER'];

  // ===== Dialog form state =====
  formDialogOpen = false;
  formMode: 'create' | 'edit' = 'create';
  formEditingUser: UserItem | null = null;

  defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true
  };

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
        const api = params.api;
        if (api.getGridOption('pagination') === true) {
          return (
            api.paginationGetCurrentPage() * api.paginationGetPageSize() +
            idx +
            1
          );
        }
        return idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    { headerName: 'ID', field: 'id', width: 70 },
    { headerName: 'Tên đăng nhập', field: 'username', width: 150 },
    { headerName: 'Họ tên', field: 'fullName', width: 180 },
    { headerName: 'Email', field: 'email', width: 200 },
    { headerName: 'SĐT', field: 'phone', width: 120 },
    { headerName: 'Nhóm đơn vị', field: 'orgGroupCode', width: 130 },
    { headerName: 'Công ty', field: 'companyName', width: 180 },
    { headerName: 'Ban / Phòng', field: 'deptName', width: 180 },
    { headerName: 'Chức danh', field: 'positionName', width: 160 },
    { headerName: 'Vai trò', field: 'roles', width: 180, cellRenderer: RoleCellRenderComponent },
    { headerName: 'Trạng thái', field: 'active', width: 120, cellRenderer: StatusCellRenderComponent },
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
          const user = this.users.find((u) => u.id === data?.id);
          if (user) this.openEditDialog(user);
        },
        onDelete: (data: any) => {
          const user = this.users.find((u) => u.id === data?.id);
          if (user) this.onDelete(user);
        },
      },
      sortable: false,
      filter: false,
    },
  ];

  ngOnInit() {
    this.loadUsers();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadUsers());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  onSearch() {
    this.searchSubject.next(this.searchText);
  }

  onActiveChange() {
    this.pageNum = 0;
    this.loadUsers();
  }

  loadUsers() {
    const active = this.activeFilter === 'ACTIVE' ? true : this.activeFilter === 'INACTIVE' ? false : undefined;

    const request: FilterAppUserRequest = {
      keyword: this.searchText || undefined,
      active: active,
      pageNum: this.pageNum,
      pageSize: this.pageSize
    };

    this.userService.searchUsers(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.users = res.content;
          this.totalRows = res.totalElements;
          this.pageNum = res.number;
          this.pageSize = res.size;
        },
        error: () => this.dialog.error('Không thể tải danh sách người dùng')
      });
  }

  onPageChanged(event: any): void {
    this.pageNum = event.page - 1;
    this.loadUsers();
  }

  onPageSizeChanged(event: any): void {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadUsers();
  }

  openCreateDialog() {
    this.formMode = 'create';
    this.formEditingUser = null;
    this.formDialogOpen = true;
  }

  openEditDialog(user: UserItem) {
    this.formMode = 'edit';
    this.formEditingUser = user;
    this.formDialogOpen = true;
  }

  onFormSaved(result: UserFormResult): void {
    if (result.mode === 'create') {
      this.userService
        .createUser(result.payload as CreateUserRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.dialog.success('Đã tạo người dùng thành công');
            this.formDialogOpen = false;
            this.loadUsers();
          },
          error: (err) => this.dialog.error(err.error?.message || 'Lỗi tạo người dùng'),
        });
    } else {
      if (!this.formEditingUser) return;
      this.userService
        .updateUser(this.formEditingUser.id, result.payload as UpdateUserRequest)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.dialog.success('Đã cập nhật người dùng');
            this.formDialogOpen = false;
            this.loadUsers();
          },
          error: (err) => this.dialog.error(err.error?.message || 'Lỗi cập nhật'),
        });
    }
  }

  onDelete(user: UserItem) {
    this.dialog.confirm({
      title: 'Xác nhận vô hiệu hóa',
      message: `Bạn có chắc muốn vô hiệu hóa tài khoản "${user.username}"?`,
      status: 'warning',
      confirmText: 'Vô hiệu hóa',
      cancelText: 'Hủy'
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.userService.deleteUser(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.dialog.success('Đã vô hiệu hóa tài khoản');
            this.loadUsers();
          },
          error: () => this.dialog.error('Lỗi khi vô hiệu hóa tài khoản')
        });
    });
  }
}
