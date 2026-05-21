import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButtonModule, TuiDataListModule, TuiDialogService, TuiSvgModule, TuiTextfieldControllerModule } from '@taiga-ui/core';
import { TuiDataListWrapperModule, TuiFilterByInputPipeModule, TuiInputModule, TuiSelectModule } from '@taiga-ui/kit';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { ColDef, GridApi, GridReadyEvent, ValueGetterParams } from 'ag-grid-community';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, takeUntil } from 'rxjs';
import { GridTemplateListItem } from '../excel-builder/models/grid-template.model';
import { GridTemplateService } from '../excel-builder/service/grid-template.service';
import { AgGridWrapperComponent } from '../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { CustomPaginationComponent } from '../shared/components/custom-pagination/custom-pagination.component';
import { RenderActionComponent } from '../shared/components/grid-custom-cell/render-action/render-action.component';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../shared/components/page-header/page-header.component';
import { AppDialogService } from '../shared/dialog.service';
import { CreateTemplateAccessRequest, TemplateAccessItem, TemplateAccessService } from '../shared/template-access.service';
import { TemplateAccessCreateDialogComponent, TemplateAccessCreateDialogData } from './dialog/template-access-create-dialog.component';
import { TemplateAccessEditDialogComponent, TemplateAccessEditDialogData, TemplateAccessEditDialogResult } from './dialog/template-access-edit-dialog.component';
import { GridHeaderComponent } from '../shared/components/grid-header/grid-header.component';

/** Hiển thị nhãn cho actionKey. APPROVE:N hiển thị động. */
function getActionLabel(actionKey: string): string {
  const map: Record<string, string> = {
    VIEW:   'Xem',
    EDIT:   'Nhập liệu',
    SUBMIT: 'Nộp duyệt',
  };
  if (map[actionKey]) return map[actionKey];
  if (actionKey?.startsWith('APPROVE:')) {
    return `Phê duyệt bước ${actionKey.split(':')[1]}`;
  }
  return actionKey ?? '';
}

@Component({
  selector: 'app-template-access-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TuiButtonModule,
    TuiSvgModule,
    TuiInputModule,
    TuiSelectModule,
    TuiDataListModule,
    TuiDataListWrapperModule,
    TuiFilterByInputPipeModule,
    TuiTextfieldControllerModule,
    AgGridWrapperComponent,
    CustomPaginationComponent,
    PageHeaderComponent,
    GridHeaderComponent
  ],
  templateUrl: './template-access-manager.component.html',
  styleUrls: ['./template-access-manager.component.scss'],
})
export class TemplateAccessManagerComponent implements OnInit, OnDestroy {
  private readonly accessService = inject(TemplateAccessService);
  private readonly templateService = inject(GridTemplateService);
  private readonly dialog = inject(AppDialogService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject = new Subject<void>();

  rules: TemplateAccessItem[] = [];
  searchText = '';
  selectedTemplate: GridTemplateListItem | null = null;
  templateList: GridTemplateListItem[] = [];

  pageNum = 0;   // 0-based nội bộ
  pageSize = 10;
  totalRows = 0;

  private gridApi!: GridApi;

  readonly breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Phân quyền nút trên báo cáo', link: '' },
  ];

  readonly stringifyTemplate = (t: GridTemplateListItem): string =>
    t ? `[${t.id}] ${t.name}` : '';

