import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiTextfieldControllerModule,
} from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import {
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  Subject,
  takeUntil,
} from 'rxjs';
import { FilterCatalogItemRequest } from '../../../catalog-manager/models/catalog.model';
import { CatalogItem } from '../../../excel-builder/models/catalog.data';
import { CatalogService } from '../../../catalog-manager/service/catalog.service';
import { AgGridWrapperComponent } from '../../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../../../shared/components/custom-pagination/custom-pagination.component';
import { GridHeaderComponent } from '../../../shared/components/grid-header/grid-header.component';
import {
  PageHeaderBreadcrumb,
  PageHeaderComponent,
} from '../../../shared/components/page-header/page-header.component';
import { AppDialogService } from '../../../shared/dialog.service';
import { Option } from '../../../shared/models/common.model';
import { saveAs } from 'file-saver';
import {
  SuggestedCategory,
  SuggestedCategoryFilter,
} from '../../model/suggested-category.model';
import { SuggestedCategoryService } from '../../service/suggested-category.service';
import { StatusCellRenderComponent } from '../render-action/status-cell-render.component';
import { AttachCellRenderComponent } from '../attach-cell-render/attach-cell-render.component';
import { RenderActionComponent } from '../../../shared/components/grid-custom-cell/render-action/render-action.component';
import { AttachFileDialogComponent } from '../../dialogs/attach-file-dialog/attach-file-dialog.component';
import { EntryFileItem } from '../../../excel-render/service/entry-file.service';

@Component({
  selector: 'app-suggested-category-list',
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiTextfieldControllerModule,
    TuiDataListModule,
    TuiInputModule,
    TuiSelectModule,
    PageHeaderComponent,
    GridHeaderComponent,
    CustomPaginationComponent,
    AgGridWrapperComponent,
    AttachFileDialogComponent,
  ],
  templateUrl: './suggested-category-list.component.html',
  styleUrl: './suggested-category-list.component.scss',
})
export class SuggestedCategoryListComponent implements OnInit, OnDestroy {
  readonly suggestedCategoryService = inject(SuggestedCategoryService);
  readonly dialog = inject(AppDialogService);
  readonly catalogService = inject(CatalogService);
  readonly destroy$ = new Subject<void>();
  readonly searchSubject = new Subject<string>();

  private gridApi?: GridApi;

  readonly breadcrumbs: PageHeaderBreadcrumb[] = [
    {
      label: 'Trang chủ',
      link: '/',
    },
    {
      label: 'Quy trình SCL',
      link: '/scl-category',
    },
    {
      label: 'Đơn vị lập kế hoạch',
      link: '/suggested-category',
    },
  ];

  readonly title = 'Danh sách hạng mục gợi ý';
  readonly headerTitle = 'Quản lý lập kế hoạch năm';
  readonly stringifyUnit = (unit: Option): string => unit.label;
  readonly stringifyYear = (yearPlan: string): string => yearPlan;
  readonly stringifyStatus = (item: CatalogItem): string => item?.name || '';

  dialogAttachFile: any = {
    isOpen: false,
    attachedFiles: [] as EntryFileItem[],
  };

  unitFilter: Option | null = null;
  categoryCodeFilter = '';
  categoryNameFilter = '';
  yearFilter: string | null = null;
  statusFilter: CatalogItem | null = null;
  pageNum = 0;
  pageSize = 20;
  totalRows = 0;
  loading = false;
  templateList: SuggestedCategory[] = [];
  listUnitOptions: Option[] = [];
  yearOptions: string[] = [];
  statusOptions: CatalogItem[] = [];

