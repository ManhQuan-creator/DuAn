import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TuiButtonModule, TuiDataListModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { ColDef, GridApi,ICellRendererComp,GridReadyEvent, ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { GridTemplateService } from '../excel-builder/service/grid-template.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import { RenderActionComponent } from '../shared/components/grid-custom-cell/render-action/render-action.component';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../shared/components/page-header/page-header.component';
import { AppDialogService } from '../shared/dialog.service';
import { ImportFileDialogComponent } from '../shared/components/import-file-dialog/import-file-dialog.component';
import { CustomPaginationComponent } from "../shared/components/custom-pagination/custom-pagination.component";
import { FilterGridTemplateRequest, GridTemplateListItem } from '../excel-builder/models/grid-template.model';
import {
  AdvancedSettingsDialogComponent,
  AdvancedSettingsDialogData,
} from '../excel-builder/dialogs/advanced-settings-dialog/advanced-settings-dialog.component';
import {
  WorkflowDefinitionListItem,
  WorkflowDefinitionService,
} from '../workflow-manager/workflow-definition.service';
import { CatalogService } from '../catalog-manager/service/catalog.service';
import { CatalogItem } from '../excel-builder/models/catalog.data';
import { SidebarMenuOption, SidebarMenuService } from '../shared/sidebar-menu.service';

class ActionCellRenderer implements ICellRendererComp {
  private eGui!: HTMLElement;
  private params!: any;

  init(params: any): void {
    this.params = params;
    this.eGui = document.createElement('div');
    this.eGui.style.cssText = 'display:flex;align-items:center;gap:6px;height:100%;';
    this.render();
  }

  private render(): void {
    this.eGui.innerHTML = '';
    const params = this.params;
    const isLoading = params.isActionLoading?.(params.data.id);
    const disabledStyle = 'padding:2px 10px;font-size:12px;border:1px solid #d1d5db;background:#f9fafb;color:#9ca3af;border-radius:4px;cursor:not-allowed;';

    const renderBtn = document.createElement('button');
    renderBtn.textContent = 'Nh\u1EADp li\u1EC7u';
    renderBtn.style.cssText = isLoading ? disabledStyle : 'padding:2px 10px;font-size:12px;border:1px solid #8b5cf6;background:#f5f3ff;color:#7c3aed;border-radius:4px;cursor:pointer;';
    if (!isLoading) renderBtn.addEventListener('click', () => params.onRender(params.data.id));
    (renderBtn as HTMLButtonElement).disabled = isLoading;
    this.eGui.appendChild(renderBtn);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'S\u1EEDa';
    editBtn.style.cssText = isLoading ? disabledStyle : 'padding:2px 10px;font-size:12px;border:1px solid #3b82f6;background:#eff6ff;color:#3b82f6;border-radius:4px;cursor:pointer;';
    if (!isLoading) editBtn.addEventListener('click', () => params.onEdit(params.data.id));
    (editBtn as HTMLButtonElement).disabled = isLoading;
    this.eGui.appendChild(editBtn);

    if (params.data.status !== 'PUBLISHED') {
      const pubBtn = document.createElement('button');
      pubBtn.textContent = isLoading ? '\u0110ang x\u1EED l\u00FD...' : 'Xu\u1EA5t b\u1EA3n';
      pubBtn.style.cssText = isLoading ? disabledStyle : 'padding:2px 10px;font-size:12px;border:1px solid #16a34a;background:#f0fdf4;color:#16a34a;border-radius:4px;cursor:pointer;';
      if (!isLoading) pubBtn.addEventListener('click', () => params.onPublish(params.data.id));
      (pubBtn as HTMLButtonElement).disabled = isLoading;
      this.eGui.appendChild(pubBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.textContent = isLoading ? '\u0110ang x\u1EED l\u00FD...' : 'X\u00F3a';
    delBtn.style.cssText = isLoading ? disabledStyle : 'padding:2px 10px;font-size:12px;border:1px solid #dc2626;background:#fef2f2;color:#dc2626;border-radius:4px;cursor:pointer;';
    if (!isLoading) delBtn.addEventListener('click', () => params.onDelete(params.data.id, params.data.name));
    (delBtn as HTMLButtonElement).disabled = isLoading;
    this.eGui.appendChild(delBtn);
  }

  getGui(): HTMLElement { return this.eGui; }
  refresh(params: any): boolean {
    this.params = params;
    this.render();
    return true;
  }
  destroy(): void {}
}

@Component({
  selector: 'app-grid-template-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiInputModule,
    TuiSelectModule,
    PageHeaderComponent,
    AgGridWrapperComponent,
    CustomPaginationComponent,
    ImportFileDialogComponent,
    GridHeaderComponent,
    AdvancedSettingsDialogComponent,
  ],
  templateUrl: './grid-template-manager.component.html',
  styleUrls: ['./grid-template-manager.component.scss'],
})
export class GridTemplateManagerComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private gridTemplateService = inject(GridTemplateService);
  private workflowService = inject(WorkflowDefinitionService);
  private catalogService = inject(CatalogService);
  private sidebarMenuService = inject(SidebarMenuService);
  private dialog = inject(AppDialogService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  private gridApi!: GridApi;

  /** Default page size — đồng bộ giữa init field, omit-from-URL check và reset filter. */
  private readonly DEFAULT_PAGE_SIZE = 20;

  headerTitle: string = 'Quản lý biểu mẫu';
  subTitle: string = 'Danh sách các biểu mẫu lưới dữ liệu trong hệ thống';
  public btnLabelCreateNew: string = 'Tạo mới';
  public breadcrumbs: PageHeaderBreadcrumb[] = [
    {
      label: 'Trang chủ',
      link: '',
    },
    {
      label: 'Quản lý biểu mẫu',
      link: '',
    },
    {
      label: 'Danh sách biểu mẫu',
      link: '',
    },
  ];
  public title = 'Danh sách biểu mẫu';

  searchKeyword = '';
  statusFilter = 'ALL';
  readonly statusOptions = ['ALL', 'DRAFT', 'PUBLISHED'];
  templateList: GridTemplateListItem[] = [];
  pageNum = 0;
  pageSize = this.DEFAULT_PAGE_SIZE;
  totalRows = 0;
  loading = false;
  actionLoadingIds = new Set<number>();

  isCreateDialogOpen = false;
  creatingTemplate = false;
  createDialogData: AdvancedSettingsDialogData = {
    code: '',
    name: '',
    processDefinitionKey: null,
    reportDepartments: [],
    reportFcGroups: [],
  };
  deployedWorkflows: WorkflowDefinitionListItem[] = [];
  reportDepartmentOptions: CatalogItem[] = [];
  sidebarMenuOptions: SidebarMenuOption[] = [];

  readonly stringifyStatus = (s: string): string => {
    switch (s) {
      case 'ALL':
        return 'Tất cả';
      case 'DRAFT':
        return 'Nháp';
      case 'PUBLISHED':
        return 'Đã xuất bản';
      default:
        return s;
    }
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
    {
      headerName: 'Mã',
      field: 'code',
      flex: 0.8,
      minWidth: 100,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Tên biểu mẫu',
      field: 'name',
      flex: 2,
      minWidth: 200,
      sortable: true,
      filter: true,
      cellRenderer: (params: ICellRendererParams) => {
        const link = document.createElement('a');
        link.textContent = params.value || '';
        link.style.cssText =
          'color:#2563eb;cursor:pointer;text-decoration:none;font-weight:500;';
        link.addEventListener('mouseenter', () => {
          link.style.textDecoration = 'underline';
        });
        link.addEventListener('mouseleave', () => {
          link.style.textDecoration = 'none';
        });
        link.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openRender(params.data.id);
        });
        return link;
      },
    },
    {
      headerName: 'Trạng thái',
      field: 'status',
      flex: 0.8,
      minWidth: 100,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        const v = params.value;
        if (v === 'PUBLISHED')
          return '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:10px;font-size:12px;">Đã xuất bản</span>';
        return '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:10px;font-size:12px;">Nháp</span>';
      },
    },
    {
      headerName: 'Phiên bản',
      field: 'version',
      flex: 0.6,
      minWidth: 80,
      sortable: true
    },
    {
      headerName: 'Ngày tạo',
      field: 'createdAt',
      flex: 1,
      minWidth: 140,
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
      headerName: 'Cập nhật',
      field: 'updatedAt',
      flex: 1,
      minWidth: 140,
      sortable: true,
      resizable: false,
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
      width: 240,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        onRender: (data: GridTemplateListItem) => this.openRender(data.id),
        onEdit: (data: GridTemplateListItem) => this.editTemplate(data.id),
        onCopy: (data: GridTemplateListItem) => this.copyTemplate(data.id, data.name),
        onDelete: (data: GridTemplateListItem) => this.deleteTemplate(data.id, data.name),
        onPublish: (data: GridTemplateListItem) => this.publishTemplate(data.id),
        showDelete: (row: GridTemplateListItem) => row?.status !== 'PUBLISHED',
        isActionLoading: (id: number) => this.actionLoadingIds.has(id),
      },
    },
  ];

  ngOnInit(): void {
    this.loadCreateDialogOptions();

    // URL queryParams là single source of truth. Mỗi lần URL đổi (user input,
    // browser back/forward, deep link) → đồng bộ lại state + load lại danh sách.
    // BehaviorSubject của ActivatedRoute fire 1 lần đồng bộ trên subscribe đầu
    // → cover initial load, không cần gọi `loadData()` thủ công.
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => this.applyQueryParams(params));

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.pushFiltersToUrl({ resetPage: true }));
  }

  /** Đọc URL params → set state field + load lại data. */
  private applyQueryParams(params: Params): void {
    this.searchKeyword = (params['keyword'] as string) ?? '';
    this.statusFilter = (params['status'] as string) ?? 'ALL';
    this.pageNum = this.toNumber(params['page'], 0);
    this.pageSize = this.toNumber(params['size'], this.DEFAULT_PAGE_SIZE);
    this.loadData();
  }

  /**
   * Đẩy state hiện tại lên URL. Giá trị mặc định (rỗng / 'ALL' / 0 / DEFAULT_PAGE_SIZE)
   * được truyền `null` để Angular strip khỏi URL — giữ URL gọn ở trạng thái default.
   */
  private pushFiltersToUrl(opts: { resetPage?: boolean } = {}): void {
    const page = opts.resetPage ? 0 : this.pageNum;
    const queryParams: Params = {
      keyword: this.searchKeyword.trim() || null,
      status: this.statusFilter !== 'ALL' ? this.statusFilter : null,
      page: page > 0 ? page : null,
      size: this.pageSize !== this.DEFAULT_PAGE_SIZE ? this.pageSize : null,
    };
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private toNumber(raw: unknown, fallback: number): number {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  private loadCreateDialogOptions(): void {
    this.workflowService
      .getDeployed()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => (this.deployedWorkflows = data),
        error: () => (this.deployedWorkflows = []),
      });

    this.catalogService
      .getCatalogs('REPORT_DEPARTMENT')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => (this.reportDepartmentOptions = items),
        error: () => (this.reportDepartmentOptions = []),
      });

    this.sidebarMenuService
      .getMenuOptionsForFcGroup()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (options) => (this.sidebarMenuOptions = options),
        error: () => (this.sidebarMenuOptions = []),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchKeyword);
  }

  onStatusChange(): void {
    this.pushFiltersToUrl({ resetPage: true });
  }

  loadData(): void {
    this.loading = true;
    const request: FilterGridTemplateRequest = {
      keyword: this.searchKeyword.trim() || undefined,
      status: this.statusFilter !== 'ALL' ? this.statusFilter : undefined,
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };

    this.gridTemplateService
      .searchTemplates(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.templateList = res.content;
          this.pageNum = res.number;
          this.pageSize = res.size;
          this.totalRows = res.totalElements;
          this.loading = false;
        },
        error: () => (this.loading = false),
      });
  }
  
  onPageChanged(event: any): void {
    this.pageNum = event.page - 1;
    this.pushFiltersToUrl();
  }

  onPageSizeChanged(event: any): void {
    this.pageSize = event.pageSize;
    this.pushFiltersToUrl({ resetPage: true });
  }

  createNew(): void {
    this.createDialogData = {
      code: '',
      name: '',
      processDefinitionKey: null,
      reportDepartments: [],
      reportFcGroups: [],
      periodType: 'MONTH',
    };
    this.isCreateDialogOpen = true;
  }

  onCreateDialogCancel(): void {
    this.isCreateDialogOpen = false;
  }

  onCreateDialogSave(event: AdvancedSettingsDialogData): void {
    if (this.creatingTemplate) return;
    this.creatingTemplate = true;
    this.gridTemplateService
      .createTemplate({
        code: event.code,
        name: event.name,
        columnConfigs: '[]',
        columnGroups: '[]',
        rows: [],
        processDefinitionKey: event.processDefinitionKey ?? null,
        reportDepartments: event.reportDepartments ?? [],
        reportFcGroups: event.reportFcGroups ?? [],
        periodType: event.periodType ?? 'MONTH',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (created) => {
          this.creatingTemplate = false;
          this.isCreateDialogOpen = false;
          this.dialog.success('Đã tạo biểu mẫu thành công!');
          this.router.navigate(['/excel-builder'], {
            queryParams: { templateId: created.id },
          });
        },
        error: (err) => {
          this.creatingTemplate = false;
          this.dialog.error(
            'Lỗi tạo biểu mẫu: ' + (err.error?.message || err.message),
          );
        },
      });
  }

  openRender(id: number): void {
    this.router.navigate(['/excel-render'], {
      queryParams: { templateId: id },
    });
  }

  editTemplate(id: number): void {
    this.router.navigate(['/excel-builder'], {
      queryParams: { templateId: id },
    });
  }

  deleteTemplate(id: number, name: string): void {
    this.dialog
      .confirm({
        title: 'X\u00F3a bi\u1EC3u m\u1EABu',
        message: `B\u1EA1n ch\u1EAFc ch\u1EAFn mu\u1ED1n x\u00F3a bi\u1EC3u m\u1EABu "${name}"?`,
        status: 'error',
        confirmText: 'X\u00F3a',
        cancelText: 'H\u1EE7y',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.actionLoadingIds.add(id);
        this.gridApi?.refreshCells({ force: true });
        this.gridTemplateService
          .deleteTemplate(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.actionLoadingIds.delete(id);
              this.dialog.success(
                '\u0110\u00E3 x\u00F3a bi\u1EC3u m\u1EABu th\u00E0nh c\u00F4ng',
              );
              this.loadData();
            },
            error: (err) => {
              this.actionLoadingIds.delete(id);
              this.gridApi?.refreshCells({ force: true });
              this.dialog.error(
                'L\u1ED7i x\u00F3a: ' + (err.error?.message || err.message),
              );
            },
          });
      });
  }

  copyTemplate(id: number, name: string): void {
    this.dialog
      .confirm({
        title: 'Sao chép biểu mẫu',
        message: `Tạo một bản sao của biểu mẫu "${name}"? Bản sao giữ nguyên cấu trúc hàng/cột và ở trạng thái Nháp.`,
        status: 'info',
        confirmText: 'Sao chép',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.actionLoadingIds.add(id);
        this.gridApi?.refreshCells({ force: true });
        this.gridTemplateService
          .copyTemplate(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (created) => {
              this.actionLoadingIds.delete(id);
              this.dialog.success(
                `Đã sao chép thành biểu mẫu "${created.name}"`,
              );
              this.loadData();
            },
            error: (err) => {
              this.actionLoadingIds.delete(id);
              this.gridApi?.refreshCells({ force: true });
              this.dialog.error(
                'Lỗi sao chép: ' + (err.error?.message || err.message),
              );
            },
          });
      });
  }

  publishTemplate(id: number): void {
    this.dialog
      .confirm({
        title: 'Xu\u1EA5t b\u1EA3n bi\u1EC3u m\u1EABu',
        message:
          'X\u00E1c nh\u1EADn xu\u1EA5t b\u1EA3n bi\u1EC3u m\u1EABu n\u00E0y?',
        status: 'info',
        confirmText: 'Xu\u1EA5t b\u1EA3n',
        cancelText: 'H\u1EE7y',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.actionLoadingIds.add(id);
        this.gridApi?.refreshCells({ force: true });
        this.gridTemplateService
          .publishTemplate(id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.actionLoadingIds.delete(id);
              this.dialog.success(
                '\u0110\u00E3 xu\u1EA5t b\u1EA3n th\u00E0nh c\u00F4ng',
              );
              this.loadData();
            },
            error: (err) => {
              this.actionLoadingIds.delete(id);
              this.gridApi?.refreshCells({ force: true });
              this.dialog.error(
                'L\u1ED7i xu\u1EA5t b\u1EA3n: ' +
                  (err.error?.message || err.message),
              );
            },
          });
      });
  }

  isOpen = false;
  onCancel() {
    this.isOpen = false;
  }
  onSubmit(file: File | null) {
    if (file) {
      // 👉 upload API
    }
  }
  onDownloadTemplate() {
    console.log('Download template...');
  }
}