  defaultColDef: ColDef = { sortable: true, resizable: true, filter: false };

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
    { headerName: 'ID Rule',    field: 'id',                  width: 80 },
    { headerName: 'Template ID',field: 'templateId',          width: 110 },
    { headerName: 'Ban / Phòng',field: 'subjectOrgCode',      width: 150,
      valueFormatter: p => p.value ?? '(tất cả)' },
    { headerName: 'Chức danh',  field: 'subjectPositionCode', width: 160,
      valueFormatter: p => p.value ?? '(tất cả)' },
    {
      headerName: 'Action Key', field: 'actionKey', width: 160,
      valueFormatter: p => getActionLabel(p.value),
      cellStyle: p => {
        const v: string = p.value ?? '';
        let color = '#64748b';
        if (v === 'VIEW')                color = '#3b82f6';
        else if (v === 'EDIT')           color = '#10b981';
        else if (v === 'SUBMIT')         color = '#f59e0b';
        else if (v.startsWith('APPROVE')) color = '#ef4444';
        return { color, fontWeight: 600 };
      },
    },
    { headerName: 'Tạo bởi', field: 'createdBy', width: 130 },
    {
      headerName: 'Thao tác', width: 120, pinned: 'right',
      resizable: false, suppressMovable: true, lockPosition: 'right',
      sortable: false, filter: false,
      cellRenderer: RenderActionComponent,
      cellRendererParams: {
        showRender: false, showPublish: false, showEdit: true,
        onEdit: (data: any) => {
          const rule = this.rules.find(r => r.id === data?.id);
          if (rule) this.openEditDialog(rule);
        },
        onDelete: (data: any) => {
          const rule = this.rules.find(r => r.id === data?.id);
          if (rule) this.onDelete(rule);
        },
      },
    },
  ];

  ngOnInit() {
    this.templateService.getTemplates()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => this.templateList = data,
        error: () => this.dialog.error('Không thể tải danh sách biểu mẫu'),
      });

    // debounce search text
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.pageNum = 0;
      this.loadPage();
    });

    this.loadPage();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onGridReady(event: GridReadyEvent) {
    this.gridApi = event.api;
    this.gridApi.sizeColumnsToFit();
  }

  onSearchChange() { this.searchSubject.next(); }

  onTemplateChange() {
    this.pageNum = 0;
    this.loadPage();
  }

  loadPage() {
    this.accessService.search({
      templateId: this.selectedTemplate?.id ?? null,
      keyword:    this.searchText.trim() || undefined,
      pageNum:    this.pageNum + 1,   // BE dùng 1-based
      pageSize:   this.pageSize,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: page => {
        this.rules     = page.content;
        this.totalRows = page.totalElements;
        this.pageNum   = page.number;   // BE trả về 0-based
        this.gridApi?.refreshCells({ force: true });
      },
      error: () => this.dialog.error('Không thể tải danh sách phân quyền'),
    });
  }

  onPageChanged(event: { page: number }) {
    this.pageNum = event.page - 1;
    this.loadPage();
  }

  onPageSizeChanged(event: { pageSize: number }) {
    this.pageSize = event.pageSize;
    this.pageNum  = 0;
    this.loadPage();
  }

  openCreateDialog() {
    const data: TemplateAccessCreateDialogData = {
      initialTemplateId: this.selectedTemplate?.id,
    };
    this.dialogs.open<CreateTemplateAccessRequest[] | null>(
      new PolymorpheusComponent(TemplateAccessCreateDialogComponent),
      { data, dismissible: true, size: 'l', label: '' }
    ).pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (!result || result.length === 0) return;
      const requests = result.map(r => this.accessService.create(r));
      forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success(`Đã tạo ${result.length} rule phân quyền`);
          this.loadPage();
        },
        error: err => this.dialog.error(err.error?.message || 'Lỗi tạo rule'),
      });
    });
  }

  openEditDialog(rule: TemplateAccessItem) {
    const tpl = this.templateList.find(t => t.id === rule.templateId);
    const data: TemplateAccessEditDialogData = {
      id: rule.id,
      templateId: rule.templateId,
      templateName: tpl?.name ?? `Template #${rule.templateId}`,
      actionKey: rule.actionKey,
      subjectOrgCode: rule.subjectOrgCode,
      subjectPositionCode: rule.subjectPositionCode,
    };
    this.dialogs.open<TemplateAccessEditDialogResult | null>(
      new PolymorpheusComponent(TemplateAccessEditDialogComponent),
      { data, dismissible: true, size: 'm', label: '' }
    ).pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (!result) return;
      this.accessService.update(result.id, result.data).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.dialog.success('Đã cập nhật rule phân quyền');
          this.loadPage();
        },
        error: err => this.dialog.error(err.error?.message || 'Lỗi cập nhật rule'),
      });
    });
  }

  onDelete(rule: TemplateAccessItem) {
    const subject = [rule.subjectOrgCode, rule.subjectPositionCode]
      .filter(Boolean).join(' / ') || '(tất cả)';
    this.dialog.confirm({
      title: 'Xác nhận xóa rule',
      message: `Xóa quyền "${getActionLabel(rule.actionKey)}" cho "${subject}"?`,
      status: 'warning', confirmText: 'Xóa', cancelText: 'Hủy',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.accessService.delete(rule.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => { this.dialog.success('Đã xóa rule'); this.loadPage(); },
        error: () => this.dialog.error('Lỗi khi xóa rule'),
      });
    });
  }
}
