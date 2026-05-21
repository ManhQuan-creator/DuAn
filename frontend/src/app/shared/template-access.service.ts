import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Page } from './models/common.model';

export interface TemplateAccessItem {
  id: number;
  templateId: number;
  /** VIEW | EDIT | SUBMIT | APPROVE:1 | APPROVE:2 | APPROVE:N | ... */
  actionKey: string;
  /** ORGANIZATION.orgCode — BAN_KH, PHONG_KH, ... | null = tất cả ban/phòng */
  subjectOrgCode: string | null;
  /** POSITION.positionCode — TGD, TRUONG_PHONG, ... | null = tất cả chức danh */
  subjectPositionCode: string | null;
  active: boolean;
  createdBy?: string;
  createdAt?: string;
}

export interface CreateTemplateAccessRequest {
  templateId: number;
  /** VIEW | EDIT | SUBMIT | APPROVE:1 | APPROVE:2 | APPROVE:N | ... */
  actionKey: string;
  /** ORGANIZATION.orgCode — null = tất cả ban/phòng */
  subjectOrgCode?: string | null;
  /** POSITION.positionCode — null = tất cả chức danh */
  subjectPositionCode?: string | null;
}

export interface UpdateTemplateAccessRequest {
  actionKey: string;
  subjectOrgCode?: string | null;
  subjectPositionCode?: string | null;
}

export interface SearchTemplateAccessRequest {
  templateId?: number | null;
  keyword?: string;
  pageNum: number;
  pageSize: number;
}

const BASE_URL = '/excelpro-service/v1/template-access';

@Injectable({ providedIn: 'root' })
export class TemplateAccessService {
  private readonly http = inject(HttpClient);

  search(req: SearchTemplateAccessRequest): Observable<Page<TemplateAccessItem>> {
    return this.http.post<any>(`${BASE_URL}/search`, req).pipe(map(r => r.data));
  }

  getByTemplateId(templateId: number): Observable<TemplateAccessItem[]> {
    return this.http.get<any>(`${BASE_URL}/by-template/${templateId}`).pipe(map(r => r.data));
  }

  create(req: CreateTemplateAccessRequest): Observable<TemplateAccessItem> {
    return this.http.post<any>(BASE_URL, req).pipe(map(r => r.data));
  }

  update(id: number, req: UpdateTemplateAccessRequest): Observable<TemplateAccessItem> {
    return this.http.put<any>(`${BASE_URL}/${id}`, req).pipe(map(r => r.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${BASE_URL}/${id}`).pipe(map(() => void 0));
  }

  checkAccess(templateId: number, actionKey = 'VIEW'): Observable<boolean> {
    return this.http
      .get<any>(`${BASE_URL}/check/${templateId}`, { params: { actionKey } })
      .pipe(map(r => r.data as boolean));
  }

  getMyViewableTemplateIds(): Observable<number[]> {
    return this.http.get<any>(`${BASE_URL}/my-viewable`).pipe(map(r => r.data));
  }
}
