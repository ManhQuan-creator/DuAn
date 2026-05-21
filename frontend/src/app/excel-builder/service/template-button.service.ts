import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export type NavigationTarget = '_self' | '_blank';

export interface TemplateButtonItem {
  id: number;
  templateId: number;
  buttonKey: string;
  buttonLabel: string;
  buttonIcon?: string;
  sortOrder?: number;
  actionHandlerKey?: string | null;
  /** CSV status hiển thị, vd "DRAFT,RETURNED". Null/rỗng = mọi status. */
  visibleStatuses?: string | null;
  /** CSV status disable, vd "DISTRIBUTED". Null/rỗng = không disable. */
  disabledStatuses?: string | null;
  /**
   * URL template điều hướng sau khi nhấn nút. Null/rỗng = không điều hướng.
   * Hỗ trợ {templateId}, {entryId}, {row_code}, {$data.xxx}.
   */
  navigationUrl?: string | null;
  /** "_self" (cùng tab) hoặc "_blank" (tab mới). Null = "_self". */
  navigationTarget?: NavigationTarget | null;
  active?: boolean;
  /** true nếu user hiện tại có quyền sử dụng nút này (từ backend). */
  allowed?: boolean;
}

export interface ActionHandlerInfo {
  key: string;
  label: string;
  description: string;
}

export interface CreateTemplateButtonRequest {
  templateId: number;
  buttonKey: string;
  buttonLabel: string;
  buttonIcon?: string;
  sortOrder?: number;
  actionHandlerKey?: string | null;
  visibleStatuses?: string | null;
  disabledStatuses?: string | null;
  navigationUrl?: string | null;
  navigationTarget?: NavigationTarget | null;
}

export interface UpdateTemplateButtonRequest {
  buttonLabel: string;
  buttonIcon?: string;
  sortOrder?: number;
  actionHandlerKey?: string | null;
  visibleStatuses?: string | null;
  disabledStatuses?: string | null;
  navigationUrl?: string | null;
  navigationTarget?: NavigationTarget | null;
}

export interface ExecuteButtonActionRequest {
  templateId: number;
  entryId?: number | null;
  buttonKey: string;
  rowData?: string;
  payload?: string;
  /** Tham số runtime do user nhập (vd dueDate). Backend nhận như Map<String,Object>. */
  params?: Record<string, any>;
}

export interface ButtonActionResult {
  status: 'success' | 'info' | 'warning' | 'error';
  message: string;
  data?: any;
  /** URL điều hướng do handler chỉ định (override URL template của nút). */
  redirectUrl?: string | null;
}

const BASE = '/excelpro-service/v1/template-buttons';

@Injectable({ providedIn: 'root' })
export class TemplateButtonService {
  private readonly http = inject(HttpClient);

  getByTemplateId(templateId: number): Observable<TemplateButtonItem[]> {
    return this.http.get<any>(`${BASE}/by-template/${templateId}`).pipe(map(r => r.data));
  }

  create(req: CreateTemplateButtonRequest): Observable<TemplateButtonItem> {
    return this.http.post<any>(BASE, req).pipe(map(r => r.data));
  }

  update(id: number, req: UpdateTemplateButtonRequest): Observable<TemplateButtonItem> {
    return this.http.put<any>(`${BASE}/${id}`, req).pipe(map(r => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${BASE}/${id}`).pipe(map(() => void 0));
  }

  executeAction(req: ExecuteButtonActionRequest): Observable<ButtonActionResult> {
    return this.http.post<any>(`${BASE}/execute`, req).pipe(map(r => r.data));
  }

  getActionHandlers(): Observable<ActionHandlerInfo[]> {
    return this.http.get<any>(`${BASE}/action-handlers`).pipe(map(r => r.data));
  }
}
