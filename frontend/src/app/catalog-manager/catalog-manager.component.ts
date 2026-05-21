import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  ICellRendererParams,
  ValueGetterParams,
} from 'ag-grid-community';
import {
  debounceTime,
  distinctUntilChanged,
  finalize,
  Subject,
  takeUntil,
} from 'rxjs';

import { CatalogItem } from '../excel-builder/models/catalog.data';
import { CatalogService } from './service/catalog.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import {
  RenderActionComponent,
} from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { AppDialogService } from '../shared/dialog.service';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../shared/components/page-header/page-header.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import {
  CatalogTypeItem,
  CreateCatalogItemRequest,
  CreateCatalogTypeRequest,
  FilterCatalogItemRequest,
  UpdateCatalogItemRequest,
  UpdateCatalogTypeRequest,
} from './models/catalog.model';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';

@Component({
  selector: 'app-catalog-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiInputModule,
    TuiTextfieldControllerModule,
    AgGridWrapperComponent,
    PageHeaderComponent,
    GridHeaderComponent,
    CustomPaginationComponent,
    TuiDataListModule,
    TuiSelectModule,
  ],
  templateUrl: './catalog-manager.component.html',
  styleUrls: ['./catalog-manager.component.scss'],
})
export class CatalogManagerComponent implements OnInit, OnDestroy {
  private catalogService = inject(CatalogService);
  private dialog = inject(AppDialogService);
  private destroy$ = new Subject<void>();

  // State
  catalogTypes: CatalogTypeItem[] = [];
  selectedType: CatalogTypeItem | null = null;
  items: CatalogItem[] = [];
  typesLoading = false;
  itemsLoading = false;
  typeSearch = '';
  itemSearch = '';

  private searchSubject = new Subject<string>();

  public displayBreadcrumbs: PageHeaderBreadcrumb[] = [
    {
      label: 'Trang chủ',
      link: '',
    },
    {
      label: 'Quản lý danh mục',
      link: '',
    },
    {
      label: 'Danh sách danh mục',
      link: '',
    },
  ];

  // AG Grid
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;

  title = 'Các CT MTV';
  btnLabelCreateNew = 'Thêm mục';

  statusFilter = 'ALL';
  readonly statusOptions = ['ALL', 'ACTIVE', 'INACTIVE'];
  readonly stringifyStatus = (s: string): string => {
    switch (s) {
      case 'ALL':
        return 'Tất cả';
      case 'ACTIVE':
        return 'Hoạt động';
      case 'INACTIVE':
        return 'Không hoạt động';
      default:
        return s;
    }
  };

