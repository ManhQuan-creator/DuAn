import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ColDef, GridApi, GridReadyEvent, ICellRendererComp, ValueGetterParams } from 'ag-grid-community';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

import { TuiLabelModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiInputModule } from '@taiga-ui/kit';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';

import {
  WorkflowDefinitionService,
  WorkflowDefinitionDetail,
  WorkflowDefinitionListItem,
  Page,
} from './workflow-definition.service';
import { AppDialogService } from '../shared/dialog.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';
import { RenderActionComponent } from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../shared/components/page-header/page-header.component';

class WorkflowStatusCellRenderComponent implements ICellRendererComp {
  private eGui!: HTMLElement;

  init(params: any): void {
    this.eGui = document.createElement('span');

    const raw = params?.value ?? params?.data?.status;
    const status = String(raw ?? '').toUpperCase();

    let label = raw == null ? '' : String(raw);
    let background = '#eef2f7';
    let color = '#334155';

    if (status === 'DRAFT') {
      label = 'Draft';
      background = '#fef7e0';
      color = '#b06000';
    } else if (status === 'DEPLOYED') {
      label = 'Deployed';
      background = '#e6f4ea';
      color = '#137333';
    }

    this.eGui.textContent = label;
    this.eGui.style.cssText = `
      display:inline-flex;
      align-items:center;
      padding:0 8px;
      height:25px;
      border-radius:10px;
      font-size:13px;
      font-weight:500;
      white-space:nowrap;
      background:${background};
      color:${color};
    `;
  }

  getGui(): HTMLElement { return this.eGui; }
  refresh(): boolean { return false; }
  destroy(): void { }
}