  readonly columnDefs: ColDef[] = [
    {
      headerName: 'STT',
      colId: 'stt',
      width: 70,
      pinned: 'left',
      sortable: false,
      filter: false,
      resizable: false,
      valueGetter: (params: ValueGetterParams<SuggestedCategory>) => {
        const idx = params.node?.rowIndex ?? 0;
        return this.pageNum * this.pageSize + idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Đơn vị',
      field: 'unitName',
      minWidth: 180,
      flex: 1.5,
    },
    {
      headerName: 'Mã hạng mục',
      field: 'categoryCode',
      minWidth: 160,
      flex: 1,
    },
    {
      headerName: 'Tên hạng mục',
      field: 'categoryName',
      minWidth: 220,
      flex: 2,
    },
    {
      headerName: 'Năm kế hoạch',
      field: 'yearPlan',
      width: 140,
    },
    {
      headerName: 'Giá trị khái toán',
      field: 'estimatedValue',
      minWidth: 180,
      flex: 1,
    },
    {
      headerName: 'Trạng thái',
      field: 'status',
      minWidth: 180,
      flex: 1,
      cellRenderer: StatusCellRenderComponent,
    },
    {
      headerName: 'File đính kèm',
      field: 'attachmentFile',
      minWidth: 120,
      flex: 1,
      cellRenderer: AttachCellRenderComponent,
      cellRendererParams: {
        onAttachClick: (data: SuggestedCategory) =>
          this.openAttachDialog(data.attachmentFile || []),
      },
    },
    {
      headerName: 'Thao tác',
      field: 'actions',
      minWidth: 100,
      flex: 1,
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        showDownload: (data: SuggestedCategory) => true,
        onDownload: (data: SuggestedCategory) => this.handleDownload(data),
      },
    },
  ];

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadData();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadData());

    this.loadStatusOptions();
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
      this.statusFilter?.id ?? '',
    ].join('|');

    this.searchSubject.next(signature);
  }

  onUnitChange(): void {
    this.onSearchInput();
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

  handleExportSelected(): void {
    this.suggestedCategoryService
      .exportCategories(this.buildRequest())
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
          this.dialog.success('Export danh sách hạng mục gợi ý thành công');
        },
        error: (err) => {
          this.dialog.error(
            'Lỗi export: ' +
              (err?.error?.message ||
                err?.message ||
                'Không thể export danh sách hạng mục gợi ý'),
          );
        },
      });
  }

  private loadFilterOptions(): void {
    forkJoin({
      listUnits: this.catalogService.getCatalogs('CT_DIEN_LUC'),
      years: this.suggestedCategoryService.getAvailableYears(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ listUnits, years }) => {
          this.listUnitOptions = listUnits
            .map((item) => ({ value: item.name, label: item.name }))
            .filter((option): option is Option => !!option.label);
          this.yearOptions = years;
        },
        error: () => {
          this.listUnitOptions = [];
          this.yearOptions = [];
        },
      });
  }

  private loadStatusOptions(): void {
    const req: FilterCatalogItemRequest = {
      keyword: '',
      pageNum: 0,
      pageSize: 20,
      type: 'APPROVE_STATUS_SCL',
    };

    this.catalogService
      .searchCatalogItems(req)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.statusOptions = res.content || [];
        },
        error: () => {
          this.statusOptions = [];
        },
      });
  }

  private loadData(): void {
    this.loading = true;

    this.suggestedCategoryService
      .searchCategories(this.buildRequest())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.templateList = res.content ?? [];
          this.pageNum = res.number ?? 0;
          this.pageSize = res.size ?? this.pageSize;
          this.totalRows = res.totalElements ?? 0;
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

  private buildRequest(): SuggestedCategoryFilter {
    return {
      unitName: this.unitFilter?.value || undefined,
      categoryCode: this.categoryCodeFilter.trim() || undefined,
      categoryName: this.categoryNameFilter.trim() || undefined,
      yearPlan: this.yearFilter || undefined,
      status: this.statusFilter?.id || undefined,
      pageNum: this.pageNum,
      pageSize: this.pageSize,
    };
  }

  private getExportFileName(contentDisposition: string | null): string {
    const fallback = 'danh-sach-hang-muc-goi-y.xlsx';

    if (!contentDisposition) {
      return fallback;
    }

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const asciiMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
    return asciiMatch?.[1] || fallback;
  }

  private handleDownload(data: SuggestedCategory): void {
    if (!data.attachmentFile || data.attachmentFile.length === 0) {
      this.dialog.error('Không có file đính kèm để tải xuống');
      return;
    }
  }

  openAttachDialog(attachmentFiles: EntryFileItem[]): void {
    this.dialogAttachFile = {
      isOpen: true,
      attachedFiles: [...attachmentFiles],
    };
  }
}