  private gridApi!: GridApi;
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
      field: 'id',
      flex: 1,
      minWidth: 120,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Tên',
      field: 'name',
      flex: 2.5,
      minWidth: 200,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Ghi chú',
      field: 'note',
      flex: 1.5,
      minWidth: 150,
    },
    {
      headerName: 'Thứ tự',
      field: 'sortOrder',
      flex: 0.8,
      minWidth: 100,
      sortable: true,
    },
    {
      headerName: 'Trạng thái',
      field: 'active',
      flex: 1,
      minWidth: 120,
      resizable: false,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value === false) {
          return '<span style="background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:12px;font-size:12px">Ẩn</span>';
        }
        return '<span style="background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:12px;font-size:12px">Hoạt động</span>';
      },
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
        showRender: false,
        showPublish: false,
        onEdit: (data: any) => {
          const item = this.items.find((i) => i.id === data?.id);
          if (item) this.editItem(item);
        },
        onDelete: (data: any) => {
          const item = this.items.find((i) => i.id === data?.id);
          if (item) this.deleteItem(item);
        },
      },
    },
  ];
  defaultColDef: ColDef = { resizable: true };

  ngOnInit(): void {
    this.loadTypes();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadItems());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  // === Types ===

  loadTypes(): void {
    this.typesLoading = true;
    this.catalogService
      .getCatalogTypes(true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.typesLoading = false)),
      )
      .subscribe({
        next: (types) => {
          this.catalogTypes = types;
          if (!this.selectedType && types.length > 0) {
            this.selectType(types[0]);
          } else if (this.selectedType) {
            const updated = types.find((t) => t.id === this.selectedType!.id);
            if (updated) this.selectedType = updated;
          }
        },
        error: (err) =>
          this.dialog.error(
            'Lỗi tải danh mục: ' + (err.error?.message || err.message),
          ),
      });
  }

  selectType(type: CatalogTypeItem): void {
    this.selectedType = type;
    this.itemSearch = '';
    this.loadItems();
  }

  get filteredTypes(): CatalogTypeItem[] {
    if (!this.typeSearch) return this.catalogTypes;
    const s = this.typeSearch.toLowerCase();
    return this.catalogTypes.filter((t) => t.name.toLowerCase().includes(s));
  }

  addType(): void {
    this.dialog
      .prompt({
        title: 'Thêm loại danh mục',
        fields: [
          {
            key: 'type',
            label: 'Mã loại (VD: BRANCH)',
            placeholder: 'VD: BRANCH',
            required: true,
          },
          {
            key: 'name',
            label: 'Tên loại',
            placeholder: 'VD: Chi nhánh',
            required: true,
          },
          {
            key: 'description',
            label: 'Mô tả',
            placeholder: 'Mô tả (tùy chọn)',
          },
        ],
        confirmText: 'Tạo',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        const req: CreateCatalogTypeRequest = {
          type: result['type'].toUpperCase(),
          name: result['name'],
          description: result['description'] || undefined,
        };
        this.typesLoading = true;
        this.catalogService
          .createCatalogType(req)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => (this.typesLoading = false)),
          )
          .subscribe({
            next: (created) => {
              this.dialog.success('Đã tạo loại danh mục');
              this.loadTypes();
              this.selectType(created);
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  editType(type: CatalogTypeItem, event: Event): void {
    event.stopPropagation();
    this.dialog
      .prompt({
        title: 'Sửa loại danh mục',
        fields: [
          {
            key: 'name',
            label: 'Tên loại',
            placeholder: 'Tên loại',
            required: true,
          },
          { key: 'description', label: 'Mô tả', placeholder: 'Mô tả' },
        ],
        initialValues: { name: type.name, description: type.description || '' },
        confirmText: 'Lưu',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        const req: UpdateCatalogTypeRequest = {
          name: result['name'],
          description: result['description'] || undefined,
        };
        this.catalogService
          .updateCatalogType(type.id, req)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.dialog.success('Đã cập nhật loại danh mục');
              this.loadTypes();
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  deleteType(type: CatalogTypeItem, event: Event): void {
    event.stopPropagation();
    this.dialog
      .confirm({
        title: 'Xóa loại danh mục',
        message: `Bạn chắc chắn muốn xóa loại "${type.name}"?`,
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        this.catalogService
          .deleteCatalogType(type.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.dialog.success('Đã xóa loại danh mục');
              this.loadTypes();
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  // === Items ===

  loadItems(): void {
    if (!this.selectedType) return;

    const active =
      this.statusFilter === 'ACTIVE'
        ? true
        : this.statusFilter === 'INACTIVE'
          ? false
          : undefined;

    const request: FilterCatalogItemRequest = {
      type: this.selectedType.type,
      keyword: this.itemSearch,
      active: active,
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };

    this.itemsLoading = true;
    this.catalogService
      .searchCatalogItems(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.itemsLoading = false)),
      )
      .subscribe({
        next: (res) => {
          this.items = res.content;
          this.totalRows = res.totalElements;
          this.pageNum = res.number;
          this.pageSize = res.size;
        },
        error: (err) =>
          this.dialog.error(
            'Lỗi tải mục: ' + (err.error?.message || err.message),
          ),
      });
  }

  get filteredItems(): CatalogItem[] {
    if (!this.itemSearch) return this.items;
    const s = this.itemSearch.toLowerCase();
    return this.items.filter(
      (i) => i.id.toLowerCase().includes(s) || i.name.toLowerCase().includes(s),
    );
  }

  addItem(): void {
    if (!this.selectedType) return;
    this.dialog
      .prompt({
        title: 'Thêm mục danh mục',
        fields: [
          {
            key: 'id',
            label: 'Mã mục (VD: BRANCH_01)',
            placeholder: 'VD: BRANCH_01',
            required: true,
          },
          {
            key: 'name',
            label: 'Tên mục',
            placeholder: 'VD: Chi nhánh Hà Nội',
            required: true,
          },
          { key: 'note', label: 'Ghi chú', placeholder: 'Ghi chú (tùy chọn)' },
          { key: 'sortOrder', label: 'Thứ tự', placeholder: 'VD: 1' },
        ],
        confirmText: 'Tạo',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        const req: CreateCatalogItemRequest = {
          id: result['id'],
          name: result['name'],
          type: this.selectedType!.type,
          note: result['note'] || undefined,
          sortOrder: result['sortOrder']
            ? parseInt(result['sortOrder'], 10)
            : undefined,
        };
        this.itemsLoading = true;
        this.catalogService
          .createCatalogItem(req)
          .pipe(
            takeUntil(this.destroy$),
            finalize(() => (this.itemsLoading = false)),
          )
          .subscribe({
            next: () => {
              this.dialog.success('Đã tạo mục danh mục');
              this.loadItems();
              this.loadTypes();
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  editItem(item: CatalogItem): void {
    this.dialog
      .prompt({
        title: 'Sửa mục danh mục',
        fields: [
          {
            key: 'name',
            label: 'Tên mục',
            placeholder: 'Tên mục',
            required: true,
          },
          { key: 'note', label: 'Ghi chú', placeholder: 'Ghi chú' },
          { key: 'sortOrder', label: 'Thứ tự', placeholder: 'Thứ tự' },
        ],
        initialValues: {
          name: item.name,
          note: item.note || '',
          sortOrder: item.sortOrder != null ? String(item.sortOrder) : '',
        },
        confirmText: 'Lưu',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        if (!result) return;
        const req: UpdateCatalogItemRequest = {
          name: result['name'],
          note: result['note'] || undefined,
          sortOrder: result['sortOrder']
            ? parseInt(result['sortOrder'], 10)
            : undefined,
        };
        this.catalogService
          .updateCatalogItem(item.id, req)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.dialog.success('Đã cập nhật mục');
              this.loadItems();
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  deleteItem(item: CatalogItem): void {
    this.dialog
      .confirm({
        title: 'Xác nhận xóa',
        message: `Bạn chắc chắn muốn xóa mục "${item.name}"?`,
        status: 'error',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.catalogService
          .deleteCatalogItem(item.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.dialog.success('Đã xóa mục');
              this.loadItems();
              this.loadTypes();
            },
            error: (err) =>
              this.dialog.error('Lỗi: ' + (err.error?.message || err.message)),
          });
      });
  }

  onSearchItem(): void {
    this.searchSubject.next(this.itemSearch);
  }

  onStatusChange(): void {
    this.pageNum = 0;
    this.loadItems();
  }

  onPageChanged(event: any): void {
    this.pageNum = event.page - 1;
    this.loadItems();
  }

  onPageSizeChanged(event: any): void {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadItems();
  }
}