@Component({
  selector: 'app-workflow-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiInputModule,
    TuiTextfieldControllerModule,
    TuiLabelModule,
    PageHeaderComponent,
    AgGridWrapperComponent,
    GridHeaderComponent,
    CustomPaginationComponent,
  ],
  templateUrl: './workflow-manager.component.html',
  styleUrls: ['./workflow-manager.component.scss'],
})
export class WorkflowManagerComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<void>();
  private readonly svc = inject(WorkflowDefinitionService);
  private readonly dialog = inject(AppDialogService);
  private readonly router = inject(Router);

  loading = false;
  search = '';
  status: '' | 'DRAFT' | 'DEPLOYED' = '';

  // server paging
  pageNum = 0;
  pageSize = 20;
  totalElements = 0;
  totalPages = 0;

  get totalRows(): number { return this.totalElements; }

  workflows: WorkflowDefinitionListItem[] = [];

  headerTitle = 'Danh sách quy trình';
  subTitle = 'Quản lý quy trình (Draft/Deployed) trong hệ thống';
  breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Hệ thống', link: '' },
    { label: 'Quản lý quy trình', link: '/workflow-manager' },
  ];

  title = 'Danh sách quy trình';
  btnLabelCreateNew = 'Thêm';

  private gridApi?: GridApi;

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
      valueGetter: (p: ValueGetterParams) =>
        this.pageNum * this.pageSize + (p.node?.rowIndex ?? 0) + 1,
      cellStyle: { textAlign: 'center' },
    },
    { headerName: 'Tên quy trình', field: 'name', flex: 1, minWidth: 220 },
    { headerName: 'Mã quy trình', field: 'workflowKey', width: 180 },
    {
      headerName: 'Trạng thái',
      field: 'status',
      width: 140,
      resizable: false,
      cellRenderer: WorkflowStatusCellRenderComponent,
    },
    { headerName: 'Phiên bản', field: 'version', width: 110 },
    { headerName: 'Số bước', field: 'stepCount', width: 110 },
    { headerName: 'Người tạo', field: 'createdBy', width: 140 },
    {
      headerName: 'Ngày tạo',
      field: 'createdAt',
      width: 180,
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
      width: 180,
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
      width: 140,
      minWidth: 140,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'right',
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        onEdit: (row: WorkflowDefinitionListItem) => this.goEditor(row),
        onPublish: (row: WorkflowDefinitionListItem) => this.deploy(row),
        showPublish: (row: WorkflowDefinitionListItem) => String(row?.status).toUpperCase() === 'DRAFT',
        onDelete: (row: WorkflowDefinitionListItem) => this.delete(row),
        showDelete: (row: WorkflowDefinitionListItem) => String(row?.status).toUpperCase() === 'DRAFT',
      },
    },
  ];

  get filteredList(): WorkflowDefinitionListItem[] {
    // server-side search/paging -> do not filter on client
    return this.workflows;
  }

  ngOnInit(): void {
    this.loadData();
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.pageNum = 0;
      this.loadData();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
  }

  onSearchInput(): void { this.searchSubject.next(); }

  onStatusChange(): void {
    this.pageNum = 0;
    this.loadData();
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

  private loadData(): void {
    this.loading = true;

    this.svc
      .search({
        keyword: this.search?.trim() || undefined,
        status: this.status || undefined,
        pageNum: this.pageNum,
        pageSize: this.pageSize,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page: Page<WorkflowDefinitionListItem>) => {
          this.workflows = page?.content ?? [];
          this.totalElements = page?.totalElements ?? 0;
          this.totalPages = page?.totalPages ?? 0;
          this.pageNum = page?.number ?? this.pageNum;
          this.pageSize = page?.size ?? this.pageSize;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.dialog.error('Không thể tải danh sách quy trình');
        },
      });
  }

  createNew(): void {
    this.dialog.prompt({
      title: 'Thêm quy trình mới',
      fields: [
        { key: 'workflowKey', label: 'Mã quy trình', placeholder: 'vd: sxkd-approval', required: true },
        { key: 'name', label: 'Tên quy trình', placeholder: 'vd: Quy trình SXKD', required: true },
        { key: 'description', label: 'Mô tả', placeholder: 'Mô tả quy trình...' },
      ],
    }).pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (!result) return;
      this.svc.create({
        workflowKey: result['workflowKey'],
        name: result['name'],
        description: result['description'] || undefined,
        steps: [],
      }).pipe(takeUntil(this.destroy$)).subscribe({
        next: (created: WorkflowDefinitionDetail) => {
          this.dialog.success('Đã tạo quy trình');
          this.loadData();
          // đi thẳng editor
          this.router.navigate(['/workflow-manager/editor', created.id], {
            state: { bpmnXml: created.bpmnXml ?? '' },
          });
        },
        error: (err) => this.dialog.error(err?.error?.message || 'Lỗi tạo quy trình'),
      });
    });
  }

  private goEditor(row: WorkflowDefinitionListItem): void {
    this.router.navigate(['/workflow-manager/editor', row.id]);
  }

  private deploy(row: WorkflowDefinitionListItem): void {
    if (String(row.status).toUpperCase() !== 'DRAFT') return;
    this.dialog.confirm({
      title: 'Triển khai quy trình',
      message: `Triển khai "${row.name}" lên Camunda? Sau khi triển khai sẽ không thể sửa đổi.`,
      status: 'warning',
    }).pipe(takeUntil(this.destroy$)).subscribe(ok => {
      if (!ok) return;
      this.svc.deploy(row.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success('Đã triển khai thành công');
          this.loadData();
        },
        error: (err) => this.dialog.error(err?.error?.message || 'Lỗi triển khai'),
      });
    });
  }

  private delete(row: WorkflowDefinitionListItem): void {
    if (String(row.status).toUpperCase() !== 'DRAFT') return;
    this.dialog.confirm({
      title: 'Xóa quy trình',
      message: `Bạn có chắc muốn xóa quy trình "${row.name}"?`,
      status: 'error',
    }).pipe(takeUntil(this.destroy$)).subscribe(ok => {
      if (!ok) return;
      this.svc.delete(row.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success('Đã xóa');
          this.loadData();
        },
        error: (err) => this.dialog.error(err?.error?.message || 'Lỗi xóa quy trình'),
      });
    });
  }
}
