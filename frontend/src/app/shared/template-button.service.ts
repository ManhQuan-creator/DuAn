import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface TemplateButtonItem {
  id: number;
  templateId: number;
  /** Trùng với TEMPLATE_PERMISSION.actionKey */
  buttonKey: string;
  buttonLabel: string;
  buttonIcon?: string;
  sortOrder: number;
  active: boolean;
  /** true nếu user hiện tại có quyền dùng nút này */
  allowed: boolean;
}

export interface CreateTemplateButtonRequest {
  templateId: number;
  buttonKey: string;
  buttonLabel: string;
  buttonIcon?: string;
  sortOrder?: number;
}

const BASE_URL = '/excelpro-service/v1/template-buttons';

@Injectable({ providedIn: 'root' })
export class TemplateButtonService {
  private readonly http = inject(HttpClient);

  /** Lấy danh sách nút của template, kèm allowed cho user hiện tại */
  getByTemplateId(templateId: number): Observable<TemplateButtonItem[]> {
    return this.http
      .get<any>(`${BASE_URL}/by-template/${templateId}`)
      .pipe(map(r => r.data as TemplateButtonItem[]));
  }

  create(req: CreateTemplateButtonRequest): Observable<TemplateButtonItem> {
    return this.http.post<any>(BASE_URL, req).pipe(map(r => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${BASE_URL}/${id}`).pipe(map(() => void 0));
  }
}
