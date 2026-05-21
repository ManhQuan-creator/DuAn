import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiButtonModule, TuiDataListModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { GridTemplateService } from '../excel-builder/service/grid-template.service';
import { FilterGridTemplateRequest, GridTemplateListItem } from '../excel-builder/models/grid-template.model';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';
import { Organization, OrganizationService } from '../shared/organization.service';

@Component({
  selector: 'app-report-type',
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
    GridHeaderComponent,
    AgGridWrapperComponent,
    CustomPaginationComponent,
  ],
  templateUrl: './report-type.component.html',
  styleUrl: './report-type.component.scss',
})
export class ReportTypeComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private gridTemplateService = inject(GridTemplateService);
  private orgService = inject(OrganizationService);
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();
  readonly breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Báo cáo', link: '' },
    { label: 'Danh sách báo cáo theo lĩnh vực', link: '' },
  ];
  readonly headerTitle = 'Danh sách báo cáo theo lĩnh vực';
  readonly subTitle = 'Tra cứu các biểu mẫu báo cáo theo lĩnh vực';
  readonly gridTitle = 'Danh sách biểu mẫu';

  // --- Search filters ---
  filterCode = '';
  filterSector = '';
  filterOrgCode = 'ALL';
  filterStatus = 'ALL';

  readonly statusOptions = ['ALL', 'DRAFT', 'PUBLISHED'];
  readonly stringifyStatus = (s: string): string => {
    switch (s) {
      case 'ALL': return 'Tất cả';
      case 'DRAFT': return 'Nháp';
      case 'PUBLISHED': return 'Đã xuất bản';
      default: return s;
    }
  };

  organizations: Organization[] = [];
  orgOptions: string[] = ['ALL'];
  readonly stringifyOrg = (code: string): string => {
    if (code === 'ALL') return 'Tất cả';
    const org = this.organizations.find(o => o.orgCode === code);
    return org ? `${org.orgCode} - ${org.orgName}` : code;
  };

  // --- Grid ---
  templateList: GridTemplateListItem[] = [];
  pageNum = 0;
  pageSize = 10;
  totalRows = 0;
  loading = false;

  readonly columnDefs: ColDef[] = [
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
          return api.paginationGetCurrentPage() * api.paginationGetPageSize() + idx + 1;
        }
        return idx + 1;
      },
      cellStyle: { textAlign: 'center' },
    },
    {
      headerName: 'Mã biểu mẫu',
      field: 'code',
      flex: 0.8,
      minWidth: 120,
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
        link.style.cssText = 'color:#2563eb;cursor:pointer;text-decoration:none;font-weight:500;';
        link.addEventListener('mouseenter', () => { link.style.textDecoration = 'underline'; });
        link.addEventListener('mouseleave', () => { link.style.textDecoration = 'none'; });
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
      minWidth: 120,
      sortable: true,
      cellRenderer: (params: ICellRendererParams) => {
        if (params.value === 'PUBLISHED')
          return '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:10px;font-size:12px;">Đã xuất bản</span>';
        return '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:10px;font-size:12px;">Nháp</span>';
      },
    },
    {
      headerName: 'Phiên bản',
      field: 'version',
      flex: 0.6,
      minWidth: 80,
      sortable: true,
    },
    {
      headerName: 'Ngày tạo',
      field: 'createdAt',
      flex: 1,
      minWidth: 140,
      sortable: true,
      valueFormatter: (p: any) =>
        p.value
          ? new Date(p.value).toLocaleDateString('vi-VN') + ' ' +
            new Date(p.value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
          ? new Date(p.value).toLocaleDateString('vi-VN') + ' ' +
            new Date(p.value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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
      cellRenderer: (params: ICellRendererParams) => {
        const btn = document.createElement('button');
        btn.textContent = 'Xem';
        btn.style.cssText =
          'background:#2563eb;color:#fff;border:none;border-radius:4px;padding:3px 12px;cursor:pointer;font-size:12px;';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openRender(params.data.id);
        });
        return btn;
      },
    },
  ];

  ngOnInit(): void {
    this.orgService.getAll().pipe(takeUntil(this.destroy$)).subscribe(orgs => {
      this.organizations = orgs;
      this.orgOptions = ['ALL', ...orgs.map(o => o.orgCode)];
    });

    this.loadData();
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.pageNum = 0;
        this.loadData();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    this.searchSubject.next(this.getSearchSignature());
  }

  onStatusChange(): void {
    this.searchSubject.next(this.getSearchSignature());
  }

  onOrgChange(): void {
    this.searchSubject.next(this.getSearchSignature());
  }

  loadData(): void {
    this.loading = true;
    const keyword = [this.filterCode.trim(), this.filterSector.trim()].filter(Boolean).join(' ') || undefined;
    const status = this.filterStatus !== 'ALL' ? this.filterStatus : undefined;

    const request: FilterGridTemplateRequest = {
      keyword,
      status,
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

  private getSearchSignature(): string {
    return JSON.stringify({
      code: this.filterCode.trim(),
      sector: this.filterSector.trim(),
      orgCode: this.filterOrgCode,
      status: this.filterStatus,
    });
  }

  onPageChanged(event: any): void {
    this.pageNum = event.page - 1;
    this.loadData();
  }

  onPageSizeChanged(event: any): void {
    this.pageSize = event.pageSize;
    this.pageNum = 0;
    this.loadData();
  }

  openRender(id: number): void {
    this.router.navigate(['/excel-render'], { queryParams: { templateId: id } });
  }
}
