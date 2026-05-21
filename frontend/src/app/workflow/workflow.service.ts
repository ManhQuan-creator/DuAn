import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ResponseData<T> {
  code: string;
  message: string;
  data: T;
}

export interface WorkflowTaskItem {
  taskId: string;
  taskName: string;
  taskDefinitionKey: string;
  processInstanceId: string;
  entryId: number;
  templateId: number;
  orgCode: string;
  submittedBy: string;
  assignee: string | null;
  createdAt: string;
}

export interface WorkflowHistoryItem {
  activityName: string;
  assignee: string | null;
  action: string | null;
  comment: string | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
}

/**
 * Kết quả do WorkflowActionHandler backend trả về sau khi complete task.
 * Có thể null nếu step không có handler hoặc handler không muốn tín hiệu.
 */
export interface WorkflowActionResult {
  /** URL điều hướng — FE navigate tới đây sau khi duyệt thành công. Null = không điều hướng. */
  redirectUrl?: string | null;
  /** Dữ liệu tuỳ ý để mở rộng sau. */
  data?: any;
}

@Injectable({ providedIn: 'root' })
export class WorkflowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/excelpro-service/v1';

  /** Kiểm tra user hiện tại có quyền gửi duyệt cho template này không */
  canSubmit(templateId: number): Observable<boolean> {
    return this.http
      .get<ResponseData<boolean>>(`${this.baseUrl}/grid-templates/${templateId}/can-submit`)
      .pipe(map(res => res.data));
  }

  submitEntry(templateId: number, entryId: number): Observable<void> {
    return this.http
      .post<ResponseData<void>>(`${this.baseUrl}/grid-templates/${templateId}/entries/${entryId}/submit`, {})
      .pipe(map(() => void 0));
  }

  completeTask(taskId: string, action: string, comment: string): Observable<WorkflowActionResult | null> {
    return this.http
      .post<ResponseData<WorkflowActionResult | null>>(`${this.baseUrl}/workflow/tasks/${taskId}/complete`, { action, comment })
      .pipe(map(res => res.data ?? null));
  }

  getMyTasks(): Observable<WorkflowTaskItem[]> {
    return this.http
      .get<ResponseData<WorkflowTaskItem[]>>(`${this.baseUrl}/workflow/my-tasks`)
      .pipe(map(res => res.data));
  }

  getMyTaskCount(): Observable<number> {
    return this.http
      .get<ResponseData<number>>(`${this.baseUrl}/workflow/my-tasks/count`)
      .pipe(map(res => res.data));
  }

  getEntryHistory(templateId: number, entryId: number): Observable<WorkflowHistoryItem[]> {
    return this.http
      .get<ResponseData<WorkflowHistoryItem[]>>(`${this.baseUrl}/grid-templates/${templateId}/entries/${entryId}/history`)
      .pipe(map(res => res.data));
  }
}
