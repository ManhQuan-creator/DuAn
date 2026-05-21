import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Page, ResponseData } from '../../shared/models/common.model';
import { FilterGridTemplateRequest, GridDataEntryDetail, GridDataEntryListItem, GridTemplateDetail, GridTemplateListItem } from '../models/grid-template.model';

@Injectable({ providedIn: 'root' })
export class GridTemplateService {
  private http = inject(HttpClient);
  private baseUrl = '/excelpro-service/v1/grid-templates';

  getTemplates(): Observable<GridTemplateListItem[]> {
    return this.http
      .get<ResponseData<GridTemplateListItem[]>>(this.baseUrl)
      .pipe(map(res => res.data));
  }

  getTemplate(id: number): Observable<GridTemplateDetail> {
    return this.http
      .get<ResponseData<GridTemplateDetail>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  createTemplate(req: {
    code: string;
    name: string;
    description?: string;
    columnConfigs: string;
    columnGroups: string;
    rows: any[];
    processDefinitionKey?: string | null;
    reportDepartments?: string[];
    reportFcGroups?: string[];
    periodType?: string;
    useDueDate?: boolean;
  }): Observable<GridTemplateDetail> {
    return this.http
      .post<ResponseData<GridTemplateDetail>>(this.baseUrl, req)
      .pipe(map(res => res.data));
  }

  updateTemplate(id: number, req: {
    name?: string;
    code?: string;
    description?: string;
    columnConfigs?: string;
    columnGroups?: string;
    rows?: any[];
    processDefinitionKey?: string | null;
    reportDepartments?: string[];
    reportFcGroups?: string[];
    periodType?: string;
    useDueDate?: boolean;
  }): Observable<GridTemplateDetail> {
    return this.http
      .put<ResponseData<GridTemplateDetail>>(`${this.baseUrl}/${id}`, req)
      .pipe(map(res => res.data));
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/${id}`)
      .pipe(map(res => res.data));
  }

  searchTemplates(req: FilterGridTemplateRequest): Observable<Page<GridTemplateListItem>> {
    const request: FilterGridTemplateRequest = {};

    if (req.keyword) request.keyword = req.keyword;

    if (req.status && req.status !== 'ALL') request.status = req.status;

    if (req.pageNum !== undefined || req.pageNum !== 0) request.pageNum = req.pageNum;
    else request.pageNum = 1;

    if (req.pageSize !== undefined || req.pageSize !== 0) request.pageSize = req.pageSize;
    else request.pageSize = 10;
    
    return this.http
      .post<ResponseData<Page<GridTemplateListItem>>>(`${this.baseUrl}/search`, request)
      .pipe(map(res => res.data));
  }

  publishTemplate(id: number): Observable<GridTemplateDetail> {
    return this.http
      .put<ResponseData<GridTemplateDetail>>(`${this.baseUrl}/${id}/publish`, {})
      .pipe(map(res => res.data));
  }

  copyTemplate(id: number): Observable<GridTemplateDetail> {
    return this.http
      .post<ResponseData<GridTemplateDetail>>(`${this.baseUrl}/${id}/copy`, {})
      .pipe(map(res => res.data));
  }

  // --- Data Entry (Render) ---

  getEntries(templateId: number, filters?: {
    orgCode?: string;
    year?: number;
    month?: number;
  }): Observable<GridDataEntryListItem[]> {
    let params: any = {};
    if (filters?.orgCode != null) params.orgCode = filters.orgCode;
    if (filters?.year != null) params.year = filters.year;
    if (filters?.month != null) params.month = filters.month;
    return this.http
      .get<ResponseData<GridDataEntryListItem[]>>(`${this.baseUrl}/${templateId}/entries`, { params })
      .pipe(map(res => res.data));
  }

  getEntry(templateId: number, entryId: number): Observable<GridDataEntryDetail> {
    return this.http
      .get<ResponseData<GridDataEntryDetail>>(`${this.baseUrl}/${templateId}/entries/${entryId}`)
      .pipe(map(res => res.data));
  }

  createEntry(templateId: number, req: {
    entryCode: string;
    entryName?: string;
    orgCode?: string | null;
    year: number;
    month?: number | null;
    rowData: string;
    /** Hạn xử lý phiên — ISO datetime (yyyy-MM-ddTHH:mm:ss). */
    dueDate?: string;
  }): Observable<GridDataEntryDetail> {
    return this.http
      .post<ResponseData<GridDataEntryDetail>>(`${this.baseUrl}/${templateId}/entries`, req)
      .pipe(map(res => res.data));
  }

  updateEntry(templateId: number, entryId: number, req: {
    entryName?: string;
    rowData?: string;
    /** Hạn xử lý phiên — ISO datetime. Bỏ qua field nếu chỉ muốn giữ nguyên. */
    dueDate?: string;
    /** True = xoá due_date (set NULL). Phân biệt với "không gửi" (giữ giá trị cũ). */
    clearDueDate?: boolean;
  }): Observable<GridDataEntryDetail> {
    return this.http
      .put<ResponseData<GridDataEntryDetail>>(`${this.baseUrl}/${templateId}/entries/${entryId}`, req)
      .pipe(map(res => res.data));
  }

  deleteEntry(templateId: number, entryId: number): Observable<void> {
    return this.http
      .delete<ResponseData<void>>(`${this.baseUrl}/${templateId}/entries/${entryId}`)
      .pipe(map(res => res.data));
  }
}
