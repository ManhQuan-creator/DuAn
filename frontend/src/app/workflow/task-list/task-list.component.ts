import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import { Subject, takeUntil } from 'rxjs';

import { TuiButtonModule, TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@tinkoff/ng-polymorpheus';
import { AppDialogService } from '../../shared/dialog.service';
import { WorkflowService, WorkflowTaskItem } from '../workflow.service';
import { ApprovalDialogComponent, ApprovalDialogData, ApprovalDialogResult } from '../approval-dialog/approval-dialog.component';
import { AgGridWrapperComponent } from '../../shared/components/ag-grid-wrapper/ag-grid-wrapper.component';
import { PageHeaderBreadcrumb, PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridWrapperComponent, TuiButtonModule, PageHeaderComponent],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.scss'],
})
export class TaskListComponent implements OnInit, OnDestroy {
  private readonly workflowService = inject(WorkflowService);
  private readonly dialogService = inject(TuiDialogService);
  private readonly appDialog = inject(AppDialogService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  tasks: WorkflowTaskItem[] = [];
  loading = false;
  searchText = '';

  readonly breadcrumbs: PageHeaderBreadcrumb[] = [
    { label: 'Trang chủ', link: '' },
    { label: 'Công việc của tôi', link: '' },
  ];

  get filteredTasks(): WorkflowTaskItem[] {
    if (!this.searchText.trim()) return this.tasks;
    const q = this.searchText.toLowerCase();
    return this.tasks.filter(t =>
      (t.taskName || '').toLowerCase().includes(q) ||
      (t.submittedBy || '').toLowerCase().includes(q) ||
      (t.orgCode || '').toLowerCase().includes(q)
    );
  }

  onSearchChange(): void {
    // filtering is reactive via getter
  }

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
      headerName: 'Tên công việc', field: 'taskName', flex: 1, sortable: true, filter: true,
      cellStyle: { fontWeight: '500', color: '#1e293b' }
    },
    {
      headerName: 'Đơn vị', field: 'orgCode', width: 120, sortable: true, filter: true,
      valueFormatter: (p: any) => p.value || 'TCT'
    },
    {
      headerName: 'Người gửi', field: 'submittedBy', width: 140, sortable: true, filter: true
    },
    {
      headerName: 'Người xử lý', field: 'assignee', width: 140, sortable: true,
      valueFormatter: (p: any) => p.value || 'Chưa nhận'
    },
    {
      headerName: 'Ngày tạo', field: 'createdAt', width: 160, sortable: true,
      valueFormatter: (p: any) => {
        if (!p.value) return '';
        const d = new Date(p.value);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }
    },
    {
      headerName: 'Thao tác', width: 260, pinned: 'right', sortable: false, filter: false,
      cellRenderer: (params: ICellRendererParams) => {
        const task = params.data as WorkflowTaskItem;
        const isRevision = task.taskDefinitionKey?.startsWith('revision_from_');
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;gap:6px;align-items:center;height:100%;';

        // View button — luôn hiện
        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'Xem';
        viewBtn.style.cssText = 'padding:4px 12px;border:1px solid #d1d5db;border-radius:6px;background:#fff;color:#334155;cursor:pointer;font-size:12px;font-weight:500;';
        viewBtn.addEventListener('click', () => this.navigateToEntry(task));
        div.appendChild(viewBtn);

        if (isRevision) {
          // Revision task: Gửi lại hoặc Hủy
          const resubmitBtn = document.createElement('button');
          resubmitBtn.textContent = 'Gửi lại';
          resubmitBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:6px;background:#f59e0b;color:#fff;cursor:pointer;font-size:12px;font-weight:500;';
          resubmitBtn.addEventListener('click', () => this.quickAction(task, 'RESUBMIT'));
          div.appendChild(resubmitBtn);
        } else {
          // Approval task: Duyệt + Xử lý
          const approveBtn = document.createElement('button');
          approveBtn.textContent = 'Duyệt';
          approveBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:6px;background:#22c55e;color:#fff;cursor:pointer;font-size:12px;font-weight:500;';
          approveBtn.addEventListener('click', () => this.quickAction(task, 'APPROVE'));
          div.appendChild(approveBtn);

          const processBtn = document.createElement('button');
          processBtn.textContent = 'Xử lý';
          processBtn.style.cssText = 'padding:4px 12px;border:none;border-radius:6px;background:#3b82f6;color:#fff;cursor:pointer;font-size:12px;font-weight:500;';
          processBtn.addEventListener('click', () => this.openApprovalDialog(task));
          div.appendChild(processBtn);
        }

        return div;
      }
    }
  ];

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading = true;
    this.workflowService.getMyTasks()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: tasks => {
          this.tasks = tasks;
          this.loading = false;
        },
        error: () => {
          this.appDialog.error('Không thể tải danh sách công việc');
          this.loading = false;
        }
      });
  }

  navigateToEntry(task: WorkflowTaskItem): void {
    this.router.navigate(['/excel-render'], {
      queryParams: { templateId: task.templateId, entryId: task.entryId }
    });
  }

  quickAction(task: WorkflowTaskItem, action: string): void {
    this.workflowService.completeTask(task.taskId, action, '')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.appDialog.success('Đã duyệt thành công');
          if (res?.redirectUrl) {
            this.router.navigateByUrl(res.redirectUrl);
          } else {
            this.loadTasks();
          }
        },
        error: () => this.appDialog.error('Không thể xử lý công việc')
      });
  }

  openApprovalDialog(task: WorkflowTaskItem): void {
    this.dialogService.open<ApprovalDialogResult | null>(
      new PolymorpheusComponent(ApprovalDialogComponent),
      {
        data: { taskName: task.taskName, entryId: task.entryId } as ApprovalDialogData,
        dismissible: true,
        size: 's',
        label: ''
      }
    ).pipe(takeUntil(this.destroy$)).subscribe(result => {
      if (result) {
        this.workflowService.completeTask(task.taskId, result.action, result.comment)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              this.appDialog.success('Đã xử lý thành công');
              if (res?.redirectUrl) {
                this.router.navigateByUrl(res.redirectUrl);
              } else {
                this.loadTasks();
              }
            },
            error: () => this.appDialog.error('Không thể xử lý công việc')
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
